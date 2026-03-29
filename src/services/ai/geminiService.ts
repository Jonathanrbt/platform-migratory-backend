import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import { AppError } from '../../utils/AppError';

const responseSchema = {
    type: SchemaType.OBJECT,
    properties: {
        isValid: { type: SchemaType.BOOLEAN },
        documentType: { 
            type: SchemaType.STRING, 
            enum: [
                "PASAPORTE", 
                "ANTECEDENTES_PENALES", 
                "CERTIFICADO_EMPADRONAMIENTO", 
                "PRUEBA_RESIDENCIA", 
                "OTROS", 
                "UNKNOWN"
            ] 
        },
        confidenceScore: { type: SchemaType.NUMBER, description: "Un número entre 0 y 100 representando el porcentaje de confianza" },
        extractedData: {
            type: SchemaType.OBJECT,
            properties: {
                fullName: { type: SchemaType.STRING, nullable: true },
                documentNumber: { type: SchemaType.STRING, nullable: true },
                expirationDate: { type: SchemaType.STRING, nullable: true },
                issueDate: { type: SchemaType.STRING, nullable: true },
                country: { type: SchemaType.STRING, nullable: true },
            },
            nullable: true
        },
        validationChecks: {
            type: SchemaType.OBJECT,
            properties: {
                isReadable: { type: SchemaType.BOOLEAN },
                isExpired: { type: SchemaType.BOOLEAN },
                hasApostille: { type: SchemaType.BOOLEAN },
                isTranslated: { type: SchemaType.BOOLEAN },
                looksAltered: { type: SchemaType.BOOLEAN },
            }
        },
        rejectionReason: { type: SchemaType.STRING, nullable: true },
        suggestedAction: { type: SchemaType.STRING, nullable: true }
    },
    required: ["isValid", "documentType", "confidenceScore", "validationChecks"]
};

export class GeminiService {
    private genAI: GoogleGenerativeAI;
    private model: any;

    constructor() {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            console.error('CRITICAL: GEMINI_API_KEY is not configured in environment variables.');
        }
        
        this.genAI = new GoogleGenerativeAI(apiKey || 'dummy_key');
        
        this.model = this.genAI.getGenerativeModel({
            model: "gemini-2.5-flash", 
            generationConfig: {
                responseMimeType: "application/json",
                responseSchema: responseSchema as any,
            }
        });
    }

    async analyzeDocument(fileBuffer: Buffer, mimeType: string, expectedType: string): Promise<any> {
        if (!process.env.GEMINI_API_KEY) {
             throw new AppError('AI Service unavailable: Missing API configuration', 503);
        }

        try {
            // Specialized rules per document type based on Section 5.1
            let specializedRules = "";
            switch (expectedType) {
                case 'PASAPORTE':
                    specializedRules = `
                    - NO requiere Apostilla.
                    - NO requiere Traducción.
                    - Debe mostrar la zona MRZ y datos biográficos claros.
                    - ERROR si: La foto está tapada o el documento está caducado.`;
                    break;
                case 'ANTECEDENTES_PENALES':
                    specializedRules = `
                    - REQUIERE Apostilla de la Haya obligatoriamente.
                    - REQUIERE Traducción Jurada si no está en español.
                    - Debe ser del país de origen del solicitante.
                    - ERROR si: No tiene el sello de apostilla visible.`;
                    break;
                case 'CERTIFICADO_EMPADRONAMIENTO':
                    specializedRules = `
                    - Debe ser un volante de empadronamiento de un municipio español.
                    - Debe tener fecha de emisión reciente (máximo 3 meses).
                    - ERROR si: Es de un país distinto a España.`;
                    break;
                case 'PRUEBA_RESIDENCIA':
                    specializedRules = `
                    - Pueden ser facturas, citas médicas o registros oficiales.
                    - Debe figurar el nombre del solicitante y una fecha clara.
                    - ERROR si: El nombre no coincide con el del solicitante.`;
                    break;
            }

            const prompt = `
                Actúa como un experto en extranjería en España. Tu tarea es validar documentos para un proceso de regularización.
                
                DOCUMENTO ESPERADO: ${expectedType}
                REGLAS ESPECÍFICAS:
                ${specializedRules}
                
                CRITERIOS DE RECHAZO Y MENSAJES (rejectionReason):
                1. TIPO INCORRECTO: "El documento subido no parece ser un ${expectedType}. Por favor, asegúrate de subir el archivo correcto."
                2. ILEGIBLE: "La imagen es borrosa o tiene reflejos que impiden leer los datos. Por favor, intenta escanearlo de nuevo con mejor luz."
                3. CADUCADO: "El documento está fuera de su periodo de validez. Por favor, sube una versión vigente."
                4. SIN APOSTILLA (Si aplica): "El certificado de antecedentes penales no tiene la Apostilla de la Haya obligatoria."
                5. SIN TRADUCCIÓN (Si aplica): "El documento no está en español y requiere una traducción jurada para ser válido."
                6. ALTERADO: "Se han detectado posibles alteraciones digitales en el documento. Por favor, sube un escaneo original."

                GENERAL VALIDATION RULES:
                - Check if the document matches the expected type.
                - Check if the document is expired (Today's date: ${new Date().toISOString().split('T')[0]}).
                - Check for signs of digital alteration.
                - El campo 'confidenceScore' DEBE ser un número entero entre 0 y 100 (ej. 95, no 0.95).
                
                Return the result in JSON format matching the schema. Always provide a clear 'rejectionReason' and 'suggestedAction' if isValid is false or status is YELLOW.
            `;

            const imagePart = {
                inlineData: {
                    data: fileBuffer.toString('base64'),
                    mimeType
                }
            };

            console.log(`[GeminiService] Analyzing document. Expected: ${expectedType}, MimeType: ${mimeType}`);
            
            const result = await this.model.generateContent([prompt, imagePart]);
            const responseText = result.response.text();
            
            console.log(`[GeminiService] Raw AI Response: ${responseText}`);
            
            return JSON.parse(responseText);
        } catch (error: any) {
            console.error("Gemini API Error:", error);
            throw new AppError(`AI Validation failed: ${error.message}`, 502);
        }
    }
}
