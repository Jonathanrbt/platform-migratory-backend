import { BaseRepository } from './BaseRepository';
import { Client, clientSchema } from '../../models/Client';
import { AppError } from '../../utils/AppError';

export class ClientSheetsService extends BaseRepository<Client> {
    constructor() {
        super('Clientes', clientSchema, 'id');
    }

    async getClients(options: { 
        page?: number; 
        limit?: number; 
        status?: string; 
        search?: string; 
        sort?: string;
    } = {}): Promise<{ clients: Client[]; total: number }> {
        let clients = await this.findAll();

        if (options.status) {
            clients = clients.filter(c => 
                c.status?.toLowerCase() === options.status?.toLowerCase()
            );
        }

        if (options.search) {
            const search = options.search.toLowerCase();
            clients = clients.filter(c => 
                Object.values(c).some(val => 
                    val?.toString().toLowerCase().includes(search)
                )
            );
        }

        if (options.sort) {
            const isDescending = options.sort.startsWith('-');
            const field = (isDescending ? options.sort.substring(1) : options.sort) as keyof Client;
            
            clients.sort((a, b) => {
                const valA = (a[field] || '').toString().toLowerCase();
                const valB = (b[field] || '').toString().toLowerCase();
                if (valA < valB) return isDescending ? 1 : -1;
                if (valA > valB) return isDescending ? -1 : 1;
                return 0;
            });
        }

        const total = clients.length;

        if (options.page && options.limit) {
            const start = (options.page - 1) * options.limit;
            const end = start + options.limit;
            clients = clients.slice(start, end);
        }

        return { clients, total };
    }

    async findByEmail(email: string): Promise<Client | null> {
        await this.ensureInitialized();
        const headerName = this.propertyToHeader.get('email');
        const colIndex = this.columnMap.get(headerName || 'email');

        if (colIndex === undefined) {
            throw new AppError(`Email column not found`, 500);
        }

        const rows = await this.getValues('A2:AZ');
        const row = rows.find(r => r[colIndex]?.toLowerCase() === email.toLowerCase());
        
        return row ? this.mapRowToEntity(row) : null;
    }

    // addClient, updateClient, deleteClient are now handled by BaseRepository!
}
