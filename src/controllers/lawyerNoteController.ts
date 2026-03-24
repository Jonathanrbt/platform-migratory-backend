import { Request, Response } from 'express';
import { NoteSheetsService } from '../services/googleSheets/NoteSheetsService';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError } from '../utils/AppError';
import { lawyerNoteSchema } from '../models/LawyerNote';
import prisma from '../config/prisma';

const noteSheetsService = new NoteSheetsService();

export const createNote = asyncHandler(async (req: Request, res: Response) => {
    const { clientId } = req.params;
    const user = req.user as any;
    
    // Merge clientId from URL into body if not present or to ensure override
    // Inject default values to satisfy strict Zod schema without forcing the frontend
    const dataToValidate = { 
        lawyerName: user?.email || user?.name || 'Sistema Abogado',
        category: req.body.category || 'Revisión',
        priority: req.body.priority || 'High',
        status: req.body.status || 'Pending',
        ...req.body, 
        clientId 
    };
    const validatedData = lawyerNoteSchema.parse(dataToValidate);
    
    await noteSheetsService.createNote(validatedData);

    // Audit log
    if (user && user.id) {
        await prisma.auditLog.create({
            data: { 
                lawyerId: user.id, 
                clientId: clientId as string, 
                action: 'MESSAGE_SENT', 
                details: 'Envió un mensaje al cliente' 
            }
        });
    }

    res.status(201).json({ 
        status: 'success',
        message: 'Lawyer note created successfully' 
    });
});

export const getNotesByClient = asyncHandler(async (req: Request, res: Response) => {
    const { clientId } = req.params;

    if (!clientId) {
        throw new AppError('Client ID is required', 400);
    }

    const notes = await noteSheetsService.getLawyerNotes(clientId as string);

    res.status(200).json({
        status: 'success',
        results: notes.length,
        data: { notes }
    });
});
