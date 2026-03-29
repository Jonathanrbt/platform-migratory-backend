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
            let current = shape[key];
            let description = current.description;
            
            // Traverse down through optional, nullable, default, etc. if description is missing
            while (!description && current._def.innerType) {
                current = current._def.innerType;
                description = current.description;
            }

            if (description) {
                this.propertyToHeader.set(key, description.toLowerCase().trim());
            }
        }
    }

    /**
     * Initializes the column mapping by reading the first row of the sheet.
     * If headers are missing, it initializes them based on the schema descriptions.
     */
    protected async ensureInitialized() {
        if (this.columnMap.size > 0) return;

        try {
            let headers: any[] = [];
            
            try {
                const response = await this.sheets.spreadsheets.values.get({
                    spreadsheetId: this.spreadsheetId,
                    range: `${this.sheetName}!A1:AZ1`,
                });
                headers = response.data.values?.[0] || [];
            } catch (error: any) {
                if (error.message && error.message.includes('Unable to parse range')) {
                    console.log(`Sheet "${this.sheetName}" not found. Creating it...`);
                    await this.sheets.spreadsheets.batchUpdate({
                        spreadsheetId: this.spreadsheetId,
                        requestBody: {
                            requests: [{
                                addSheet: {
                                    properties: { title: this.sheetName }
                                }
                            }]
                        }
                    });
                    // Headers will be empty, so they will be initialized in the next step
                } else {
                    throw error;
                }
            }

            // If headers are missing or sheet is empty, initialize them
            if (headers.length === 0 || headers.every((h: any) => !h)) {
                headers = Array.from(this.propertyToHeader.values())
                    .map(h => h.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' '));
                
                await this.sheets.spreadsheets.values.update({
                    spreadsheetId: this.spreadsheetId,
                    range: `${this.sheetName}!A1`,
                    valueInputOption: 'USER_ENTERED',
                    requestBody: { values: [headers] },
                });
            }

            headers.forEach((header: string, index: number) => {
                if (header) {
                    this.columnMap.set(header.toLowerCase().trim(), index);
                }
            });

            // Double check: if a property doesn't have a column, the repository won't work correctly
            let missingHeadersAdded = false;
            for (const [prop, header] of this.propertyToHeader.entries()) {
                if (!this.columnMap.has(header)) {
                    console.warn(`Warning: Header "${header}" for property "${prop}" not found in sheet "${this.sheetName}". Adding it...`);
                    // Format the header for display (capitalize first letter of each word)
                    const displayHeader = header.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
                    headers.push(displayHeader);
                    this.columnMap.set(header, headers.length - 1);
                    missingHeadersAdded = true;
                }
            }

            if (missingHeadersAdded) {
                await this.sheets.spreadsheets.values.update({
                    spreadsheetId: this.spreadsheetId,
                    range: `${this.sheetName}!A1`,
                    valueInputOption: 'USER_ENTERED',
                    requestBody: { values: [headers] },
                });
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
                let value = row[colIndex];
                
                // Determine if the field is a number or boolean by checking its Zod type
                const fieldSchema = this.schema.shape[prop];
                let isNumber = prop === 'pendingNotesCount' || prop === 'confidence'; // Manual override for these
                let isBoolean = false;
                let current = fieldSchema;
                
                while (!isNumber && current) {
                    const typeName = current._def?.typeName;
                    const className = current.constructor.name;
                    
                    if (typeName === 'ZodNumber' || className === 'ZodNumber') {
                        isNumber = true;
                        break;
                    }

                    if (current._def?.innerType) {
                        current = current._def.innerType;
                    } else if (current._def?.schema) {
                        current = current._def.schema;
                    } else {
                        break;
                    }
                }

                if (isNumber) {
                    if (value === '' || value === undefined || value === null) {
                        value = 0; // Default to 0 for missing numeric values
                    } else {
                        const parsed = Number(value);
                        if (!isNaN(parsed)) {
                            value = parsed;
                        }
                    }
                }

                entity[prop] = value;
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
        const rows = await this.getValues('A2:AZ');
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

        const rows = await this.getValues('A2:AZ');
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
        
        const rows = await this.getValues('A:AZ');
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
                range: `${this.sheetName}!A${rowIndex + 1}:AZ${rowIndex + 1}`,
                valueInputOption: 'USER_ENTERED',
                requestBody: { values: [updatedRow] },
            });
        } catch (error: any) {
            throw new AppError(`Error updating record in ${this.sheetName}: ${error.message}`, 500);
        }
    }
}
