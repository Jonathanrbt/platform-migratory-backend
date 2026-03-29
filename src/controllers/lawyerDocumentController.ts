import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError } from '../utils/AppError';
import prisma from '../config/prisma';
import { DriveService } from '../services/googleDrive/driveService';

const driveService = new DriveService();

export const getClientDocumentsForReview = asyncHandler(async (req: Request, res: Response) => {
    const { id: clientId } = req.params;

    // 1. Fetch documents from Prisma
    // Filter by userId and exclude REJECTED status to only show reviewable docs.
    const documents = await prisma.document.findMany({
        where: {
            userId: clientId as string,
            status: {
                in: ['VERIFIED', 'MANUAL_REVIEW']
            }
        },
        orderBy: {
            createdAt: 'desc' // Newest first
        }
    });

    // 2. Verify existence in Drive concurrently
    const existenceChecks = await Promise.all(
        documents.map(doc => doc.driveFileId ? driveService.fileExists(doc.driveFileId) : Promise.resolve(false))
    );

    const baseUrl = `${req.protocol}://${req.get('host')}/api/v1/lawyer/clients/documents`;

    const validDocuments = documents
        .filter((_, index) => existenceChecks[index])
        .map(doc => ({
            id: doc.id,
            type: doc.type,
            status: doc.status,
            confidence: doc.confidence,
            issues: doc.issues,
            createdAt: doc.createdAt,
            viewUrl: `${baseUrl}/${doc.id}/view`
        }));

    // 3. Return the standardized JSON response
    res.status(200).json({
        status: 'success',
        results: validDocuments.length,
        data: {
            documents: validDocuments
        }
    });
});

export const streamDocument = asyncHandler(async (req: Request, res: Response) => {
    const { documentId } = req.params;
    const user = req.user as any;

    const document = await prisma.document.findUnique({
        where: { id: documentId as string }
    });

    if (!document) throw new AppError('Document not found', 404);

    // Audit Log
    if (user && user.id) {
        await prisma.auditLog.create({
            data: {
                lawyerId: user.id,
                clientId: document.userId,
                action: 'DOCUMENT_VIEWED',
                details: `Visualizó el documento tipo ${document.type}`
            }
        });
    }

    const stream = await driveService.getFileStream(document.driveFileId);

    // Provide generic response headers based on file type if possible, default to pdf
    let contentType = 'application/pdf';
    if (document.metadata && typeof document.metadata === 'object' && 'mimeType' in document.metadata) {
        contentType = (document.metadata as any).mimeType;
    }

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', 'inline');
    stream.pipe(res);
});