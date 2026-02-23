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
    async searchByDocument(documentNumber: string): Promise<any> {
        const user = await prisma.user.findUnique({
            where: { documentNumber },
            include: { adminOf: true }
        });

        if (!user) {
            throw new AppError('El usuario con el número de documento proporcionado no existe', 404);
        }

        // Check if user is already in a family (as member or admin)
        if (user.familyId || user.adminOf) {
            throw new AppError('El usuario que está intentando buscar ya está en un grupo familiar', 400);
        }

        return {
            id: user.id,
            fullName: `${user.firstName} ${user.lastName}`,
            email: user.email,
            document: {
                type: user.documentType,
                number: user.documentNumber
            }
        };
    }

    async createFamily(adminId: string, name: string, members: string[] = []): Promise<FamilyNucleus> {
        // 1. Verify admin doesn't already have a family
        const adminUser = await prisma.user.findUnique({ 
            where: { id: adminId },
            include: { adminOf: true }
        });
        
        if (!adminUser) {
            throw new AppError('Usuario administrador no encontrado', 404);
        }
        
        if (adminUser.familyId || adminUser.adminOf) {
            throw new AppError('El administrador ya pertenece a un núcleo familiar', 400);
        }

        // 2. Validate all members (optional but safer)
        const allMemberIds = Array.from(new Set([adminId, ...members]));
        const memberUsers = await prisma.user.findMany({
            where: { id: { in: allMemberIds } },
            include: { adminOf: true }
        });

        const invalidMembers = memberUsers.filter(m => m.familyId || m.adminOf);
        if (invalidMembers.length > 0) {
            const names = invalidMembers.map(m => `${m.firstName} ${m.lastName}`).join(', ');
            throw new AppError(`Los siguientes miembros ya pertenecen a otra familia: ${names}`, 400);
        }

        // 3. Create root folder in Drive
        let familyDriveFolderId: string;
        try {
            const rootId = process.env.GOOGLE_DRIVE_CLIENTS_ROOT_ID;
            const folderName = `Familia_${name}_${adminId.substring(0, 8)}`.replace(/\s+/g, '_');
            familyDriveFolderId = await driveService.createFolder(folderName, rootId);
        } catch (error) {
            console.error('Error creating Drive folder for family:', error);
            throw new AppError('Error al crear la carpeta de la familia en Google Drive', 500);
        }

        // 4. Create family and connect all members in Prisma
        const family = await prisma.familyNucleus.create({
            data: {
                name,
                adminId,
                driveFolderId: familyDriveFolderId,
                members: {
                    connect: allMemberIds.map(id => ({ id }))
                }
            },
            include: { members: true }
        });

        // 5. Create/Move member subfolders and Sync with Google Sheets
        for (const member of family.members) {
            try {
                let existingClient = await clientSheetsService.findByEmail(member.email);
                let memberFolderId: string;

                if (existingClient && existingClient.driveFolderId) {
                    // A. Move existing folder to family folder
                    memberFolderId = existingClient.driveFolderId;
                    await driveService.moveFolder(memberFolderId, familyDriveFolderId);
                    
                    // B. Ensure doc subfolders exist
                    const currentSubfolders = await driveService.listSubfolders(memberFolderId);
                    const subfolderNames = currentSubfolders.map(f => f.name);
                    
                    const requiredSubfolders = ['01_Identidad', '02_Antecedentes', '03_Pruebas_Residencia', '04_Otros'];
                    for (const sub of requiredSubfolders) {
                        if (!subfolderNames.includes(sub)) {
                            await driveService.createFolder(sub, memberFolderId);
                        }
                    }
                } else {
                    // C. Create new folder structure if it doesn't exist
                    const shortId = member.id.split('-')[0];
                    const memberFolderName = `${member.firstName} ${member.lastName} ${shortId}`.replace(/\s+/g, '_');
                    memberFolderId = await driveService.createFolder(memberFolderName, familyDriveFolderId);
                    
                    const docSubfolders = ['01_Identidad', '02_Antecedentes', '03_Pruebas_Residencia', '04_Otros'];
                    for (const sub of docSubfolders) {
                        await driveService.createFolder(sub, memberFolderId);
                    }
                }

                // E. Save folder ID to Prisma User record
                await prisma.user.update({
                    where: { id: member.id },
                    data: { driveFolderId: memberFolderId }
                });

                // F. Sheets Sync: Update or Create
                if (existingClient && existingClient.id) {
                    await clientSheetsService.update(existingClient.id, { 
                        familyId: family.id 
                    });
                } else {
                    // G. Create a minimal client record in Sheets if it doesn't exist
                    await clientSheetsService.create({
                        id: member.id,
                        email: member.email,
                        firstName: member.firstName,
                        lastName: member.lastName,
                        familyId: family.id,
                        status: 'Registro incompleto',
                        registrationDate: new Date().toISOString(),
                        driveFolderId: memberFolderId,
                    } as any);
                }
            } catch (error) {
                console.error(`Error processing sync for member ${member.email}:`, error);
            }
        }

        return {
            id: family.id,
            name: family.name,
            adminId: family.adminId,
            driveFolderId: family.driveFolderId || undefined,
            members: family.members.map(m => userService.mapPrismaToUser(m)), // Map to application User model
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

        // 3. Add to family in Prisma (Source of truth)
        const updatedUser = await prisma.user.update({
            where: { id: userToAdd.id },
            data: { familyId: family.id }
        });

        // 4. Drive Sync: Move or Create folder inside family folder
        try {
            let memberFolderId = userToAdd.driveFolderId;
            const familyDriveFolderId = family.driveFolderId;

            if (familyDriveFolderId) {
                if (memberFolderId) {
                    // Move existing folder to family folder
                    await driveService.moveFolder(memberFolderId, familyDriveFolderId);
                } else {
                    // Create new folder structure inside family folder
                    memberFolderId = await driveService.createClientFolderStructure(
                        userToAdd.id,
                        userToAdd.firstName,
                        userToAdd.lastName,
                        familyDriveFolderId
                    );

                    // Update user with new driveFolderId
                    await prisma.user.update({
                        where: { id: userToAdd.id },
                        data: { driveFolderId: memberFolderId }
                    });
                }
            }
        } catch (error) {
            console.error(`Error syncing Drive for member ${userToAdd.id}:`, error);
            // Non-critical, continue to Sheets sync
        }

        // 5. Sheets Sync: Update or Create record
        try {
            let existingClient = await clientSheetsService.findByEmail(userToAdd.email);
            if (existingClient && existingClient.id) {
                await clientSheetsService.update(existingClient.id, { 
                    familyId: family.id 
                });
            } else {
                // Create minimal record if it doesn't exist
                await clientSheetsService.create({
                    id: userToAdd.id,
                    email: userToAdd.email,
                    firstName: userToAdd.firstName,
                    lastName: userToAdd.lastName,
                    familyId: family.id,
                    status: 'Registro incompleto',
                    registrationDate: new Date().toISOString(),
                    driveFolderId: updatedUser.driveFolderId || undefined,
                } as any);
            }
        } catch (error) {
            console.error(`Error syncing Sheets for member ${userToAdd.id}:`, error);
        }

        return userService.mapPrismaToUser(updatedUser);
    }

    async removeMember(requestingUserId: string, memberId: string): Promise<void> {
        // 1. Find the member to remove and their family association
        const memberToRemove = await prisma.user.findUnique({
            where: { id: memberId },
            include: { family: true }
        });

        if (!memberToRemove || !memberToRemove.familyId) {
            throw new AppError('El usuario no pertenece a ningún núcleo familiar', 404);
        }

        const family = memberToRemove.family;
        const isSelfRemoving = requestingUserId === memberId;
        const isAdminRemoving = family && requestingUserId === family.adminId;

        // 2. Validate permissions
        if (!isSelfRemoving && !isAdminRemoving) {
            throw new AppError('No tienes permisos para realizar esta acción', 403);
        }

        // 3. Admin restriction: Cannot remove self from this endpoint
        if (isSelfRemoving && family && requestingUserId === family.adminId) {
             throw new AppError('No puedes eliminarte a ti mismo del núcleo familiar. Debes eliminar el núcleo completo.', 400);
        }
        
        // 4. Move user's folder out of the family folder in Drive
        try {
            if (memberToRemove.driveFolderId) {
                const rootId = process.env.GOOGLE_DRIVE_CLIENTS_ROOT_ID;
                if (!rootId) {
                    console.error('GOOGLE_DRIVE_CLIENTS_ROOT_ID is not configured');
                } else {
                    await driveService.moveFolder(memberToRemove.driveFolderId, rootId);
                }
            }
        } catch (error) {
            console.error(`Error moving Drive folder for member ${memberId} out of family folder:`, error);
        }

        // 5. Sync with Sheets: Clear familyId
        try {
            const existingClient = await clientSheetsService.findByEmail(memberToRemove.email);
            if (existingClient && existingClient.id) {
                await clientSheetsService.update(existingClient.id, { 
                    familyId: '' // Clear family association in Sheets
                });
            }
        } catch (error) {
            console.error(`Error syncing Sheets removal for member ${memberId}:`, error);
        }

        // 6. Update Prisma (Source of truth)
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
