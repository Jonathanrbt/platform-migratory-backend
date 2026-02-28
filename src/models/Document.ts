import { z } from 'zod';

export const DocumentTypeEnum = z.enum([
    'PASAPORTE',
    'ANTECEDENTES_PENALES',
    'CERTIFICADO_EMPADRONAMIENTO',
    'PRUEBA_RESIDENCIA',
    'OTROS'
]);

export const ValidationStatusEnum = z.enum([
    'VERIFIED',
    'MANUAL_REVIEW',
    'REJECTED'
]);

export const documentSchema = z.object({
    id: z.string().uuid().optional(),
    userId: z.string().uuid(),
    type: DocumentTypeEnum,
    driveFileId: z.string(),
    status: ValidationStatusEnum,
    confidence: z.number().min(0).max(100),
    issues: z.string().optional().nullable(),
    metadata: z.any().optional().nullable(),
    createdAt: z.date().optional(),
    updatedAt: z.date().optional()
});

export type DocumentModel = z.infer<typeof documentSchema>;
