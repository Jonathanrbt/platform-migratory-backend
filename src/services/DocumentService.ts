import { DocumentType, ValidationStatus } from '@prisma/client';
import { DocumentTypeEnum, ValidationStatusEnum, DocumentModel } from '../models/Document';
import { GeminiService } from './ai/geminiService';
import { DriveService } from './googleDrive/driveService';
import { ValidationSheetsService } from './googleSheets/ValidationSheetsService';
import prisma from '../config/prisma';
import { AppError } from '../utils/AppError';
import path from 'path';
import { ClientService } from './clientService';
import { emailService } from './EmailService';

const FOLDER_MAPPING: Record<string, string> = {
    'PASAPORTE': '01_Identidad',
    'ANTECEDENTES_PENALES': '02_Antecedentes',
    'CERTIFICADO_EMPADRONAMIENTO': '03_Pruebas_Residencia',
    'PRUEBA_RESIDENCIA': '03_Pruebas_Residencia',
    'OTROS': '04_Otros'
};

export class DocumentService {
    private geminiService: GeminiService;
    private driveService: DriveService;
    private validationSheetsService: ValidationSheetsService;

    constructor() {
        this.geminiService = new GeminiService();
        this.driveService = new DriveService();
        this.validationSheetsService = new ValidationSheetsService();
    }

    async uploadDocument(userId: string, file: Express.Multer.File, docTypeString: string): Promise<any> {
        console.log(`[DocumentService] Starting upload for user: ${userId}, Type: ${docTypeString}, File: ${file?.originalname}`);
        
        // 1. Validate inputs
        const docType = DocumentTypeEnum.parse(docTypeString);
        if (!file) throw new AppError('No file uploaded', 400);

        // 2. Fetch user early to avoid redundant queries
        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user) {
            console.error(`[DocumentService] User not found: ${userId}`);
            throw new AppError('Usuario no encontrado', 404);
        }

        // 3. AI Analysis
        console.log(`[DocumentService] Sending to Gemini for AI analysis...`);
        const analysis = await this.geminiService.analyzeDocument(file.buffer, file.mimetype, docType);
        console.log(`[DocumentService] AI Analysis result:`, JSON.stringify(analysis, null, 2));
        
        // 4. Traffic Light Logic - Confidence is already 0-100
        const confidence = analysis.confidenceScore || 0;
        
        const isValid = analysis.isValid;
        const checks = analysis.validationChecks || {};
        
        const looksAltered = checks.looksAltered || false;
        const isReadable = checks.isReadable || false;
        let isExpired = checks.isExpired || false;

        if (docType === 'PRUEBA_RESIDENCIA' || docType === 'OTROS') {
            isExpired = false;
        }

        let status: 'GREEN' | 'YELLOW' | 'RED' = 'RED';
        let resultLabel: 'Pass' | 'Fail' | 'Warning' = 'Fail';
        let action: 'None' | 'Re-upload' | 'Manual Review' = 'Re-upload';
        let rejectionReason = analysis.rejectionReason || 'Error desconocido';
        const suggestedAction = analysis.suggestedAction || 'Por favor, contacte con soporte.';

        if (isValid && confidence >= 90 && !looksAltered && isReadable && !isExpired) {
            status = 'GREEN';
            resultLabel = 'Pass';
            action = 'None';
        } else if ((confidence >= 70 && confidence < 90) || looksAltered || !isReadable) {
            status = 'YELLOW';
            resultLabel = 'Warning';
            action = 'Manual Review';
            rejectionReason = analysis.rejectionReason || (looksAltered ? 'El documento parece alterado digitalmente' : (!isReadable ? 'El documento es borroso o ilegible' : 'Baja confianza en la validación automática'));
        } else {
            status = 'RED';
            resultLabel = 'Fail';
            action = 'Re-upload';
            rejectionReason = analysis.rejectionReason || (isExpired ? 'El documento ha caducado' : 'Validación fallida');
        }

        console.log(`[DocumentService] Traffic Light Decision: ${status} (Confidence: ${confidence.toFixed(2)}%, Valid: ${isValid})`);

        // 5. Handle Outcomes
        if (status === 'RED' || status === 'YELLOW') {
            const fullDetails = analysis.suggestedAction 
                ? `${rejectionReason}. Acción sugerida: ${analysis.suggestedAction}`
                : rejectionReason;

            console.warn(`[DocumentService] Validation rejected/warning: ${rejectionReason}`);
            await this.recordValidationToSheets(userId, docType, resultLabel, confidence, fullDetails, action);
            
            const statusCode = status === 'RED' ? 400 : 422;
            throw new AppError(status === 'RED' ? rejectionReason : `${rejectionReason}. Acción sugerida: ${suggestedAction}`, statusCode);
        }

        // 6. Green Light - Proceed to Storage
        const targetFolderName = FOLDER_MAPPING[docType] || '04_Otros';
        console.log(`[DocumentService] Storing document in folder: ${targetFolderName}`);

        let driveFileId = `PENDING_UPLOAD_${Date.now()}`;
        let uploadError = null;

        try {
            // Ensure folder structure
            const clientRootId = await this.driveService.createClientFolderStructure(user.id, user.firstName, user.lastName, undefined, user.driveFolderId || undefined);
            
            // Update user if driveFolderId was missing
            if (!user.driveFolderId || !user.documentsUploaded) {
                console.log(`[DocumentService] Updating user Drive Folder ID: ${clientRootId}`);
                await prisma.user.update({ 
                    where: { id: userId }, 
                    data: { 
                        driveFolderId: clientRootId || user.driveFolderId,
                        documentsUploaded: true 
                    } 
                });
            }

            // Find target subfolder
            const subfolders = await this.driveService.listSubfolders(clientRootId);
            const targetFolder = subfolders.find(f => f.name === targetFolderName);
            
            if (!targetFolder) {
                throw new Error(`Carpeta de destino ${targetFolderName} no encontrada`);
            }

            // Upload File
            const parsedName = path.parse(file.originalname);
            const fileName = `${parsedName.name}_${user.id.substring(0, 6)}${parsedName.ext}`;
            console.log(`[DocumentService] Uploading file to Google Drive: ${fileName}`);
            const driveFile = await this.driveService.uploadFile(fileName, file.mimetype, file.buffer, targetFolder.id);
            driveFileId = driveFile.id;
            console.log(`[DocumentService] File uploaded to Drive with ID: ${driveFileId}`);
        } catch (error: any) {
            console.error(`[DocumentService] DRIVE UPLOAD FAILED: ${error.message}`);
            uploadError = error;
            // We continue so we can at least save the validation in MySQL
        }

        // 7. Save Metadata to DB (MySQL)
        console.log(`[DocumentService] Saving document metadata to database...`);
        const doc = await prisma.document.create({
            data: {
                userId: user.id,
                type: docType as DocumentType,
                driveFileId: driveFileId,
                status: uploadError ? ValidationStatus.MANUAL_REVIEW : (status === 'GREEN' ? ValidationStatus.VERIFIED : ValidationStatus.MANUAL_REVIEW),
                confidence: confidence,
                issues: uploadError ? `UPLOAD_ERROR: ${uploadError.message}` : (analysis.validationChecks ? JSON.stringify(analysis.validationChecks) : null),
                metadata: {
                    ...analysis,
                    uploadError: uploadError ? uploadError.message : null
                } as any
            }
        });
        console.log(`[DocumentService] Metadata saved in MySQL with ID: ${doc.id}`);

        // 8. Success Sheet Update
        console.log(`[DocumentService] Updating success record in Google Sheets...`);
        await this.recordValidationToSheets(
            user.id, 
            docType, 
            uploadError ? 'Warning' : 'Pass', 
            confidence, 
            uploadError ? `Validado pero error al subir a Drive: ${uploadError.message}` : 'Validación exitosa y guardado', 
            uploadError ? 'Manual Review' : 'None', 
            doc.id
        );

        if (uploadError) {
            throw new AppError(`Documento validado correctamente pero hubo un problema al guardarlo en Drive: ${uploadError.message}. El administrador lo revisará.`, 207); // 207 Multi-Status or just a custom warning
        }

        // Evaluar progreso tras subsanación si aplica
        await this.checkCorrectionProgress(user.id);

        console.log(`[DocumentService] Upload process completed successfully.`);
        return doc;
    }

    async updateDocument(userId: string, file: Express.Multer.File, docTypeString: string): Promise<any> {
        console.log(`[DocumentService] Starting update for user: ${userId}, Type: ${docTypeString}, File: ${file?.originalname}`);
        
        const docType = DocumentTypeEnum.parse(docTypeString);
        if (!file) throw new AppError('No file uploaded', 400);

        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user) throw new AppError('Usuario no encontrado', 404);

        const existingDoc = await prisma.document.findFirst({
            where: { userId: user.id, type: docType as DocumentType }
        });

        if (existingDoc && existingDoc.driveFileId && !existingDoc.driveFileId.startsWith('PENDING_UPLOAD')) {
            try {
                await this.driveService.deleteFile(existingDoc.driveFileId);
                console.log(`[DocumentService] Deleted old file from Drive: ${existingDoc.driveFileId}`);
            } catch (err: any) {
                console.warn(`[DocumentService] Failed to delete old file from Drive: ${err.message}`);
            }
        }

        console.log(`[DocumentService] Sending to Gemini for AI analysis...`);
        const analysis = await this.geminiService.analyzeDocument(file.buffer, file.mimetype, docType);
        
        const confidence = analysis.confidenceScore || 0;
        const isValid = analysis.isValid;
        const checks = analysis.validationChecks || {};
        const looksAltered = checks.looksAltered || false;
        const isReadable = checks.isReadable || false;
        let isExpired = checks.isExpired || false;

        if (docType === 'PRUEBA_RESIDENCIA' || docType === 'OTROS') {
            isExpired = false;
        }

        let status: 'GREEN' | 'YELLOW' | 'RED' = 'RED';
        let resultLabel: 'Pass' | 'Fail' | 'Warning' = 'Fail';
        let action: 'None' | 'Re-upload' | 'Manual Review' = 'Re-upload';
        let rejectionReason = analysis.rejectionReason || 'Error desconocido';
        const suggestedAction = analysis.suggestedAction || 'Por favor, contacte con soporte.';

        if (isValid && confidence >= 90 && !looksAltered && isReadable && !isExpired) {
            status = 'GREEN';
            resultLabel = 'Pass';
            action = 'None';
        } else if ((confidence >= 70 && confidence < 90) || looksAltered || !isReadable) {
            status = 'YELLOW';
            resultLabel = 'Warning';
            action = 'Manual Review';
            rejectionReason = analysis.rejectionReason || (looksAltered ? 'El documento parece alterado digitalmente' : (!isReadable ? 'El documento es borroso o ilegible' : 'Baja confianza en la validación automática'));
        } else {
            status = 'RED';
            resultLabel = 'Fail';
            action = 'Re-upload';
            rejectionReason = analysis.rejectionReason || (isExpired ? 'El documento ha caducado' : 'Validación fallida');
        }

        if (status === 'RED' || status === 'YELLOW') {
            const fullDetails = analysis.suggestedAction 
                ? `${rejectionReason}. Acción sugerida: ${analysis.suggestedAction}`
                : rejectionReason;
            await this.recordValidationToSheets(userId, docType, resultLabel, confidence, fullDetails, action);
            const statusCode = status === 'RED' ? 400 : 422;
            throw new AppError(status === 'RED' ? rejectionReason : `${rejectionReason}. Acción sugerida: ${suggestedAction}`, statusCode);
        }

        const targetFolderName = FOLDER_MAPPING[docType] || '04_Otros';
        let driveFileId = `PENDING_UPLOAD_${Date.now()}`;
        let uploadError = null;

        try {
            const clientRootId = await this.driveService.createClientFolderStructure(user.id, user.firstName, user.lastName, undefined, user.driveFolderId || undefined);
            if (!user.driveFolderId || !user.documentsUploaded) {
                await prisma.user.update({ 
                    where: { id: userId }, 
                    data: { driveFolderId: clientRootId || user.driveFolderId, documentsUploaded: true } 
                });
            }
            const subfolders = await this.driveService.listSubfolders(clientRootId);
            const targetFolder = subfolders.find(f => f.name === targetFolderName);
            if (!targetFolder) throw new Error(`Carpeta de destino ${targetFolderName} no encontrada`);

            const parsedName = path.parse(file.originalname);
            const fileName = `${parsedName.name}_${user.id.substring(0, 6)}${parsedName.ext}`;
            const driveFile = await this.driveService.uploadFile(fileName, file.mimetype, file.buffer, targetFolder.id);
            driveFileId = driveFile.id;
        } catch (error: any) {
            console.error(`[DocumentService] DRIVE UPLOAD FAILED: ${error.message}`);
            uploadError = error;
        }

        const dbStatus = uploadError ? ValidationStatus.MANUAL_REVIEW : (status === 'GREEN' ? ValidationStatus.VERIFIED : ValidationStatus.MANUAL_REVIEW);
        const dbIssues = uploadError ? `UPLOAD_ERROR: ${uploadError.message}` : (analysis.validationChecks ? JSON.stringify(analysis.validationChecks) : null);
        const dbMetadata = { ...analysis, uploadError: uploadError ? uploadError.message : null } as any;

        let doc;
        if (existingDoc) {
            doc = await prisma.document.update({
                where: { id: existingDoc.id },
                data: { driveFileId, status: dbStatus, confidence, issues: dbIssues, metadata: dbMetadata }
            });
        } else {
            doc = await prisma.document.create({
                data: { userId: user.id, type: docType as DocumentType, driveFileId, status: dbStatus, confidence, issues: dbIssues, metadata: dbMetadata }
            });
        }

        await this.recordValidationToSheets(
            user.id, docType, uploadError ? 'Warning' : 'Pass', confidence, 
            uploadError ? `Validado pero error al subir a Drive: ${uploadError.message}` : 'Validación exitosa y guardado', 
            uploadError ? 'Manual Review' : 'None', doc.id
        );

        if (uploadError) throw new AppError(`Documento validado correctamente pero hubo un problema al guardarlo en Drive: ${uploadError.message}. El administrador lo revisará.`, 207);

        return doc;
    }

    async deleteDocument(userId: string, docTypeString: string): Promise<void> {
        console.log(`[DocumentService] Starting delete for user: ${userId}, Type: ${docTypeString}`);
        
        const docType = DocumentTypeEnum.parse(docTypeString);

        const existingDoc = await prisma.document.findFirst({
            where: { userId: userId, type: docType as DocumentType }
        });

        if (!existingDoc) {
            throw new AppError('Documento no encontrado', 404);
        }

        if (existingDoc.driveFileId && !existingDoc.driveFileId.startsWith('PENDING_UPLOAD')) {
            try {
                await this.driveService.deleteFile(existingDoc.driveFileId);
                console.log(`[DocumentService] Deleted file from Drive: ${existingDoc.driveFileId}`);
            } catch (err: any) {
                console.warn(`[DocumentService] Failed to delete file from Drive: ${err.message}`);
            }
        }

        try {
            await this.validationSheetsService.clearValidationRow(userId, docType);
            console.log(`[DocumentService] Cleared validation row in Sheets for user: ${userId}, Type: ${docType}`);
        } catch (err: any) {
            console.warn(`[DocumentService] Failed to clear row in Sheets: ${err.message}`);
        }

        await prisma.document.delete({
            where: { id: existingDoc.id }
        });
        console.log(`[DocumentService] Deleted document record from DB: ${existingDoc.id}`);
    }

    async getDocumentStatus(userId: string): Promise<Record<string, string>> {
        console.log(`[DocumentService] Fetching document status for user: ${userId}`);

        // Fetch user documents ordered by creation date descending
        const documents = await prisma.document.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' }
        });

        // Initialize dictionary with MISSING for all types
        const statusDict: Record<string, string> = {
            [DocumentType.PASAPORTE]: 'MISSING',
            [DocumentType.ANTECEDENTES_PENALES]: 'MISSING',
            [DocumentType.CERTIFICADO_EMPADRONAMIENTO]: 'MISSING',
            [DocumentType.PRUEBA_RESIDENCIA]: 'MISSING',
            [DocumentType.OTROS]: 'MISSING'
        };

        // Populate with latest status found
        for (const doc of documents) {
            if (statusDict[doc.type] === 'MISSING') {
                statusDict[doc.type] = doc.status;
            }
        }

        return statusDict;
    }

    private async checkCorrectionProgress(userId: string) {
        try {
            const clientService = new ClientService();
            const client = await clientService.getClientById(userId);
            if (client && client.status === 'Requiere subsanación') {
                const progress = await clientService.calculateProgress(userId);
                if (progress.totalProgress === 100) {
                    await clientService.updateClient(userId, { status: 'En revisión por abogado' }, { role: 'System' });
                    
                    const lawyers = await prisma.user.findMany({ where: { role: 'Abogado' }, select: { email: true } });
                    const lawyerEmails = lawyers.map(l => l.email);
                    
                    await emailService.sendCorrectionSubmittedEmail(lawyerEmails, `${client.firstName} ${client.lastName}`);
                    
                    await prisma.auditLog.create({
                        data: {
                            lawyerId: 'SYSTEM',
                            clientId: userId,
                            action: 'CORRECTION_SUBMITTED',
                            details: 'El cliente ha subsanado sus documentos y vuelve a estar completo.'
                        }
                    });
                    console.log(`[DocumentService] Status changed to 'En revisión por abogado' for user ${userId} and email sent.`);
                }
            }
        } catch (error) {
            console.error(`[DocumentService] Error checking correction progress for user ${userId}:`, error);
        }
    }

    private async recordValidationToSheets(
        clientId: string, 
        type: string, 
        result: 'Pass' | 'Fail' | 'Warning', 
        confidence: number, 
        details: string, 
        action: 'None' | 'Re-upload' | 'Manual Review', 
        docId: string = 'N/A'
    ) {
        try {
            await this.validationSheetsService.create({
                clientId,
                documentId: docId,
                type: type,
                result: result,
                confidence: confidence / 100, // Sheets expect 0-1 range
                details: details,
                action: action,
                date: new Date().toISOString()
            });
        } catch (err) {
            console.error('Error al actualizar hoja de Validaciones:', err);
        }
    }
}
