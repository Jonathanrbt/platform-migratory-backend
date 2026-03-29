import { z } from 'zod';

export const validationSchema = z.object({
    clientId: z.string().describe('ID Cliente'),
    documentId: z.string().describe('ID Documento'),
    type: z.string().describe('Tipo'), // Keeping as string to allow flexible types but adding comments for clarity
    result: z.enum(['Pass', 'Fail', 'Warning']).describe('Resultado'),
    confidence: z.number().min(0).max(1).describe('Confianza'),
    details: z.string().optional().describe('Detalles'),
    action: z.enum(['None', 'Re-upload', 'Manual Review']).describe('Acción'),
    date: z.string().optional().describe('Fecha'),
});

export type Validation = z.infer<typeof validationSchema>;

export const VALIDATION_SHEET_HEADERS = [
    'ID Cliente',
    'ID Documento',
    'Tipo',
    'Resultado',
    'Confianza',
    'Detalles',
    'Acción',
    'Fecha'
];
