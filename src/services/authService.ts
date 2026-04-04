import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { OAuth2Client } from 'google-auth-library';
import { UserService } from './UserService';
import { User } from '../models/User';
import { AppError } from '../utils/AppError';
import { emailService } from './EmailService';
import prisma from '../config/prisma';

const JWT_SECRET = process.env.JWT_SECRET as string;
const JWT_EXPIRES_IN = '24h';
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI;

const googleClient = new OAuth2Client(
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    GOOGLE_REDIRECT_URI
);
const userService = new UserService();

export class AuthService {
    // Generador de OTP de 6 dígitos
    private generateOTP(): string {
        return Math.floor(100000 + Math.random() * 900000).toString();
    }

    async register(userData: any): Promise<{ user: User; requiresVerification: boolean; token?: string }> {
        const { email, password, firstName, lastName, role, ...otherData } = userData;
        
        const existingUser = await userService.getUserByEmail(email);
        if (existingUser) {
            throw new AppError('Email already in use', 400);
        }

        let passwordHash: string | undefined;
        if (password) {
            passwordHash = await bcrypt.hash(password, 12);
        }

        const newUser: any = {
            ...otherData,
            email,
            firstName,
            lastName,
            role: role || 'Cliente',
            passwordHash,
            id: userData.id || require('uuid').v4(),
            registrationDate: new Date().toISOString(),
            isEmailVerified: false
        };

        const createdUser = await userService.create(newUser);
        
        // Generar OTP y guardar
        const otp = this.generateOTP();
        await prisma.verificationToken.create({
            data: {
                email,
                token: otp,
                type: 'VERIFY_EMAIL',
                expiresAt: new Date(Date.now() + 15 * 60 * 1000) // 15 mins
            }
        });

        // Enviar email
        await emailService.sendVerificationEmail(email, otp);

        return { user: createdUser, requiresVerification: true };
    }

    async login(email: string, password: string): Promise<{ user: User; token?: string; requiresVerification?: boolean }> {
        const user = await userService.getUserByEmail(email);
        
        if (!user || !user.passwordHash || !(await bcrypt.compare(password, user.passwordHash))) {
            throw new AppError('Incorrect email or password', 401);
        }

        if (!(user as any).isEmailVerified) {
            // Generar nuevo OTP y reenviar
            await prisma.verificationToken.deleteMany({
                where: { email: user.email, type: 'VERIFY_EMAIL' }
            });
            const otp = this.generateOTP();
            await prisma.verificationToken.create({
                data: {
                    email: user.email,
                    token: otp,
                    type: 'VERIFY_EMAIL',
                    expiresAt: new Date(Date.now() + 15 * 60 * 1000)
                }
            });
            await emailService.sendVerificationEmail(user.email, otp);
            
            throw new AppError('Email no verificado. Se ha enviado un nuevo código a su correo.', 403);
        }

        const token = this.generateToken(user);
        return { user, token };
    }

    async verifyEmail(email: string, code: string): Promise<{ user: User; token: string }> {
        const tokenRecord = await prisma.verificationToken.findFirst({
            where: {
                email,
                token: code,
                type: 'VERIFY_EMAIL'
            }
        });

        if (!tokenRecord) {
            throw new AppError('Código inválido o incorrecto', 400);
        }

        if (tokenRecord.expiresAt < new Date()) {
            throw new AppError('El código ha expirado', 400);
        }

        // Actualizar usuario
        const updatedUser = await prisma.user.update({
            where: { email },
            data: { isEmailVerified: true }
        });

        // Borrar tokens
        await prisma.verificationToken.deleteMany({
            where: { email, type: 'VERIFY_EMAIL' }
        });

        const token = this.generateToken(updatedUser as any);
        return { user: updatedUser as any, token };
    }

    async resendVerification(email: string): Promise<void> {
        const user = await userService.getUserByEmail(email);
        if (!user) throw new AppError('Usuario no encontrado', 404);
        if (user.isEmailVerified) throw new AppError('El correo ya está verificado', 400);

        await prisma.verificationToken.deleteMany({
            where: { email, type: 'VERIFY_EMAIL' }
        });

        const otp = this.generateOTP();
        await prisma.verificationToken.create({
            data: {
                email,
                token: otp,
                type: 'VERIFY_EMAIL',
                expiresAt: new Date(Date.now() + 15 * 60 * 1000)
            }
        });

        await emailService.sendVerificationEmail(email, otp);
    }

    async forgotPassword(email: string): Promise<void> {
        const user = await userService.getUserByEmail(email);
        if (!user) {
            // Por seguridad, no decimos si existe o no
            return;
        }

        await prisma.verificationToken.deleteMany({
            where: { email, type: 'RESET_PASSWORD' }
        });

        const otp = this.generateOTP();
        await prisma.verificationToken.create({
            data: {
                email,
                token: otp,
                type: 'RESET_PASSWORD',
                expiresAt: new Date(Date.now() + 15 * 60 * 1000)
            }
        });

        await emailService.sendPasswordResetEmail(email, otp);
    }

    async resetPassword(email: string, code: string, newPassword: string): Promise<void> {
        const tokenRecord = await prisma.verificationToken.findFirst({
            where: {
                email,
                token: code,
                type: 'RESET_PASSWORD'
            }
        });

        if (!tokenRecord || tokenRecord.expiresAt < new Date()) {
            throw new AppError('Código inválido o expirado', 400);
        }

        const passwordHash = await bcrypt.hash(newPassword, 12);
        await prisma.user.update({
            where: { email },
            data: { passwordHash }
        });

        await prisma.verificationToken.deleteMany({
            where: { email, type: 'RESET_PASSWORD' }
        });
    }

    // --- MÉTODOS DE GOOGLE INTACTOS ---
    async googleLogin(idToken: string): Promise<{ user: User; token: string }> {
        try {
            const ticket = await googleClient.verifyIdToken({
                idToken,
                audience: GOOGLE_CLIENT_ID,
            });

            const payload = ticket.getPayload();
            if (!payload || !payload.email) {
                throw new AppError('Invalid Google token', 400);
            }

            let user = await userService.getUserByEmail(payload.email);

            if (!user) {
                const newUser: any = {
                    email: payload.email,
                    firstName: payload.given_name || 'Google',
                    lastName: payload.family_name || 'User',
                    role: 'Cliente',
                    googleId: payload.sub,
                    documentType: undefined,
                    id: require('uuid').v4(),
                    registrationDate: new Date().toISOString(),
                    documentsUploaded: false,
                    isEmailVerified: true // Al ser de Google, ya está verificado
                };
                user = await userService.create(newUser);
            } else if (!(user as any).isEmailVerified) {
                // Si el usuario existía pero no estaba verificado, al logearse con Google lo verificamos
                user = await prisma.user.update({
                    where: { email: user.email },
                    data: { isEmailVerified: true }
                }) as any;
            }

            if (!user) throw new AppError('Error with Google login', 500);

            const token = this.generateToken(user);
            return { user, token };
        } catch (error: any) {
            throw new AppError(`Google authentication failed: ${error.message}`, 401);
        }
    }

    generateGoogleAuthUrl(): { url: string; state: string } {
        const state = crypto.randomBytes(32).toString('hex');
        const url = googleClient.generateAuthUrl({
            access_type: 'offline',
            scope: [
                'https://www.googleapis.com/auth/userinfo.profile',
                'https://www.googleapis.com/auth/userinfo.email',
            ],
            state: state,
            prompt: 'consent'
        });

        return { url, state };
    }

    async googleCallbackLogin(code: string): Promise<{ user: User; token: string }> {
        try {
            const { tokens } = await googleClient.getToken(code);
            googleClient.setCredentials(tokens);

            if (!tokens.id_token) {
                throw new AppError('No id_token received from Google', 400);
            }

            const ticket = await googleClient.verifyIdToken({
                idToken: tokens.id_token,
                audience: GOOGLE_CLIENT_ID,
            });

            const payload = ticket.getPayload();
            
            if (!payload || !payload.email) {
                throw new AppError('Invalid Google payload info', 400);
            }

            let user = await userService.getUserByEmail(payload.email);

            if (!user) {
                const newUser: any = {
                    email: payload.email,
                    firstName: payload.given_name || 'Google',
                    lastName: payload.family_name || 'User',
                    role: 'Cliente',
                    googleId: payload.sub,
                    documentType: undefined,
                    id: require('uuid').v4(),
                    registrationDate: new Date().toISOString(),
                    documentsUploaded: false,
                    isEmailVerified: true
                };
                user = await userService.create(newUser);
            } else if (!(user as any).isEmailVerified) {
                user = await prisma.user.update({
                    where: { email: user.email },
                    data: { isEmailVerified: true }
                }) as any;
            }

            if (!user) throw new AppError('Error with Google callback login', 500);

            const token = this.generateToken(user);
            return { user, token };

        } catch (error: any) {
            throw new AppError(`Google server-side authentication failed: ${error.message}`, 401);
        }
    }

    async completeProfile(userId: string, data: { documentType: string; documentNumber: string }): Promise<User> {
        return await userService.updateDocumentInfo(userId, data.documentType, data.documentNumber);
    }

    async getUserById(userId: string): Promise<User | null> {
        return await userService.getUserById(userId);
    }

    private generateToken(user: User): string {
        return jwt.sign(
            { id: user.id, email: user.email, role: user.role },
            JWT_SECRET,
            { expiresIn: JWT_EXPIRES_IN }
        );
    }

    static verifyToken(token: string): any {
        try {
            return jwt.verify(token, JWT_SECRET);
        } catch (error) {
            throw new AppError('Invalid or expired token', 401);
        }
    }
}