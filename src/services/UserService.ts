import prisma from '../config/prisma';
import { User } from '../models/User';

export class UserService {
    async create(userData: User): Promise<User> {
        const user = await prisma.user.create({
            data: {
                id: userData.id,
                email: userData.email,
                passwordHash: userData.passwordHash,
                role: userData.role as any,
                firstName: userData.firstName,
                lastName: userData.lastName,
                googleId: userData.googleId,
                registrationDate: userData.registrationDate ? new Date(userData.registrationDate) : new Date(),
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

    private mapPrismaToUser(prismaUser: any): User {
        return {
            id: prismaUser.id,
            email: prismaUser.email,
            passwordHash: prismaUser.passwordHash || undefined,
            role: prismaUser.role,
            firstName: prismaUser.firstName,
            lastName: prismaUser.lastName,
            googleId: prismaUser.googleId || undefined,
            registrationDate: prismaUser.registrationDate.toISOString(),
        };
    }
}
