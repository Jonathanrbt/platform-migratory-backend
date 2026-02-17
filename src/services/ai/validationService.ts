import { VisionService } from './visionService';
import { ValidationSheetsService } from '../googleSheets/ValidationSheetsService';
import { Validation } from '../../models/Validation';
import { AppError } from '../../utils/AppError';
import prisma from '../../config/prisma';

export class ValidationService {
    private visionService: VisionService;
    private validationSheetsService: ValidationSheetsService;

    constructor() {
        this.visionService = new VisionService();
        this.validationSheetsService = new ValidationSheetsService();
    }

    /**
     * Orchestrates the full validation process for a document.
     */
    async processDocument(clientId: string, documentId: string, fileBuffer: Buffer): Promise<void> {
        try {
            // 1. Extract text and detect basic metadata
            const { text, language } = await this.visionService.extractText(fileBuffer);
            if (!text) {
                await this.recordValidation(clientId, documentId, 'Legibilidad', 'Fail', 0, 'No se pudo extraer texto del documento', 'Re-upload');
                return;
            }

            // 2. Run Individual Validations
            await this.validateLanguage(clientId, documentId, language);
            await this.validateVigencia(clientId, documentId, text);
            await this.validateApostilla(clientId, documentId, text);
            
            // 3. Legibility check based on basic extraction success
            await this.recordValidation(clientId, documentId, 'Legibilidad', 'Pass', 1, 'Texto extraído correctamente', 'None');

            // 4. Update SQL User flag (assuming clientId matches User.id)
            try {
                await prisma.user.update({
                    where: { id: clientId },
                    data: { documentsUploaded: true }
                });
            } catch (err) {
                console.warn(`Could not update documentsUploaded for user ${clientId}. (User may not exist in SQL if they only exist in Sheets)`);
            }

        } catch (error: any) {
            throw new AppError(`Error processing document validation: ${error.message}`, 500);
        }
    }

    private async validateLanguage(clientId: string, documentId: string, language: string) {
        const isSpanish = language === 'es';
        
        await this.recordValidation(
            clientId,
            documentId,
            'Idioma',
            isSpanish ? 'Pass' : 'Fail',
            0.9,
            isSpanish ? 'Idioma detectado: Español' : `Idioma detectado: ${language}`,
            isSpanish ? 'None' : 'Manual Review'
        );
    }

    private async validateVigencia(clientId: string, documentId: string, text: string) {
        const lowerText = text.toLowerCase();
        const expirationKeywords = ['vencimiento', 'expira', 'caducidad', 'válido hasta'];
        const emissionKeywords = ['emisión', 'expedición', 'fecha de emisión'];
        
        let foundExpiration = expirationKeywords.some(kw => lowerText.includes(kw));
        let foundEmission = emissionKeywords.some(kw => lowerText.includes(kw));

        // Simplified logic: If keywords are found, we assume Pass for now in this prototype
        // In a real scenario, we would parse the date and compare with current time.
        const result = foundExpiration || foundEmission ? 'Pass' : 'Fail';
        const details = result === 'Pass' 
            ? 'Se detectaron campos de fecha de vigencia/emisión' 
            : 'No se detectaron campos de fecha claros (Vencimiento/Emisión)';

        await this.recordValidation(
            clientId,
            documentId,
            'Vigencia',
            result,
            0.8,
            details,
            result === 'Pass' ? 'None' : 'Manual Review'
        );
    }

    private async validateApostilla(clientId: string, documentId: string, text: string) {
        const lowerText = text.toLowerCase();
        const apostilleKeywords = ['apostille', 'convenio de la haya', 'legalización'];
        
        const hasApostille = apostilleKeywords.some(kw => lowerText.includes(kw));
        
        await this.recordValidation(
            clientId,
            documentId,
            'Apostilla',
            hasApostille ? 'Pass' : 'Fail',
            0.9,
            hasApostille ? 'Apostilla detectada' : 'No se detectó el sello de Apostilla',
            hasApostille ? 'None' : 'Manual Review'
        );
    }

    private async recordValidation(
        clientId: string,
        documentId: string,
        type: Validation['type'],
        result: Validation['result'],
        confidence: number,
        details: string,
        action: Validation['action']
    ) {
        const validationData: Validation = {
            clientId,
            documentId,
            type,
            result,
            confidence,
            details,
            action,
            date: new Date().toISOString()
        };

        await this.validationSheetsService.create(validationData);
    }
}
