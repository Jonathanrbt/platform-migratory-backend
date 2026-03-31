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
                    - Debe figurar el nombre del solicitante y una fecha clara de emisión (no de vencimiento).
                    - IMPORTANTE: No valides fechas de vencimiento o expiración. Las fechas de límite de pago en recibos NO invalidan el documento.
                    - isExpired DEBE ser siempre false.
                    - Valida únicamente que el idioma sea español y que el documento sea legible.
                    - ERROR si: El nombre no coincide con el del solicitante.
                    - ERROR si: No es legible.
                    - ERROR si: No está en español (o cooficial).`;
                    break;
                case 'OTROS':
                    specializedRules = `
                    - Documento misceláneo o adicional de apoyo.
                    - IMPORTANTE: No valides fechas de vencimiento o expiración.
                    - isExpired DEBE ser siempre false.
                    - Valida únicamente que el idioma sea español (o cooficial) y que el documento sea legible.
                    - ERROR si: No es legible.
                    - ERROR si: No está en español (o cooficial).`;
                    break;
            }

            const prompt = `
                Actúa como un experto en extranjería en España. Tu tarea es validar documentos para un proceso de regularización.
                
                DOCUMENTO ESPERADO: ${expectedType}
                REGLAS ESPECÍFICAS:
                ${specializedRules}
                
                CRITERIOS DE RECHAZO Y MENSAJES (rejectionReason):
                1. TIPO INCORRECTO: "El documento subido no parece ser un ${expectedType}. Por favor, asegúrate de subir el archivo correcto." (Ignorar esta regla si el documento esperado es OTROS).
                2. ILEGIBLE: "El documento es borroso o tiene reflejos que impiden leer los datos. Por favor, intenta escanearlo de nuevo con mejor resolución."
                3. CADUCADO: "El documento está fuera de su periodo de validez. Por favor, sube una versión vigente."
                4. SIN APOSTILLA (Si aplica): "El certificado de antecedentes penales no tiene la Apostilla de la Haya obligatoria."
                5. SIN TRADUCCIÓN (Si aplica): "El documento no está en español y requiere una traducción jurada para ser válido."
                6. ALTERADO: "Se han detectado posibles alteraciones digitales en el documento. Por favor, sube un escaneo original."

                GENERAL VALIDATION RULES:
                - Check if the document matches the expected type (Si el expected type es OTROS, CUALQUIER documento es válido, incluyendo Pasaportes, Antecedentes, etc. y NO debe ser rechazado por tipo incorrecto).
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
            console.error("[GeminiService] Error Técnico Crudo:", error);

            const errorMessage = error.message?.toLowerCase() || '';
            const status = error.status || error.response?.status;
            const errorDetails = error.errorDetails || error.response?.data?.error?.details || [];

            const isApiKeyError = status === 401 || status === 403 || 
                errorMessage.includes('api_key_invalid') || 
                errorMessage.includes('api key not valid') ||
                (Array.isArray(errorDetails) && errorDetails.some((d: any) => d.reason === 'API_KEY_INVALID'));

            // 1. Errores de Autenticación (API Key) - Move this up!
            if (isApiKeyError) {
                console.error("CRÍTICO: Problema con la API Key de Gemini o permisos. Verifica que la clave sea válida y tenga los permisos necesarios.");
                throw new AppError("Error de configuración del servicio (API Key inválida). Por favor, contacta a soporte técnico.", 500);
            }

            // 2. Errores de Parseo (La IA no devolvió un JSON válido)
            if (error instanceof SyntaxError) {
                throw new AppError("Hubo un problema procesando los datos de tu documento. Por favor, vuelve a subir el archivo PDF.", 502);
            }

            // 3. Errores de Demanda y Cuota
            if (status === 429 || errorMessage.includes('quota') || errorMessage.includes('too many requests')) {
                throw new AppError("Nuestros servidores están saturados en este momento. Por favor, espera un minuto y vuelve a intentar.", 429);
            }

            // 4. Errores de Disponibilidad y Red
            if (status === 503 || errorMessage.includes('fetch failed') || errorMessage.includes('timeout') || errorMessage.includes('overloaded')) {
                throw new AppError("El servicio de validación está temporalmente fuera de servicio. Inténtalo más tarde.", 503);
            }

            // 5. Errores de Formato o Documento Corrupto (Only if not caught by API Key logic)
            if (status === 400 || errorMessage.includes('invalid argument') || errorMessage.includes('base64')) {
                throw new AppError("El formato del documento no es válido o el archivo está dañado. Asegúrate de subir un archivo PDF válido y legible.", 400);
            }

            // 6. Bloqueos de Seguridad de la IA
            if (errorMessage.includes('safety') || errorMessage.includes('blocked')) {
                throw new AppError("El documento fue rechazado por políticas de seguridad. Asegúrate de subir un documento oficial válido.", 422);
            }

            // 7. Fallback: Error desconocido
            throw new AppError("Ocurrió un error inesperado al validar el documento. Por favor, intenta nuevamente.", 502);
        }
    }
}
