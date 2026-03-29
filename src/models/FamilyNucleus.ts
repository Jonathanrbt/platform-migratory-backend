import { z } from 'zod';
import { userSchema } from './User';

export const familyNucleusSchema = z.object({
    id: z.string().optional().describe('ID unico del nucleo'),
    name: z.string().min(2, 'El nombre del nucleo es requerido').describe('Nombre de la Familia'),
    adminId: z.string().describe('ID del usuario administrador'),
    driveFolderId: z.string().optional().describe('ID de la carpeta en Google Drive'),
    members: z.array(userSchema).optional().describe('Miembros del nucleo familiar'),
    createdAt: z.string().optional().describe('Fecha de creacion'),
    updatedAt: z.string().optional().describe('Fecha de actualizacion'),
});

export type FamilyNucleus = z.infer<typeof familyNucleusSchema>;
