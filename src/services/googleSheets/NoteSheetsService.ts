import { ClientSheetsService } from './ClientSheetsService';
import { LawyerNote } from '../../models/LawyerNote';
import { AppError } from '../../utils/AppError';

export class NoteSheetsService {
    private clientSheetsService: ClientSheetsService;

    constructor() {
        this.clientSheetsService = new ClientSheetsService();
    }

    async create(note: LawyerNote): Promise<void> {
        const client = await this.clientSheetsService.findById(note.clientId);
        if (!client) {
            throw new AppError(`Client with ID ${note.clientId} not found`, 404);
        }

        // Parse existing notes or start with empty array
        const currentNotes: LawyerNote[] = client.notes 
            ? JSON.parse(client.notes) 
            : [];

        // Add new note
        currentNotes.push({
            ...note,
            date: note.date || new Date().toISOString()
        });

        // Calculate pending notes
        const pendingCount = currentNotes.filter(n => n.status === 'Pending').length;

        // Update client row
        await this.clientSheetsService.update(note.clientId, {
            notes: JSON.stringify(currentNotes),
            pendingNotesCount: pendingCount
        });
    }

    async getLawyerNotes(clientId: string): Promise<LawyerNote[]> {
        const client = await this.clientSheetsService.findById(clientId);
        if (!client || !client.notes) return [];

        try {
            return JSON.parse(client.notes);
        } catch (error) {
            console.error(`Error parsing notes for client ${clientId}:`, error);
            return [];
        }
    }
}
