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

    async registerClient(clientData: Client) {
        const id = clientData.id || uuidv4();
        const registrationDate = clientData.registrationDate || new Date().toISOString();
        const status = clientData.status || 'Registro incompleto';

        const newClient: Client = {
            ...clientData,
            id,
            status,
            registrationDate
        };

        // 1. Save to Google Sheets
        await this.clientSheetsService.create(newClient);

        try {
            // 2. Create Drive structure
            await this.driveService.createClientFolderStructure(id);
        } catch (error) {
            // "Manual Rollback": If drive fails, we flag the client
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

            const allowedStatuses = ['Registro incompleto', 'En revisión por abogado'];
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
