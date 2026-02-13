import { z } from 'zod';

export const userSchema = z.object({
    id: z.string().optional().describe('ID'),
    email: z.string().email('Invalid email format').describe('Email'),
    passwordHash: z.string().optional().describe('PasswordHash'),
    role: z.enum(['Cliente', 'Abogado']).default('Cliente').describe('Role'),
    firstName: z.string().min(2).describe('First Name'),
    lastName: z.string().min(2).describe('Last Name'),
    googleId: z.string().optional().describe('Google ID'),
    registrationDate: z.string().optional().describe('Registration Date'),
});

export type User = z.infer<typeof userSchema>;

export const loginSchema = z.object({
    email: z.string().email('Invalid email format'),
    password: z.string().min(6, 'Password must be at least 6 characters'),
});

export const googleLoginSchema = z.object({
    idToken: z.string().min(1, 'Google ID Token is required'),
});

export const USER_SHEET_HEADERS = [
    'ID',
    'Email',
    'PasswordHash',
    'Role',
    'First Name',
    'Last Name',
    'Google ID',
    'Registration Date'
];
