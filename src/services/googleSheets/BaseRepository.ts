import { google } from 'googleapis';
import { googleConfig } from '../../config/google';
import { AppError } from '../../utils/AppError';
import { z } from 'zod';

export abstract class BaseRepository<T extends Record<string, any>> {
    protected auth;
    protected sheets;
    protected spreadsheetId: string;
    protected sheetName: string;
    protected schema: z.ZodObject<any>;
    protected pkField: keyof T;
    
    // Cache for column mapping: { headerName: columnIndex }
    protected columnMap: Map<string, number> = new Map();
    // Map of { propertyName: headerName } from Zod .describe()
    protected propertyToHeader: Map<string, string> = new Map();

    constructor(sheetName: string, schema: z.ZodObject<any>, pkField: keyof T) {
        this.sheetName = sheetName;
        this.schema = schema;
        this.pkField = pkField;
        this.spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID || '';

        if (!googleConfig.clientEmail || !googleConfig.privateKey || !this.spreadsheetId) {
            throw new Error('Google Sheets configuration is missing in environment variables');
        }

        this.auth = new google.auth.GoogleAuth({
            credentials: {
                client_email: googleConfig.clientEmail,
                private_key: googleConfig.privateKey,
                project_id: googleConfig.projectId,
            },
            scopes: ['https://www.googleapis.com/auth/spreadsheets'],
        });

        this.sheets = google.sheets({ version: 'v4', auth: this.auth });
        this.initializePropertyMap();
    }

    /**
     * Extracts header names from Zod schema .describe() metadata
     */
    private initializePropertyMap() {
        const shape = this.schema.shape;
        for (const key in shape) {
            const description = shape[key]._def.description;
            if (description) {
                this.propertyToHeader.set(key, description.toLowerCase().trim());
            }
        }
    }

    /**
     * Initializes the column mapping by reading the first row of the sheet
     */
    protected async ensureInitialized() {
        if (this.columnMap.size > 0) return;

        try {
            const response = await this.sheets.spreadsheets.values.get({
                spreadsheetId: this.spreadsheetId,
                range: `${this.sheetName}!A1:Z1`,
            });

            const headers = response.data.values?.[0] || [];
            headers.forEach((header: string, index: number) => {
                this.columnMap.set(header.toLowerCase().trim(), index);
            });

            // Verify that all required headers from schema exist in the sheet
            for (const [prop, header] of this.propertyToHeader.entries()) {
                if (!this.columnMap.has(header)) {
                    console.warn(`Warning: Header "${header}" for property "${prop}" not found in sheet "${this.sheetName}"`);
                }
            }
        } catch (error: any) {
            throw new AppError(`Failed to initialize repository for ${this.sheetName}: ${error.message}`, 500);
        }
    }

    protected async getValues(range: string) {
        try {
            const response = await this.sheets.spreadsheets.values.get({
                spreadsheetId: this.spreadsheetId,
                range: `${this.sheetName}!${range}`,
            });
            return response.data.values || [];
        } catch (error: any) {
            throw new AppError(`Error reading from Google Sheets (${this.sheetName}): ${error.message}`, 500);
        }
    }

    protected mapRowToEntity(row: any[]): T {
        const entity: any = {};
        for (const [prop, header] of this.propertyToHeader.entries()) {
            const colIndex = this.columnMap.get(header);
            if (colIndex !== undefined && row[colIndex] !== undefined) {
                entity[prop] = row[colIndex];
            }
        }
        return this.schema.parse(entity) as T;
    }

    protected mapEntityToRow(entity: T, existingRow: any[] = []): any[] {
        const row = existingRow.length > 0 ? [...existingRow] : [];
        
        // Ensure row is long enough to cover all columns
        const maxIndex = Math.max(...Array.from(this.columnMap.values()), 0);
        while (row.length <= maxIndex) row.push('');

        for (const [prop, header] of this.propertyToHeader.entries()) {
            const colIndex = this.columnMap.get(header);
            if (colIndex !== undefined && entity[prop] !== undefined) {
                row[colIndex] = entity[prop];
            }
        }
        return row;
    }

    async findAll(): Promise<T[]> {
        await this.ensureInitialized();
        const rows = await this.getValues('A2:Z');
        return rows.map(row => {
            try {
                return this.mapRowToEntity(row);
            } catch (err) {
                console.error(`Error parsing row in ${this.sheetName}:`, err);
                return null;
            }
        }).filter((item): item is T => item !== null);
    }

    async findById(id: string): Promise<T | null> {
        await this.ensureInitialized();
        const headerName = this.propertyToHeader.get(this.pkField as string);
        const colIndex = this.columnMap.get(headerName || '');

        if (colIndex === undefined) {
            throw new AppError(`Primary key column "${headerName}" not found`, 500);
        }

        const rows = await this.getValues('A2:Z');
        const row = rows.find(r => r[colIndex] === id);
        
        return row ? this.mapRowToEntity(row) : null;
    }

    async create(entity: T): Promise<void> {
        await this.ensureInitialized();
        const validated = this.schema.parse(entity) as T;
        const row = this.mapEntityToRow(validated);

        try {
            await this.sheets.spreadsheets.values.append({
                spreadsheetId: this.spreadsheetId,
                range: `${this.sheetName}!A:A`,
                valueInputOption: 'USER_ENTERED',
                requestBody: { values: [row] },
            });
        } catch (error: any) {
            throw new AppError(`Error creating record in ${this.sheetName}: ${error.message}`, 500);
        }
    }

    async update(id: string, updates: Partial<T>): Promise<void> {
        await this.ensureInitialized();
        
        const headerName = this.propertyToHeader.get(this.pkField as string);
        const colIndex = this.columnMap.get(headerName || '');
        
        const rows = await this.getValues('A:Z');
        const rowIndex = rows.findIndex(r => r[colIndex!] === id);

        if (rowIndex === -1) {
            throw new AppError(`Record with ID ${id} not found in ${this.sheetName}`, 404);
        }

        const currentRow = rows[rowIndex];
        const currentEntity = this.mapRowToEntity(currentRow);
        const updatedEntity = { ...currentEntity, ...updates };
        
        const updatedRow = this.mapEntityToRow(updatedEntity, currentRow);

        try {
            await this.sheets.spreadsheets.values.update({
                spreadsheetId: this.spreadsheetId,
                range: `${this.sheetName}!A${rowIndex + 1}:Z${rowIndex + 1}`,
                valueInputOption: 'USER_ENTERED',
                requestBody: { values: [updatedRow] },
            });
        } catch (error: any) {
            throw new AppError(`Error updating record in ${this.sheetName}: ${error.message}`, 500);
        }
    }
}
