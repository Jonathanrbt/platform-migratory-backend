import { Request, Response, NextFunction } from 'express';
import { DocumentService } from '../services/DocumentService';
import { AppError } from '../utils/AppError';

const documentService = new DocumentService();

export const uploadDocument = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = req.user?.id;
        const { documentType } = req.body;
        const file = req.file;

        console.log(`[DocumentController] Received upload request - User: ${userId}, Type: ${documentType}`);

        if (!userId) {
            throw new AppError('Unauthorized: User not identified', 401);
        }

        if (!file) {
            throw new AppError('No file uploaded', 400);
        }

        if (!documentType) {
            throw new AppError('Document type is required', 400);
        }

        // Call service
        const result = await documentService.uploadDocument(userId, file, documentType);

        res.status(201).json({
            status: 'success',
            data: result
        });
    } catch (error) {
        next(error);
    }
};

export const getDocumentStatus = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = req.user?.id;
        
        console.log(`[DocumentController] Received get status request - User: ${userId}`);

        if (!userId) {
            throw new AppError('Unauthorized: User not identified', 401);
        }

        const result = await documentService.getDocumentStatus(userId);

        res.status(200).json({
            status: 'success',
            data: result
        });
    } catch (error) {
        next(error);
    }
};

export const updateDocument = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = req.user?.id;
        const { documentType } = req.body;
        const file = req.file;

        console.log(`[DocumentController] Received update request - User: ${userId}, Type: ${documentType}`);

        if (!userId) {
            throw new AppError('Unauthorized: User not identified', 401);
        }

        if (!file) {
            throw new AppError('No file uploaded', 400);
        }

        if (!documentType) {
            throw new AppError('Document type is required', 400);
        }

        const result = await documentService.updateDocument(userId, file, documentType);

        res.status(200).json({
            status: 'success',
            data: result
        });
    } catch (error) {
        next(error);
    }
};

export const deleteDocument = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = req.user?.id;
        const { documentType } = req.params;

        console.log(`[DocumentController] Received delete request - User: ${userId}, Type: ${documentType}`);

        if (!userId) {
            throw new AppError('Unauthorized: User not identified', 401);
        }

        if (!documentType) {
            throw new AppError('Document type is required', 400);
        }

        await documentService.deleteDocument(userId, documentType as string);

        res.status(204).send();
    } catch (error) {
        next(error);
    }
};
