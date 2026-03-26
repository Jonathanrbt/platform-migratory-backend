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
    const user = req.user as any;

    if (!clientId) {
        throw new AppError('Client ID is required', 400);
    }

    if (user.role === 'Cliente' && clientId !== user.id) {
        throw new AppError('You can only view your own notes', 403);
    }

    const notes = await noteSheetsService.getLawyerNotes(clientId as string);

    const lawyerUsers = await prisma.user.findMany({
        where: { role: 'Abogado' }
    });

    const enrichedNotes = notes.map(note => {
        let lawyerEmail = 'sistema@plataforma.com';
        
        const lawyerUser = lawyerUsers.find(u => 
            u.email === note.lawyerName || 
            `${u.firstName} ${u.lastName}` === note.lawyerName ||
            u.firstName === note.lawyerName
        );

        if (lawyerUser) {
            lawyerEmail = lawyerUser.email;
        }

        return {
            ...note,
            lawyerEmail
        };
    });

    res.status(200).json({
        status: 'success',
        results: enrichedNotes.length,
        data: { notes: enrichedNotes }
    });
});

export const updateNoteStatus = asyncHandler(async (req: Request, res: Response) => {
    const noteId = req.params.noteId as string;
    const status = req.body.status as 'Pending' | 'Resolved';
    const user = req.user as any;

    if (!noteId || !status) {
        throw new AppError('Note ID and status are required', 400);
    }

    if (status !== 'Resolved' && status !== 'Pending') {
        throw new AppError('Status must be Resolved or Pending', 400);
    }

    const note = await noteSheetsService.findById(noteId);
    
    if (!note) {
        throw new AppError('Note not found', 404);
    }

    if (user.role === 'Cliente' && note.clientId !== user.id) {
        throw new AppError('You can only modify your own notes', 403);
    }

    const updatedNote = await noteSheetsService.updateNoteStatus(noteId, status, note.clientId);

    await prisma.auditLog.create({
        data: {
            lawyerId: user.id,
            clientId: note.clientId,
            action: 'NOTE_STATUS_UPDATED',
            details: `El usuario ${user.firstName} ${user.lastName} (${user.role}) marcó la nota ${noteId} como ${status}`
        }
    });

    res.status(200).json({
        status: 'success',
        data: { note: updatedNote }
    });
});
