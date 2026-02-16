import { ClientSheetsService } from './googleSheets/ClientSheetsService';
import { DriveService } from './googleDrive/driveService';
import { Client } from '../models/Client';
import { v4 as uuidv4 } from 'uuid';
import { AppError } from '../utils/AppError';

export class ClientService {
    private clientSheetsService: ClientSheetsService;
    private driveService: DriveService;

    constructor() {
        this.clientSheetsService = new ClientSheetsService();
        this.driveService = new DriveService();
    }

    async getAllClients(options: any) {
        return await this.clientSheetsService.getClients(options);
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

    async registerClient(clientData: Client) {
        const id = clientData.id || uuidv4();
        const registrationDate = clientData.registrationDate || new Date().toISOString();
        let status = clientData.status || 'Registro incompleto';
        let notes = clientData.notes || '';

        // --- Lógica de Negocio ---

        // 1. Validación de mayoría de edad (Opcional si Zod no lo hace, pero recomendable aquí)
        const birthDate = new Date(clientData.fechaNacimiento);
        const today = new Date();
        let age = today.getFullYear() - birthDate.getFullYear();
        const m = today.getMonth() - birthDate.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
            age--;
        }
        if (age < 18) {
            throw new AppError('El solicitante debe ser mayor de edad.', 400);
        }

        // 2. Regla legal: Fecha de entrada (31/12/2025)
        const limitDate = new Date('2025-12-31');
        const entryDate = new Date(clientData.entryDate);
        let isRejectedByLegalRule = false;
        if (entryDate > limitDate) {
            status = 'Rechazado (Regla Legal)';
            isRejectedByLegalRule = true;
        }

        // 3. Notas automáticas para antecedentes
        if (clientData.hasCriminalRecord === 'Sí') {
            const systemNote = `[SISTEMA]: Antecedentes declarados en ${clientData.criminalRecordCountry || 'No especificado'} (Fecha aprox: ${clientData.criminalRecordDate || 'No especificada'}).`;
            notes = notes ? `${notes}\n${systemNote}` : systemNote;
        }

        const newClient: Client = {
            ...clientData,
            id,
            status,
            registrationDate,
            notes
        };

        // 4. Guardar en Google Sheets (Incluso si es rechazado por regla legal, para trazabilidad)
        await this.clientSheetsService.create(newClient);

        if (isRejectedByLegalRule) {
            // Informamos al usuario pero el registro ya queda guardado
            throw new AppError('Su solicitud ha sido registrada pero no cumple con el requisito legal de permanencia mínima (entrada antes del 31/12/2025). Un asesor podría contactarle para más detalles.', 400);
        }

        try {
            // 5. Crear estructura en Drive (Solo si no fue rechazado de entrada por regla legal, opcional)
            await this.driveService.createClientFolderStructure(id, newClient.firstName, newClient.lastName);
        } catch (error) {
            console.error(`Failed to create Drive structure for client ${id}:`, error);
            await this.clientSheetsService.update(id, { 
                status: 'Error en Sistema' as any 
            });
            throw new AppError('Client record created but Drive folder structure failed. Please contact support.', 500);
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

            // El cliente solo puede editar si el registro está incompleto.
            // Una vez en revisión o aprobado, ya no puede editar.
            const allowedStatuses = ['Registro incompleto'];
            if (!allowedStatuses.includes(currentClient.status || '')) {
                throw new AppError(`You cannot edit your profile when status is ${currentClient.status}`, 403);
            }
        }

        await this.clientSheetsService.update(id, updates);
        return { ...currentClient, ...updates };
    }

    async archiveClient(id: string) {
        await this.getClientById(id); // Ensure exists
        await this.clientSheetsService.update(id, { status: 'Archivado' as any });
    }
}
