import { z } from 'zod';

export const clientSchema = z.object({
    id: z.string().optional().describe('ID'),
    firstName: z.string().min(2, 'El nombre debe tener al menos 2 caracteres').describe('First Name'),
    lastName: z.string().min(2, 'Los apellidos deben tener al menos 2 caracteres').describe('Last Name'),
    nacionalidad: z.string().min(2, 'Nacionalidad es requerida y debe ser válida').describe('Nacionalidad'),
    fechaNacimiento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de fecha inválido (AAAA-MM-DD)').describe('Fecha Nacimiento'),
    sexo: z.enum(['Masculino', 'Femenino', 'Otro']).describe('Sexo'),
    estadoCivil: z.enum(['Soltero/a', 'Casado/a', 'Divorciado/a', 'Viudo/a', 'Pareja de hecho']).describe('Estado Civil'),
    email: z.string().email('Formato de correo electrónico inválido').describe('Email'),
    phone: z.string().min(7, 'El número de teléfono debe ser válido').describe('Phone'),
    direccion: z.string().min(10, 'La dirección debe ser completa (mínimo 10 caracteres)').describe('Direccion'),
    status: z.enum(['Registro incompleto', 'En revisión por abogado', 'Pendiente', 'En proceso', 'Aprobado', 'Rechazado', 'Archivado', 'Error en Sistema']).optional().default('Registro incompleto').describe('Status'),
    registrationDate: z.string().optional().describe('Registration Date'),
});

export type Client = z.infer<typeof clientSchema>;

// Mapping between object keys and Sheet headers (Column names)
export const CLIENT_SHEET_HEADERS = [
    'ID',
    'First Name',
    'Last Name',
    'Nacionalidad',
    'Fecha Nacimiento',
    'Sexo',
    'Estado Civil',
    'Email',
    'Phone',
    'Direccion',
    'Status',
    'Registration Date'
];
