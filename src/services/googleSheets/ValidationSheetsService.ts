import { BaseRepository } from './BaseRepository';
import { Validation, validationSchema } from '../../models/Validation';
import { AppError } from '../../utils/AppError';
import { ClientSheetsService } from './ClientSheetsService';

export class ValidationSheetsService extends BaseRepository<Validation> {
    private clientSheetsService: ClientSheetsService;

    constructor() {
        super('Validaciones', validationSchema, 'documentId');
        this.clientSheetsService = new ClientSheetsService();
    }

    async create(validation: Validation): Promise<void> {
        // 1. Ensure initialization and mapping
        await this.ensureInitialized();

        // 2. Verify client exists (optional but good for integrity)
        const client = await this.clientSheetsService.findById(validation.clientId);
        if (!client) {
            console.warn(`Client with ID ${validation.clientId} not found in Sheets when recording validation.`);
        }

        // 3. Find if a record for this client and document type already exists
        const clientColHeader = this.propertyToHeader.get('clientId');
        const typeColHeader = this.propertyToHeader.get('type');
        
        const clientColIndex = this.columnMap.get(clientColHeader || 'clientId');
        const typeColIndex = this.columnMap.get(typeColHeader || 'type');

        const rows = await this.getValues('A:AZ');
        const rowIndex = rows.findIndex((row, idx) => {
            if (idx === 0) return false; // Skip headers
            return row[clientColIndex!] === validation.clientId && row[typeColIndex!] === validation.type;
        });

        const validationWithDate = {
            ...validation,
            date: validation.date || new Date().toISOString()
        };

        if (rowIndex !== -1) {
            // Update existing row
            const validated = this.schema.parse(validationWithDate) as Validation;
            const updatedRow = this.mapEntityToRow(validated, rows[rowIndex]);
            
            try {
                await this.sheets.spreadsheets.values.update({
                    spreadsheetId: this.spreadsheetId,
                    range: `${this.sheetName}!A${rowIndex + 1}:AZ${rowIndex + 1}`,
                    valueInputOption: 'USER_ENTERED',
                    requestBody: { values: [updatedRow] },
                });
            } catch (error: any) {
                throw new AppError(`Error updating validation record in ${this.sheetName}: ${error.message}`, 500);
            }
        } else {
            // Create new row
            await super.create(validationWithDate);
        }

        // 4. Update summary in Client row for quick view
        if (client) {
            await this.clientSheetsService.update(validation.clientId, {
                lastValidationStatus: validation.result === 'Pass' ? 'Aprobado' : 'Rechazado'
            });
        }
    }

    async findByClientId(clientId: string): Promise<Validation[]> {
        await this.ensureInitialized();
        const headerName = this.propertyToHeader.get('clientId');
        const colIndex = this.columnMap.get(headerName || 'clientId');

        if (colIndex === undefined) {
            return [];
        }

        const rows = await this.getValues('A2:AZ');
        return rows
            .filter(r => r[colIndex] === clientId)
            .map(row => this.mapRowToEntity(row));
    }

    async clearValidationRow(clientId: string, type: string): Promise<void> {
        await this.ensureInitialized();

        const clientColHeader = this.propertyToHeader.get('clientId');
        const typeColHeader = this.propertyToHeader.get('type');
        
        const clientColIndex = this.columnMap.get(clientColHeader || 'clientId');
        const typeColIndex = this.columnMap.get(typeColHeader || 'type');

        const rows = await this.getValues('A:AZ');
        const rowIndex = rows.findIndex((row, idx) => {
            if (idx === 0) return false; // Skip headers
            return row[clientColIndex!] === clientId && row[typeColIndex!] === type;
        });

        if (rowIndex !== -1) {
            const maxCols = Math.max(...Array.from(this.columnMap.values()), 0);
            const emptyRow = new Array(maxCols + 1).fill('');
            
            try {
                await this.sheets.spreadsheets.values.update({
                    spreadsheetId: this.spreadsheetId,
                    range: `${this.sheetName}!A${rowIndex + 1}:AZ${rowIndex + 1}`,
                    valueInputOption: 'USER_ENTERED',
                    requestBody: { values: [emptyRow] },
                });
                console.log(`[ValidationSheetsService] Cleared validation row for clientId: ${clientId}, type: ${type}`);
            } catch (error: any) {
                throw new AppError(`Error clearing validation record in ${this.sheetName}: ${error.message}`, 500);
            }
        } else {
            console.log(`[ValidationSheetsService] Row not found to clear for clientId: ${clientId}, type: ${type}`);
        }
    }
}
