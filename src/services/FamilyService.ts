import prisma from '../config/prisma';
import { AppError } from '../utils/AppError';
import { FamilyNucleus } from '../models/FamilyNucleus';
import { User } from '../models/User';
import { DriveService } from './googleDrive/driveService';
import { ClientSheetsService } from './googleSheets/ClientSheetsService';
import { UserService } from './UserService';

const driveService = new DriveService();
const clientSheetsService = new ClientSheetsService();
const userService = new UserService();

export class FamilyService {
    async createFamily(adminId: string, name: string): Promise<FamilyNucleus> {
        const user = await prisma.user.findUnique({ where: { id: adminId } });
        if (!user) {
            throw new AppError('Usuario no encontrado', 404);
        }
        if (user.familyId) {
            throw new AppError('El usuario ya pertenece a un núcleo familiar', 400);
        }

        // Create folder in Drive
        let driveFolderId: string | undefined;
        try {
            const rootId = process.env.GOOGLE_DRIVE_CLIENTS_ROOT_ID;
            // Create folder: "Familia_Name_AdminIDShort"
            const folderName = `Familia_${name}_${adminId.substring(0, 8)}`.replace(/\s+/g, '_');
            driveFolderId = await driveService.createFolder(folderName, rootId);
        } catch (error) {
            console.error('Error creating Drive folder for family:', error);
            // We proceed without folder ID, or fail? Maybe fail is safer to ensure consistency.
            // But if Drive API fails, maybe we want to retry later.
            // For now, let's log and proceed, or throw.
            // Prompt says: "Modifica el servicio de almacenamiento para que... sus carpetas se creen dentro de una carpeta principal".
            // So folder creation is critical.
            throw new AppError('Error al crear la carpeta de la familia en Google Drive', 500);
        }

        const family = await prisma.familyNucleus.create({
            data: {
                name,
                adminId,
                driveFolderId,
                members: {
                    connect: { id: adminId }
                }
            },
            include: { members: true }
        });

        return {
            id: family.id,
            name: family.name,
            adminId: family.adminId,
            driveFolderId: family.driveFolderId || undefined,
            createdAt: family.createdAt.toISOString(),
            updatedAt: family.updatedAt.toISOString(),
        };
    }

    async addMember(adminId: string, documentNumber: string): Promise<User> {
        // 1. Verify admin permissions
        const family = await prisma.familyNucleus.findUnique({
            where: { adminId },
            include: { members: true }
        });

        if (!family) {
            throw new AppError('No tienes permisos de administrador de familia o no tienes familia creada', 403);
        }

        // 2. Find user to add
        const userToAdd = await prisma.user.findUnique({
            where: { documentNumber }
        });

        if (!userToAdd) {
            throw new AppError('Usuario no encontrado con ese número de documento', 404);
        }

        if (userToAdd.familyId) {
            throw new AppError('El usuario ya pertenece a un núcleo familiar', 400);
        }

        // 3. Add to family
        const updatedUser = await prisma.user.update({
            where: { id: userToAdd.id },
            data: { familyId: family.id }
        });

        return userService.mapPrismaToUser(updatedUser);
    }

    async removeMember(adminId: string, memberId: string): Promise<void> {
        const family = await prisma.familyNucleus.findUnique({
            where: { adminId },
            include: { members: true }
        });

        if (!family) {
            throw new AppError('No tienes permisos de administrador', 403);
        }

        if (memberId === adminId) {
             throw new AppError('No puedes eliminarte a ti mismo del núcleo familiar. Debes eliminar el núcleo completo.', 400);
        }

        const member = family.members.find(m => m.id === memberId);
        if (!member) {
            throw new AppError('El usuario no pertenece a tu núcleo familiar', 404);
        }

        await prisma.user.update({
            where: { id: memberId },
            data: { familyId: null }
        });
    }

    async getFamilyStatus(userId: string): Promise<any> {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            include: { family: { include: { members: true } } }
        });

        if (!user || !user.family) {
             return null;
        }

        const family = user.family;
        const isAdmin = family.adminId === userId;

        // Fetch all clients from Sheets to check status
        const clients = await clientSheetsService.findAll();

        return {
            familyId: family.id,
            familyName: family.name,
            isAdmin,
            createdAt: family.createdAt,
            members: family.members.map(m => {
                const clientRecord = clients.find(c => c.email.toLowerCase() === m.email.toLowerCase());
                return {
                    id: m.id,
                    fullName: `${m.firstName} ${m.lastName}`,
                    email: m.email,
                    documentNumber: m.documentNumber,
                    role: m.id === family.adminId ? 'ADMIN' : 'MEMBER',
                    status: {
                        formRegistered: !!clientRecord,
                        documentsUploaded: m.documentsUploaded,
                        clientStatus: clientRecord?.status || 'No iniciado'
                    }
                };
            })
        };
    }
}
