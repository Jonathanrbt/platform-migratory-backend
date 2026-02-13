import { z } from 'zod';

export const lawyerNoteSchema = z.object({
    clientId: z.string().describe('ID Cliente'),
    lawyerName: z.string().describe('Abogado'),
    category: z.enum(['Revisión', 'Entrevista', 'Alerta', 'General']).describe('Categoría'),
    note: z.string().min(1, 'Note content cannot be empty').describe('Nota'),
    priority: z.enum(['High', 'Medium', 'Low']).describe('Prioridad'),
    status: z.enum(['Pending', 'Resolved']).describe('Estado'),
    date: z.string().optional().describe('Fecha'),
});

export type LawyerNote = z.infer<typeof lawyerNoteSchema>;

export const LAWYER_NOTE_SHEET_HEADERS = [
    'ID Cliente',
    'Abogado',
    'Categoría',
    'Nota',
    'Prioridad',
    'Estado',
    'Fecha'
];
