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
            throw new AppError(`Error creating Drive folder: ${error.message}`, 500);
        }
    }

    async createClientFolderStructure(clientId: string): Promise<void> {
        const rootId = process.env.GOOGLE_DRIVE_CLIENTS_ROOT_ID;
        if (!rootId) {
            console.warn('GOOGLE_DRIVE_CLIENTS_ROOT_ID not configured. Skipping Drive folder creation.');
            return;
        }

        // 1. Create client main folder
        const clientFolderId = await this.createFolder(clientId, rootId);

        // 2. Create subfolders for document types (based on Master Doc)
        const docTypes = ['Pasaporte', 'Antecedentes Penales', 'Certificado Empadronamiento', 'Pruebas Permanencia'];
        for (const type of docTypes) {
            await this.createFolder(type, clientFolderId);
        }
    }
}
