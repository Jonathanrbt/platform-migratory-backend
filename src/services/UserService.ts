import prisma from '../config/prisma';
import { User, userSchema } from '../models/User';
import { AppError } from '../utils/AppError';

export class UserService {
    async create(userData: User): Promise<User> {
        const validatedData = userSchema.parse(userData);
        const user = await prisma.user.create({
            data: {
                id: validatedData.id,
                email: validatedData.email,
                passwordHash: validatedData.passwordHash,
                role: validatedData.role as 'Cliente' | 'Abogado',
                firstName: validatedData.firstName,
                lastName: validatedData.lastName,
                googleId: validatedData.googleId,
                registrationDate: validatedData.registrationDate ? new Date(validatedData.registrationDate) : new Date(),
                documentNumber: validatedData.documentNumber,
                documentType: validatedData.documentType,
            },
        });

        return this.mapPrismaToUser(user);
    }

    async getUserByEmail(email: string): Promise<User | null> {
        const user = await prisma.user.findUnique({
            where: { email },
        });

        return user ? this.mapPrismaToUser(user) : null;
    }

    async getUserById(id: string): Promise<User | null> {
        const user = await prisma.user.findUnique({
            where: { id },
        });

        return user ? this.mapPrismaToUser(user) : null;
    }

    async updateDocumentNumber(userId: string, documentNumber: string): Promise<User> {
        return this.updateDocumentInfo(userId, 'DNI', documentNumber);
    }

    async updateDocumentInfo(userId: string, documentType: string, documentNumber: string): Promise<User> {
        // Check if document already exists
        const existing = await prisma.user.findUnique({
            where: { documentNumber }
        });

        if (existing && existing.id !== userId) {
            throw new AppError('El número de documento ya está en uso por otro usuario', 400);
        }

        const user = await prisma.user.update({
            where: { id: userId },
            data: { 
                documentType,
                documentNumber 
            }
        });

        return this.mapPrismaToUser(user);
    }

    public mapPrismaToUser(prismaUser: any): User {
        return {
            id: prismaUser.id,
            email: prismaUser.email,
            passwordHash: prismaUser.passwordHash || undefined,
            role: prismaUser.role as 'Cliente' | 'Abogado',
            firstName: prismaUser.firstName,
            lastName: prismaUser.lastName,
            googleId: prismaUser.googleId || undefined,
            registrationDate: prismaUser.registrationDate ? new Date(prismaUser.registrationDate).toISOString() : new Date().toISOString(),
            documentNumber: prismaUser.documentNumber || undefined,
            documentType: prismaUser.documentType || undefined,
            familyId: prismaUser.familyId || undefined,
            documentsUploaded: prismaUser.documentsUploaded,
            driveFolderId: prismaUser.driveFolderId || undefined,
            isEmailVerified: prismaUser.isEmailVerified || false
        };
    }
}
