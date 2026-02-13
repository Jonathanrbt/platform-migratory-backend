import { Request, Response } from 'express';
import { DriveService } from '../services/googleDrive/driveService';
import { ValidationService } from '../services/ai/validationService';
import { asyncHandler } from '../utils/asyncHandler';
import path from 'path';
import fs from 'fs';

const driveService = new DriveService();
const validationService = new ValidationService();

export const handleDriveWebhook = asyncHandler(async (req: Request, res: Response) => {
    // Google Drive sends the resource ID and state in headers
    const resourceState = req.headers['x-goog-resource-state'];
    const resourceId = req.headers['x-goog-resource-id'] as string;

    // We only care about new files or changes (update)
    if (resourceState !== 'update' && resourceState !== 'add') {
        res.status(200).send();
        return;
    }

    try {
        // 1. Get metadata to find the parent folder (Client ID)
        const metadata = await driveService.getFileMetadata(resourceId);
        
        if (!metadata.parents || metadata.parents.length === 0) {
            res.status(200).send();
            return;
        }

        // 2. Identify Client ID from the parent folder name
        const parentFolderId = metadata.parents[0];
        const clientId = await driveService.getFolderName(parentFolderId);

        if (!clientId || metadata.mimeType === 'application/vnd.google-apps.folder') {
            res.status(200).send();
            return;
        }

        // 3. Technical Requirements Validation (PDF & Max 4MB)
        const sizeMetadata = await driveService.getFileSize(resourceId);
        const fileSizeInMB = sizeMetadata / (1024 * 1024);

        if (metadata.mimeType !== 'application/pdf' || fileSizeInMB > 4) {
            console.warn(`File ${resourceId} rejected: ${metadata.mimeType} - ${fileSizeInMB.toFixed(2)}MB`);
            // We use a simplified internal call or service method to record this failure
            res.status(200).send();
            return;
        }

        // 4. Setup temporary paths
        const tempDir = path.join(process.cwd(), 'temp_docs');
        if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);
        
        const tempPath = path.join(tempDir, `${Date.now()}_${metadata.name}`);

        // 4. Download and Process
        await driveService.downloadFile(resourceId, tempPath);
        const fileBuffer = fs.readFileSync(tempPath);

        // Run validation
        await validationService.processDocument(clientId, resourceId, fileBuffer);

        // 5. Cleanup
        fs.unlinkSync(tempPath);

    } catch (error) {
        console.error('Error in Drive Webhook:', error);
    }

    res.status(200).send();
});
