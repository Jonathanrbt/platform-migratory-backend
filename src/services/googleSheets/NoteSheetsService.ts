import { BaseRepository } from './BaseRepository';
import { ClientSheetsService } from './ClientSheetsService';
import { LawyerNote, lawyerNoteSchema } from '../../models/LawyerNote';
import { v4 as uuidv4 } from 'uuid';

export class NoteSheetsService extends BaseRepository<LawyerNote> {
    private clientSheetsService: ClientSheetsService;

    constructor() {
        super('NotasAbogado', lawyerNoteSchema, 'id');
        this.clientSheetsService = new ClientSheetsService();
    }

    async createNote(noteData: LawyerNote): Promise<LawyerNote> {
        const id = noteData.id || uuidv4();
        const date = noteData.date || new Date().toISOString();
        const newNote: LawyerNote = { ...noteData, id, date };

        // Añadir registro en la hoja de NotasAbogado
        await this.create(newNote);

        // Actualizar contador en la hoja del Cliente
        await this.updatePendingNotesCount(newNote.clientId);

        return newNote;
    }

    async getLawyerNotes(clientId: string): Promise<LawyerNote[]> {
        const allNotes = await this.findAll();
        return allNotes.filter(n => n.clientId === clientId);
    }

    async updateNoteStatus(noteId: string, status: 'Pending' | 'Resolved', clientId: string): Promise<LawyerNote> {
        const allNotes = await this.findAll();
        const note = allNotes.find(n => n.id === noteId && n.clientId === clientId);
        
        if (!note) {
            throw new Error('Note not found or you do not have permission to modify it');
        }

        await this.update(noteId, { status });
        await this.updatePendingNotesCount(clientId);

        return { ...note, status };
    }

    private async updatePendingNotesCount(clientId: string): Promise<void> {
        const clientNotes = await this.getLawyerNotes(clientId);
        const pendingCount = clientNotes.filter(n => n.status === 'Pending').length;
        await this.clientSheetsService.update(clientId, { pendingNotesCount: pendingCount });
    }
}
