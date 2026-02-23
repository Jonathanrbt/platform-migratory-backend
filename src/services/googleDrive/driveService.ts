import { google } from 'googleapis';
import { googleConfig } from '../../config/google';
import { AppError } from '../../utils/AppError';
import fs from 'fs';
import path from 'path';

export class DriveService {
    private drive;

    constructor() {
        if (!googleConfig.clientEmail || !googleConfig.privateKey) {
            throw new Error('Google Cloud credentials missing');
        }

        const auth = new google.auth.GoogleAuth({
            credentials: {
                client_email: googleConfig.clientEmail,
                private_key: googleConfig.privateKey,
                project_id: googleConfig.projectId,
            },
            scopes: ['https://www.googleapis.com/auth/drive'],
        });

        this.drive = google.drive({ version: 'v3', auth });
    }

    /**
     * Downloads a file from Drive to a temporary local path.
     */
    async downloadFile(fileId: string, destPath: string): Promise<string> {
        try {
            const dest = fs.createWriteStream(destPath);
            const response = await this.drive.files.get(
                { fileId, alt: 'media' },
                { responseType: 'stream' }
            );

            return new Promise((resolve, reject) => {
                response.data
                    .on('end', () => resolve(destPath))
                    .on('error', (err) => reject(err))
                    .pipe(dest);
            });
        } catch (error: any) {
            throw new AppError(`Error downloading from Drive: ${error.message}`, 500);
        }
    }

    /**
     * Gets file metadata including parent folders and size.
     */
    async getFileMetadata(fileId: string) {
        try {
            const response = await this.drive.files.get({
                fileId,
                fields: 'id, name, parents, mimeType, size',
            });
            return response.data;
        } catch (error: any) {
            throw new AppError(`Error getting Drive metadata: ${error.message}`, 500);
        }
    }

    /**
     * Gets file size in bytes.
     */
    async getFileSize(fileId: string): Promise<number> {
        const metadata = await this.getFileMetadata(fileId);
        return parseInt(metadata.size || '0');
    }

    /**
     * Gets the name of a folder (used to identify Client ID by folder name).
     */
    async getFolderName(folderId: string): Promise<string> {
        try {
            const response = await this.drive.files.get({
                fileId: folderId,
                fields: 'name',
            });
            return response.data.name || '';
        } catch (error: any) {
            return '';
        }
    }

    /**
     * Starts watching a folder for changes.
     * Note: 'address' must be a public HTTPS URL.
     */
    async watchFolder(folderId: string, webhookUrl: string, channelId: string) {
        try {
            const response = await this.drive.files.watch({
                fileId: folderId,
                requestBody: {
                    id: channelId,
                    type: 'web_hook',
                    address: webhookUrl,
                },
            });
            return response.data;
        } catch (error: any) {
            throw new AppError(`Error setting up Drive watch: ${error.message}`, 500);
        }
    }

    async moveFolder(fileId: string, newParentId: string): Promise<void> {
        try {
            // Retrieve the existing parents to remove them
            const file = await this.drive.files.get({
                fileId: fileId,
                fields: 'parents'
            });
            const previousParents = (file.data.parents || []).join(',');

            // Move the file to the new folder
            await this.drive.files.update({
                fileId: fileId,
                addParents: newParentId,
                removeParents: previousParents,
                fields: 'id, parents'
            });
        } catch (error: any) {
            throw new AppError(`Error moving folder in Drive: ${error.message}`, 500);
        }
    }

    async listSubfolders(folderId: string): Promise<{id: string, name: string}[]> {
        try {
            const response = await this.drive.files.list({
                q: `'${folderId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
                fields: 'files(id, name)'
            });
            return (response.data.files as {id: string, name: string}[]) || [];
        } catch (error: any) {
            return [];
        }
    }

    async createFolder(name: string, parentId?: string): Promise<string> {
        try {
            const response = await this.drive.files.create({
                requestBody: {
                    name,
                    mimeType: 'application/vnd.google-apps.folder',
                    parents: parentId ? [parentId] : undefined,
                },
                fields: 'id',
            });
            return response.data.id || '';
        } catch (error: any) {
            console.error('Drive API Error:', error.response?.data || error.message);
            throw new AppError(`Error creating Drive folder: ${error.message}`, 500);
        }
    }

    async createClientFolderStructure(clientId: string, firstName: string, lastName: string, parentFolderId?: string, existingFolderId?: string): Promise<string> {
        const rootId = parentFolderId || process.env.GOOGLE_DRIVE_CLIENTS_ROOT_ID;
        if (!rootId && !existingFolderId) {
            console.warn('GOOGLE_DRIVE_CLIENTS_ROOT_ID not configured and no parentFolderId or existingFolderId provided. Skipping Drive folder creation.');
            return '';
        }

        let clientFolderId = existingFolderId;

        if (!clientFolderId) {
            // Create a friendly name: Juan_Perez_f312c569
            const shortId = clientId.split('-')[0];
            const folderName = `${firstName}_${lastName}_${shortId}`.replace(/\s+/g, '_');

            // 1. Create client main folder
            clientFolderId = await this.createFolder(folderName, rootId);
        }

        // 2. Create subfolders for document types (standardized names)
        const docSubfolders = ['01_Identidad', '02_Antecedentes', '03_Pruebas_Residencia', '04_Otros'];
        
        // List existing subfolders to avoid duplicates if reusing
        const existingSubs = await this.listSubfolders(clientFolderId);
        const existingSubNames = existingSubs.map(f => f.name);

        for (const sub of docSubfolders) {
            if (!existingSubNames.includes(sub)) {
                await this.createFolder(sub, clientFolderId);
            }
        }

        return clientFolderId;
    }
}
