import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { OAuth2Client } from 'google-auth-library';
import { UserService } from './UserService';
import { User } from '../models/User';
import { AppError } from '../utils/AppError';

const JWT_SECRET = process.env.JWT_SECRET || 'c3c7962c344bd330bdef829c2674adee50da48072041faef7abc347e5f3f937b';
const JWT_EXPIRES_IN = '24h';
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;

const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);
const userService = new UserService();

export class AuthService {
    async register(userData: any): Promise<{ user: User; token: string }> {
        const existingUser = await userService.getUserByEmail(userData.email);
        if (existingUser) {
            throw new AppError('Email already in use', 400);
        }

        const passwordHash = userData.password 
            ? await bcrypt.hash(userData.password, 12) 
            : undefined;

        // Clean up userData to match the User model before creating
        const { password, ...userBaseData } = userData;

        const newUser: User = {
            ...userBaseData,
            passwordHash,
            id: userBaseData.id || require('uuid').v4(),
            registrationDate: new Date().toISOString()
        };

        const createdUser = await userService.create(newUser);
        
        const token = this.generateToken(createdUser);

        return { user: createdUser, token };
    }

    async login(email: string, passwordHash: string): Promise<{ user: User; token: string }> {
        const user = await userService.getUserByEmail(email);
        
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

            let user = await userService.getUserByEmail(payload.email);

            if (!user) {
                // Auto-register Google users
                const newUser: User = {
                    email: payload.email,
                    firstName: payload.given_name || 'Google',
                    lastName: payload.family_name || 'User',
                    role: 'Cliente',
                    googleId: payload.sub,
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
