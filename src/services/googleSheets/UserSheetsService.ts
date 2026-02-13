import { BaseRepository } from './BaseRepository';
import { User, userSchema } from '../../models/User';

export class UserSheetsService extends BaseRepository<User> {
    constructor() {
        super('Usuarios', userSchema, 'id');
    }

    async getUserByEmail(email: string): Promise<User | null> {
        await this.ensureInitialized();
        const headerName = this.propertyToHeader.get('email');
        const colIndex = this.columnMap.get(headerName || 'email');

        if (colIndex === undefined) return null;

        const rows = await this.getValues('A2:Z');
        const row = rows.find(r => r[colIndex]?.toLowerCase() === email.toLowerCase());
        
        return row ? this.mapRowToEntity(row) : null;
    }
}
