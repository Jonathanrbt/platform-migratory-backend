import { Request, Response } from 'express';
import { NoteSheetsService } from '../services/googleSheets/NoteSheetsService';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError } from '../utils/AppError';
import { lawyerNoteSchema } from '../models/LawyerNote';

const noteSheetsService = new NoteSheetsService();

export const createNote = asyncHandler(async (req: Request, res: Response) => {
    const { clientId } = req.params;
    
    // Merge clientId from URL into body if not present or to ensure override
    const dataToValidate = { ...req.body, clientId };
    const validatedData = lawyerNoteSchema.parse(dataToValidate);
    
    await noteSheetsService.create(validatedData);
    
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
