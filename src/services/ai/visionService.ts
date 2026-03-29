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
     * Performs OCR on an image or PDF and detects language.
     * @param buffer The file content as a Buffer.
     */
    async extractText(buffer: Buffer): Promise<{ text: string, language: string }> {
        try {
            const [result] = await this.client.textDetection(buffer);
            const detections = result.textAnnotations;
            
            if (!detections || detections.length === 0) {
                return { text: '', language: 'unknown' };
            }

            const text = detections[0].description || '';
            const language = result.fullTextAnnotation?.pages?.[0]?.property?.detectedLanguages?.[0]?.languageCode || 'unknown';

            return { text, language };
        } catch (error: any) {
            throw new AppError(`Error in OCR: ${error.message}`, 500);
        }
    }
}
