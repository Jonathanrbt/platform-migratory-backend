import { z } from 'zod';

export const clientSchema = z.object({
    id: z.string().optional().describe('ID'),
    // Paso 1: Datos personales
    firstName: z.string().min(2, 'El nombre debe tener al menos 2 caracteres').describe('Nombre'),
    lastName: z.string().min(2, 'Los apellidos deben tener al menos 2 caracteres').describe('Apellidos'),
    fechaNacimiento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de fecha inválido (AAAA-MM-DD)').describe('Fecha Nacimiento'),
    nacionalidad: z.string().min(2, 'Nacionalidad es requerida').describe('Nacionalidad'),
    countryOfBirth: z.string().min(2, 'País de nacimiento es requerido').describe('Pais de Nacimiento'),
    sexo: z.enum(['Masculino', 'Femenino', 'Otro']).describe('Sexo'),
    estadoCivil: z.enum(['Soltero/a', 'Casado/a', 'Divorciado/a', 'Viudo/a', 'Pareja de hecho']).describe('Estado Civil'),
    email: z.string().email('Formato de correo electrónico inválido').describe('Email'),
    phone: z.string().min(7, 'El número de teléfono debe ser válido').describe('Telefono WhatsApp'),
    direccion: z.string().min(5, 'La dirección es requerida').describe('Direccion en España'),
    province: z.string().min(2, 'La provincia es requerida').describe('Provincia'),
    municipality: z.string().min(2, 'El municipio es requerido').describe('Municipio'),

    // Paso 2: Situación en España
    entryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de fecha inválido (AAAA-MM-DD)').describe('Fecha Entrada España'),
    entryWay: z.enum(['Aérea', 'Terrestre', 'Marítima']).describe('Forma de Entrada'),
    stayDuration: z.string().describe('Tiempo Permanencia'),
    isRegisteredInTownHall: z.enum(['Sí', 'No']).describe('Empadronado'),
    townHallRegistrationDate: z.string().optional().describe('Fecha Empadronamiento'),

    // Paso 3: Antecedentes
    hasCriminalRecord: z.enum(['Sí', 'No']).describe('Tiene Antecedentes'),
    criminalRecordCountry: z.string().optional().describe('Pais Antecedentes'),
    criminalRecordDate: z.string().optional().describe('Fecha Antecedentes'),

    // Metadatos y Seguimiento
    status: z.enum([
        'Registro incompleto', 
        'En revisión por abogado', 
        'Pendiente', 
        'En proceso', 
        'Aprobado', 
        'Rechazado', 
        'Rechazado (Regla Legal)',
        'Archivado', 
        'Error en Sistema'
    ]).optional().default('Registro incompleto').describe('Status'),
    registrationDate: z.string().optional().describe('Fecha Registro'),
    lastValidationStatus: z.string().optional().describe('Ultimo Estado Validacion'),
    pendingNotesCount: z.number().optional().describe('Notas Pendientes'),
    validations: z.string().optional().describe('Historial Validaciones'),
    notes: z.string().optional().describe('Historial Notas'),
});

export type Client = z.infer<typeof clientSchema>;

// Note: CLIENT_SHEET_HEADERS is no longer strictly needed if we rely on .describe() 
// but we keep it for reference or legacy compatibility if needed.
export const CLIENT_SHEET_HEADERS = [
    'ID',
    'Nombre',
    'Apellidos',
    'Fecha Nacimiento',
    'Nacionalidad',
    'Pais de Nacimiento',
    'Sexo',
    'Estado Civil',
    'Email',
    'Telefono WhatsApp',
    'Direccion en España',
    'Provincia',
    'Municipio',
    'Fecha Entrada España',
    'Forma de Entrada',
    'Tiempo Permanencia',
    'Empadronado',
    'Fecha Empadronamiento',
    'Tiene Antecedentes',
    'Pais Antecedentes',
    'Fecha Antecedentes',
    'Status',
    'Fecha Registro',
    'Ultimo Estado Validacion',
    'Notas Pendientes',
    'Historial Validaciones',
    'Historial Notas'
];
