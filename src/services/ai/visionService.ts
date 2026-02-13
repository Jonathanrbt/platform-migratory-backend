import vision from '@google-cloud/vision';
import { googleConfig } from '../../config/google';
import { AppError } from '../../utils/AppError';

export class VisionService {
    private client;

    constructor() {
        if (!googleConfig.clientEmail || !googleConfig.privateKey) {
            throw new Error('Google Cloud credentials missing');
        }

        this.client = new vision.ImageAnnotatorClient({
            credentials: {
                client_email: googleConfig.clientEmail,
                private_key: googleConfig.privateKey,
            },
            projectId: googleConfig.projectId,
        });
    }

    /**
     * Performs OCR on an image or PDF.
     * @param buffer The file content as a Buffer.
     */
    async extractText(buffer: Buffer): Promise<string> {
        try {
            const [result] = await this.client.textDetection(buffer);
            const detections = result.textAnnotations;
            
            if (!detections || detections.length === 0) {
                return '';
            }

            return detections[0].description || '';
        } catch (error: any) {
            throw new AppError(`Error in OCR: ${error.message}`, 500);
        }
    }

    /**
     * Detects the language of the extracted text.
     */
    async detectLanguage(text: string): Promise<string> {
        // Note: Google Vision provides language hints in textDetection,
        // but for better accuracy, one might use Google Translate API (Detection).
        // For now, we rely on Vision's results or basic heuristics.
        try {
            const [result] = await this.client.textDetection({
                image: { content: Buffer.from(text).toString('base64') }
            });
            return result.fullTextAnnotation?.pages?.[0]?.property?.detectedLanguages?.[0]?.languageCode || 'unknown';
        } catch {
            return 'unknown';
        }
    }
}
