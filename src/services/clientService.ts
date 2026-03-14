import { ClientSheetsService } from './googleSheets/ClientSheetsService';
import { DriveService } from './googleDrive/driveService';
import { Client } from '../models/Client';
import { v4 as uuidv4 } from 'uuid';
import { AppError } from '../utils/AppError';
import prisma from '../config/prisma';

export class ClientService {
    private clientSheetsService: ClientSheetsService;
    private driveService: DriveService;

    constructor() {
        this.clientSheetsService = new ClientSheetsService();
        this.driveService = new DriveService();
    }

    async getAllClients(options: any) {
        const { page = 1, limit = 20, type, ...sheetOptions } = options;
        
        // Obtenemos todos los clientes de Sheets sin paginar para poder mapear y filtrar por 'type'
        const { clients } = await this.clientSheetsService.getClients(sheetOptions);
        
        // Determinar "Cabeza de familia" consultando Prisma
        const families = await prisma.familyNucleus.findMany({
            select: { adminId: true }
        });
        const adminIds = new Set(families.map(f => f.adminId));

        let mappedClients = clients.map(c => {
            let applicantType = 'Individual';
            if (c.familyId) {
                if (adminIds.has(c.id!)) {
                    applicantType = 'Cabeza de familia';
                } else {
                    applicantType = 'Miembro';
                }
            }

            return {
                id: c.id,
                Nombre: `${c.firstName} ${c.lastName}`.trim(),
                Documento: c.documentNumber || 'N/A',
                Correo: c.email,
                Tipo: applicantType,
                Estado: c.status,
                lastUpdatedDate: c.lastUpdatedDate || c.registrationDate
            };
        });

        if (type) {
            const typesArray = type.split(',').map((t: string) => t.trim().toLowerCase());
            mappedClients = mappedClients.filter(c => typesArray.includes(c.Tipo.toLowerCase()));
        }

        const total = mappedClients.length;
        const start = (page - 1) * limit;
        const end = start + limit;
        const paginatedClients = mappedClients.slice(start, end);

        return { clients: paginatedClients, total };
    }

    async getClientById(id: string) {
        const client = await this.clientSheetsService.findById(id);
        if (!client) {
            throw new AppError('Client not found', 404);
        }
        return client;
    }

    async getClientByEmail(email: string) {
        return await this.clientSheetsService.findByEmail(email);
    }

    async registerClient(clientData: Client, options?: { familyDriveFolderId?: string }) {
        const id = clientData.id || uuidv4();
        const registrationDate = clientData.registrationDate || new Date().toISOString();
        const lastUpdatedDate = registrationDate; // NEW: Set lastUpdatedDate on creation
        let status = clientData.status || 'Registro incompleto';
        let notes = clientData.notes || '';

        // --- Lógica de Negocio ---

        // 2. Regla legal: Fecha de entrada (31/12/2025)
        const limitDate = new Date('2025-12-31');
        const entryDate = new Date(clientData.entryDate);
        let isRejectedByLegalRule = false;
        if (entryDate > limitDate) {
            status = 'Rechazado';
            isRejectedByLegalRule = true;
        }

        // 3. Notas automáticas para antecedentes
        if (clientData.hasCriminalRecord === 'Sí') {
            const systemNote = `[SISTEMA]: Antecedentes declarados en ${clientData.criminalRecordCountry || 'No especificado'} (Fecha aprox: ${clientData.criminalRecordDate || 'No especificada'}).`;
            notes = notes ? `${notes}\n${systemNote}` : systemNote;
        }

        // 3.5 Check for existing Drive Folder ID in Prisma (User table)
        let existingDriveFolderId = clientData.driveFolderId;
        if (!existingDriveFolderId && clientData.email) {
            const user = await prisma.user.findUnique({
                where: { email: clientData.email }
            });
            if (user?.driveFolderId) {
                existingDriveFolderId = user.driveFolderId;
            }
        }

        const newClient: Client = {
            ...clientData,
            id,
            status,
            registrationDate,
            lastUpdatedDate,
            notes,
            driveFolderId: existingDriveFolderId // Ensure it's carried over
        };

        // 4. Guardar en Google Sheets (Incluso si es rechazado por regla legal, para trazabilidad)
        await this.clientSheetsService.create(newClient);

        if (isRejectedByLegalRule) {
            // Informamos al usuario pero el registro ya queda guardado
            throw new AppError('Su solicitud ha sido registrada pero no cumple con el requisito legal de permanencia mínima (entrada antes del 31/12/2025). Un asesor podría contactarle para más detalles.', 400);
        }

        // --- Drive and DB Sync ---
        let finalFolderId: string | undefined = existingDriveFolderId;
        try {
            // 5. Determine parent folder for Drive
            let parentDriveFolderId = options?.familyDriveFolderId;
            if (!parentDriveFolderId && newClient.familyId) {
                const family = await prisma.familyNucleus.findUnique({
                    where: { id: newClient.familyId },
                    select: { driveFolderId: true }
                });
                if (family?.driveFolderId) {
                    parentDriveFolderId = family.driveFolderId;
                }
            }

            // 6. Create structure in Drive
            finalFolderId = await this.driveService.createClientFolderStructure(
                id,
                newClient.firstName,
                newClient.lastName,
                parentDriveFolderId,
                existingDriveFolderId
            );

            // 7. If a new folder was created, update Sheets and Prisma
            if (finalFolderId && finalFolderId !== existingDriveFolderId) {
                await this.clientSheetsService.update(id, { driveFolderId: finalFolderId });
                if (newClient.email) {
                    await prisma.user.update({
                        where: { email: newClient.email },
                        data: { driveFolderId: finalFolderId }
                    });
                }
            }
        } catch (error: any) {
            console.error(`Failed to create Drive structure or update Prisma for client ${id}:`, error);
            
            // Attempt to roll back Sheets update if Drive/Prisma failed after folder creation
            if (finalFolderId && finalFolderId !== existingDriveFolderId) {
                try {
                    await this.clientSheetsService.update(id, { driveFolderId: existingDriveFolderId || '' });
                } catch (rollbackError) {
                    console.error(`CRITICAL: Failed to roll back Sheets update for client ${id}. Data is inconsistent.`, rollbackError);
                }
            }
            
            // Update status to reflect system error
            await this.clientSheetsService.update(id, {
                status: 'Error en Sistema' as any
            });

            // Re-throw the original error
            throw new AppError(error.message || 'Client record created but system sync failed. Please contact support.', 500);
        }

        return newClient;
    }

    async updateClient(id: string, updates: Partial<Client>, user: any) {
        const currentClient = await this.getClientById(id);

        // Business Logic: Role-based validation
        if (user.role === 'Cliente') {
            if (currentClient.email !== user.email) {
                throw new AppError('You can only edit your own profile', 403);
            }

            // El cliente solo puede editar si el registro está incompleto, rechazado o requiere subsanación.
            const allowedStatuses = ['Registro incompleto', 'Requiere subsanación', 'Rechazado'];
            if (!allowedStatuses.includes(currentClient.status || '')) {
                throw new AppError(`You cannot edit your profile when status is ${currentClient.status}`, 403);
            }

            // SECURITY PATCH: Prevent clients from updating sensitive fields
            delete updates.status;
            delete updates.notes;
            delete updates.validations;
            delete updates.lastValidationStatus;
            delete updates.pendingNotesCount;
            delete updates.registrationDate;
            delete updates.familyId;
            delete updates.driveFolderId;
            delete updates.id;

            // Audit log para saber qué campos modificó el cliente
            const updatedFields = Object.keys(updates).filter(key => {
                // Solo registramos si el valor realmente cambió
                return updates[key as keyof Client] !== currentClient[key as keyof Client];
            });

            if (updatedFields.length > 0) {
                const timestamp = new Date().toISOString().slice(0, 16).replace('T', ' ');
                const systemNote = `[${timestamp}] [SISTEMA]: El cliente actualizó los campos: ${updatedFields.join(', ')}`;
                updates.notes = currentClient.notes ? `${currentClient.notes}\n${systemNote}` : systemNote;
            }
        }

        updates.lastUpdatedDate = new Date().toISOString();

        await this.clientSheetsService.update(id, updates);
        return { ...currentClient, ...updates };
    }

    async calculateProgress(clientId: string): Promise<{ formProgress: number, docsProgress: number, totalProgress: number }> {
        const client = await this.getClientById(clientId);
        
        // 1. Form Progress (50%)
        const mandatoryFields = [
            'firstName', 'lastName', 'fechaNacimiento', 'nacionalidad', 
            'countryOfBirth', 'sexo', 'estadoCivil', 'email', 'phone', 
            'direccion', 'province', 'municipality', 'entryDate', 'entryWay', 
            'stayDuration', 'isRegisteredInTownHall', 'hasCriminalRecord'
        ];
        
        let filledFields = 0;
        mandatoryFields.forEach(field => {
            if (client[field as keyof Client] !== undefined && client[field as keyof Client] !== null && client[field as keyof Client] !== '') {
                filledFields++;
            }
        });
        
        const formProgress = filledFields === mandatoryFields.length ? 50 : Math.round((filledFields / mandatoryFields.length) * 50);

        // 2. Documents Progress (50%)
        const mandatoryDocs = [
            'PASAPORTE', 'ANTECEDENTES_PENALES', 'CERTIFICADO_EMPADRONAMIENTO', 'PRUEBA_RESIDENCIA'
        ];
        
        const documents = await prisma.document.findMany({
            where: {
                userId: clientId,
                type: { in: mandatoryDocs as any }
            }
        });

        let validDocs = 0;
        // Solo un documento válido por tipo, que cumpla la regla estricta: VERIFIED y driveFileId existente
        const validDocTypes = new Set();
        
        documents.forEach(doc => {
            if (doc.status === 'VERIFIED' && doc.driveFileId && !validDocTypes.has(doc.type)) {
                validDocs++;
                validDocTypes.add(doc.type);
            }
        });

        const docsProgress = validDocs * 12.5;

        return {
            formProgress,
            docsProgress,
            totalProgress: formProgress + docsProgress
        };
    }

    async submitApplication(clientId: string) {
        const progress = await this.calculateProgress(clientId);
        
        if (progress.totalProgress < 100) {
            throw new AppError(`No se puede enviar la solicitud. El progreso no está al 100% (Actual: ${progress.totalProgress}%)`, 400);
        }

        await this.clientSheetsService.update(clientId, { status: 'En revisión por abogado' });
        return { status: 'success', message: 'Application submitted successfully' };
    }

    async archiveClient(id: string) {
        await this.getClientById(id); // Ensure exists
        await this.clientSheetsService.update(id, { status: 'Archivado' as any });
    }
}
