import { ClientSheetsService } from './ClientSheetsService';
import { Validation } from '../../models/Validation';
import { AppError } from '../../utils/AppError';

export class ValidationSheetsService {
    private clientSheetsService: ClientSheetsService;

    constructor() {
        this.clientSheetsService = new ClientSheetsService();
    }

    async create(validation: Validation): Promise<void> {
        const client = await this.clientSheetsService.findById(validation.clientId);
        if (!client) {
            throw new AppError(`Client with ID ${validation.clientId} not found`, 404);
        }

        // Parse existing validations or start with empty array
        const currentValidations: Validation[] = client.validations 
            ? JSON.parse(client.validations) 
            : [];

        // Add new validation
        currentValidations.push({
            ...validation,
            date: validation.date || new Date().toISOString()
        });

        // Update client row with new validations JSON and summary status
        await this.clientSheetsService.update(validation.clientId, {
            validations: JSON.stringify(currentValidations),
            lastValidationStatus: validation.result === 'Pass' ? 'Aprobado' : 'Rechazado'
        });
    }

    async findByClientId(clientId: string): Promise<Validation[]> {
        const client = await this.clientSheetsService.findById(clientId);
        if (!client || !client.validations) return [];
        
        try {
            return JSON.parse(client.validations);
        } catch (error) {
            console.error(`Error parsing validations for client ${clientId}:`, error);
            return [];
        }
    }
}
