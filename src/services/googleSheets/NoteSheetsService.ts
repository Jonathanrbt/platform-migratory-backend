import { BaseRepository } from './BaseRepository';
import { LawyerNote, lawyerNoteSchema } from '../../models/LawyerNote';

export class NoteSheetsService extends BaseRepository<LawyerNote> {
    constructor() {
        super('Notas Abogado', lawyerNoteSchema, 'clientId'); // Assuming clientId can be used for search
    }

    async getLawyerNotes(clientId: string): Promise<LawyerNote[]> {
        await this.ensureInitialized();
        const headerName = this.propertyToHeader.get('clientId');
        const colIndex = this.columnMap.get(headerName || 'id cliente');

        if (colIndex === undefined) return [];

        const rows = await this.getValues('A2:Z');
        return rows
            .filter(r => r[colIndex] === clientId)
            .map(row => this.mapRowToEntity(row));
    }
}
