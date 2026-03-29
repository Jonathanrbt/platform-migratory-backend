import { z } from 'zod';

export const userSchema = z.object({
    id: z.string().optional().describe('ID unico del usuario'),
    email: z.string().email('Formato de email invalido').describe('Email del usuario'),
    password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres').optional().describe('Contraseña en texto plano (solo para registro/login)'),
    passwordHash: z.string().optional().describe('Hash de la contraseña'),
    role: z.enum(['Cliente', 'Abogado']).default('Cliente').describe('Rol del usuario'),
    firstName: z.string().min(2, 'El nombre debe tener al menos 2 caracteres').describe('Nombre'),
    lastName: z.string().min(2, 'El apellido debe tener al menos 2 caracteres').describe('Apellido'),
    googleId: z.string().optional().describe('ID de Google (para OAuth)'),
    registrationDate: z.string().optional().describe('Fecha de registro'),
    documentNumber: z.string().optional().describe('Numero de Documento'),
    documentType: z.string()
        .optional()
        .transform((val) => val ? val.trim().toUpperCase() : val)
        .describe('Tipo de Documento (DNI, NIE, Pasaporte, TIE o personalizado)'),
    familyId: z.string().optional().describe('ID del Nucleo Familiar'),
    documentsUploaded: z.boolean().default(false).describe('Documentos Subidos'),
    driveFolderId: z.string().optional().describe('ID de la carpeta personal en Drive'),
});

export type User = z.infer<typeof userSchema>;

export const loginSchema = z.object({
    email: z.string().email('Formato de email invalido'),
    password: z.string().min(1, 'La contraseña es requerida'),
});

export const googleLoginSchema = z.object({
    idToken: z.string().min(1, 'El token de ID de Google es requerido'),
});

export const completeProfileSchema = z.object({
    documentType: z.string().min(1, 'El tipo de documento es requerido'),
    documentNumber: z.string().min(1, 'El número de documento es requerido'),
});
