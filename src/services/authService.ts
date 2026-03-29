import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { OAuth2Client } from 'google-auth-library';
import { UserService } from './UserService';
import { User } from '../models/User';
import { AppError } from '../utils/AppError';

const JWT_SECRET = process.env.JWT_SECRET || 'c3c7962c344bd330bdef829c2674adee50da48072041faef7abc347e5f3f937b';
const JWT_EXPIRES_IN = '24h';
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI;

// Se necesita el clientSecret y el redirectUri para el server-side flow
const googleClient = new OAuth2Client(
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    GOOGLE_REDIRECT_URI
);
const userService = new UserService();

export class AuthService {
    async register(userData: any): Promise<{ user: User; token: string }> {
        const { email, password, firstName, lastName, role, ...otherData } = userData;
        
        console.log(`[AuthService] Intentando registrar usuario: ${email}`);
        console.log(`[AuthService] Password recibida: ${password ? 'SI (largo: ' + password.length + ')' : 'NO'}`);
        
        const existingUser = await userService.getUserByEmail(email);
        if (existingUser) {
            console.warn(`[AuthService] Registro fallido: El email ${email} ya está en uso.`);
            throw new AppError('Email already in use', 400);
        }

        let passwordHash: string | undefined;
        if (password) {
            passwordHash = await bcrypt.hash(password, 12);
            console.log(`[AuthService] Hash generado exitosamente`);
        } else {
            console.warn(`[AuthService] No se proporcionó contraseña para el usuario: ${email}`);
        }

        const newUser: User = {
            ...otherData,
            email,
            firstName,
            lastName,
            role: role || 'Cliente',
            passwordHash,
            id: userData.id || require('uuid').v4(),
            registrationDate: new Date().toISOString()
        };

        console.log(`[AuthService] Guardando usuario con passwordHash: ${newUser.passwordHash ? 'PRESENTE' : 'AUSENTE'}`);
        const createdUser = await userService.create(newUser);
        
        console.log(`[AuthService] Usuario creado exitosamente con ID: ${createdUser.id}`);
        const token = this.generateToken(createdUser);

        return { user: createdUser, token };
    }

    async login(email: string, password: string): Promise<{ user: User; token: string }> {
        console.log(`[AuthService] Intento de login para: ${email}`);
        const user = await userService.getUserByEmail(email);
        
        if (!user || !user.passwordHash || !(await bcrypt.compare(password, user.passwordHash))) {
            console.warn(`[AuthService] Login fallido para: ${email}`);
            throw new AppError('Incorrect email or password', 401);
        }

        console.log(`[AuthService] Login exitoso para: ${email} (Rol: ${user.role})`);
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

            let user = await userService.getUserByEmail(payload.email);

            if (!user) {
                // Auto-register Google users
                const newUser: User = {
                    email: payload.email,
                    firstName: payload.given_name || 'Google',
                    lastName: payload.family_name || 'User',
                    role: 'Cliente',
                    googleId: payload.sub,
                    documentType: undefined,
                    id: require('uuid').v4(),
                    registrationDate: new Date().toISOString(),
                    documentsUploaded: false
                };
                user = await userService.create(newUser);
            }

            if (!user) throw new AppError('Error with Google login', 500);

            const token = this.generateToken(user);
            return { user, token };
        } catch (error: any) {
            throw new AppError(`Google authentication failed: ${error.message}`, 401);
        }
    }

    generateGoogleAuthUrl(): { url: string; state: string } {
        // Genera un state criptográficamente seguro
        const state = crypto.randomBytes(32).toString('hex');

        // Genera la URL de autorización
        const url = googleClient.generateAuthUrl({
            access_type: 'offline', // Para obtener refresh token si es necesario después
            scope: [
                'https://www.googleapis.com/auth/userinfo.profile',
                'https://www.googleapis.com/auth/userinfo.email',
            ],
            state: state,
            prompt: 'consent' // Fuerza a que vuelva a pedir permisos (opcional, útil para obtener refresh token siempre)
        });

        return { url, state };
    }

    async googleCallbackLogin(code: string): Promise<{ user: User; token: string }> {
        try {
            console.info('[AuthService.googleCallbackLogin] Starting token exchange with Google...');
            // Intercambia el código por tokens
            const { tokens } = await googleClient.getToken(code);
            console.info('[AuthService.googleCallbackLogin] Tokens received successfully');
            
            // Configura los tokens en el cliente para poder hacer peticiones (ej. obtener info del usuario)
            googleClient.setCredentials(tokens);

            // Obtiene la información del usuario usando el idToken provisto por Google
            if (!tokens.id_token) {
                 console.error('[AuthService.googleCallbackLogin] Error: No id_token received');
                 throw new AppError('No id_token received from Google', 400);
            }

            console.info('[AuthService.googleCallbackLogin] Verifying Google idToken...');
            const ticket = await googleClient.verifyIdToken({
                idToken: tokens.id_token,
                audience: GOOGLE_CLIENT_ID,
            });

            const payload = ticket.getPayload();
            
            if (!payload || !payload.email) {
                console.error('[AuthService.googleCallbackLogin] Error: Invalid payload or missing email');
                throw new AppError('Invalid Google payload info', 400);
            }

            console.info(`[AuthService.googleCallbackLogin] Payload verified for email: ${payload.email}`);

            // A partir de aquí, la lógica es idéntica al googleLogin existente
            let user = await userService.getUserByEmail(payload.email);

            if (!user) {
                console.info(`[AuthService.googleCallbackLogin] User not found in DB. Creating new user for: ${payload.email}`);
                // Auto-register Google users
                const newUser: User = {
                    email: payload.email,
                    firstName: payload.given_name || 'Google',
                    lastName: payload.family_name || 'User',
                    role: 'Cliente',
                    googleId: payload.sub,
                    documentType: undefined,
                    id: require('uuid').v4(),
                    registrationDate: new Date().toISOString(),
                    documentsUploaded: false
                };
                user = await userService.create(newUser);
                console.info('[AuthService.googleCallbackLogin] New user created successfully.');
            } else {
                console.info(`[AuthService.googleCallbackLogin] User found in DB for: ${payload.email}`);
            }

            if (!user) throw new AppError('Error with Google callback login', 500);

            console.info('[AuthService.googleCallbackLogin] Generating JWT token and finishing login process.');
            const token = this.generateToken(user);
            return { user, token };

        } catch (error: any) {
            console.error('[AuthService] Error in googleCallbackLogin:', error);
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
