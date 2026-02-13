import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { OAuth2Client } from 'google-auth-library';
import { UserSheetsService } from './googleSheets/UserSheetsService';
import { User } from '../models/User';
import { AppError } from '../utils/AppError';

const JWT_SECRET = process.env.JWT_SECRET || 'c3c7962c344bd330bdef829c2674adee50da48072041faef7abc347e5f3f937b';
const JWT_EXPIRES_IN = '24h';
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;

const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);
const userSheetsService = new UserSheetsService();

export class AuthService {
    async register(userData: Omit<User, 'id' | 'registrationDate'>): Promise<{ user: User; token: string }> {
        const existingUser = await userSheetsService.getUserByEmail(userData.email);
        if (existingUser) {
            throw new AppError('Email already in use', 400);
        }

        const passwordHash = userData.passwordHash 
            ? await bcrypt.hash(userData.passwordHash, 12) 
            : undefined;

        const newUser: User = {
            ...userData,
            passwordHash,
            id: (userData as any).id || require('uuid').v4(),
            registrationDate: new Date().toISOString()
        };

        await userSheetsService.create(newUser);
        
        const token = this.generateToken(newUser);

        return { user: newUser, token };
    }

    async login(email: string, passwordHash: string): Promise<{ user: User; token: string }> {
        const user = await userSheetsService.getUserByEmail(email);
        
        if (!user || !user.passwordHash || !(await bcrypt.compare(passwordHash, user.passwordHash))) {
            throw new AppError('Incorrect email or password', 401);
        }

        const token = this.generateToken(user);
        return { user, token };
    }

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

            let user = await userSheetsService.getUserByEmail(payload.email);

            if (!user) {
                // Auto-register Google users
                const newUser: User = {
                    email: payload.email,
                    firstName: payload.given_name || 'Google',
                    lastName: payload.family_name || 'User',
                    role: 'Cliente',
                    googleId: payload.sub,
                };
                await userSheetsService.create(newUser);
                user = await userSheetsService.getUserByEmail(payload.email);
            }

            if (!user) throw new AppError('Error with Google login', 500);

            const token = this.generateToken(user);
            return { user, token };
        } catch (error: any) {
            throw new AppError(`Google authentication failed: ${error.message}`, 401);
        }
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
