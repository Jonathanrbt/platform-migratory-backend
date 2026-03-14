import { Request, Response } from 'express';
import { ClientService } from '../services/clientService';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError } from '../utils/AppError';
import prisma from '../config/prisma';

const clientService = new ClientService();

export const getClients = asyncHandler(async (req: Request, res: Response) => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const status = req.query.status as string;
    const search = req.query.search as string;
    const sort = req.query.sort as string;
    const type = req.query.type as string; // NEW: filter by type (Individual, Cabeza de familia, Miembro)

    const { clients, total } = await clientService.getAllClients({ page, limit, status, search, sort, type });

    res.status(200).json({
        status: 'success',
        results: clients.length,
        total,
        page,
        totalPages: Math.ceil(total / limit),
        data: { clients }
    });
});

export const getProfile = asyncHandler(async (req: Request, res: Response) => {
    const user = req.user as any;

    if (!user) {
        throw new AppError('Authentication required', 401);
    }

    const client = await clientService.getClientByEmail(user.email);

    res.status(200).json({
        status: 'success',
        data: { client: client || null }
    });
});

export const getClientById = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const user = req.user as any;

    if (!user) {
        throw new AppError('Authentication required', 401);
    }

    const client = await clientService.getClientById(id as string);

    // If requester is a Cliente, they can only see their own data
    if (user.role === 'Cliente' && client.email !== user.email) {
        throw new AppError('You are not authorized to view this client profile', 403);
    }

    res.status(200).json({
        status: 'success',
        data: { client }
    });
});

export const createClient = asyncHandler(async (req: Request, res: Response) => {
    const user = req.user as any;

    if (!user) {
        throw new AppError('Authentication required', 401);
    }

    // If requester is a Cliente, ensure they are creating their own profile
    if (user.role === 'Cliente') {
        if (req.body.email.toLowerCase() !== user.email.toLowerCase()) {
            throw new AppError('You can only create a profile for your own email address', 403);
        }

        // Check if profile already exists
        const existingClient = await clientService.getClientByEmail(user.email);
        if (existingClient) {
            throw new AppError('A client profile already exists for this user', 400);
        }
    }

    // Fetch user details including family to get Drive Folder ID
    const userDetails = await prisma.user.findUnique({
        where: { id: user.id },
        include: { family: true }
    });

    const familyDriveFolderId = userDetails?.family?.driveFolderId || undefined;
    const familyId = userDetails?.familyId || undefined;
    const documentType = req.body.documentType || userDetails?.documentType || undefined;
    const documentNumber = req.body.documentNumber || userDetails?.documentNumber || undefined;

    // Add familyId, documentType, documentNumber to client data if present, and use user.id as client.id
    const clientData = { ...req.body, id: user.id, familyId, documentType, documentNumber };

    const newClient = await clientService.registerClient(clientData, { familyDriveFolderId });
    
    res.status(201).json({ 
        status: 'success',
        message: 'Client created successfully',
        data: { id: newClient.id }
    });
});

export const updateClient = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const updates = req.body;
    const user = req.user as any;

    if (!user) {
        throw new AppError('Authentication required', 401);
    }

    if (!id) {
        throw new AppError('Client ID is required', 400);
    }

    // Si el usuario es cliente, nos aseguramos de que el documento y tipo de documento
    // esten siempre presentes usando la base de datos (por si hubo un error previo donde no se guardaron)
    if (user.role === 'Cliente') {
        const userDetails = await prisma.user.findUnique({
            where: { id: user.id },
            select: { documentType: true, documentNumber: true }
        });

        if (userDetails) {
            if (!updates.documentType && userDetails.documentType) {
                updates.documentType = userDetails.documentType;
            }
            if (!updates.documentNumber && userDetails.documentNumber) {
                updates.documentNumber = userDetails.documentNumber;
            }
        }
    }

    const updatedClient = await clientService.updateClient(id as string, updates, user);

    res.status(200).json({
        status: 'success',
        message: 'Client updated successfully',
        data: { client: updatedClient }
    });
});

export const deleteClient = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    if (!id) {
        throw new AppError('Client ID is required', 400);
    }

    await clientService.archiveClient(id as string);

    res.status(200).json({
        status: 'success',
        message: 'Client archived successfully'
    });
});

export const getProgress = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const user = req.user as any;

    if (!user) {
        throw new AppError('Authentication required', 401);
    }

    const client = await clientService.getClientById(id as string);

    if (user.role === 'Cliente' && client.email !== user.email) {
        throw new AppError('You are not authorized to view this client progress', 403);
    }

    const progress = await clientService.calculateProgress(id as string);

    res.status(200).json({
        status: 'success',
        data: progress
    });
});

export const submitApplication = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const user = req.user as any;

    if (!user) {
        throw new AppError('Authentication required', 401);
    }

    const client = await clientService.getClientById(id as string);

    if (user.role === 'Cliente' && client.email !== user.email) {
        throw new AppError('You are not authorized to submit this application', 403);
    }

    const result = await clientService.submitApplication(id as string);

    res.status(200).json(result);
});

export const reviewClient = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { status, note } = req.body;
    const user = req.user as any;
    
    if (!status) {
        throw new AppError('Status is required', 400);
    }
    
    const validStatuses = ['Requiere subsanación', 'Rechazado', 'En proceso', 'Aprobado'];
    if (!validStatuses.includes(status)) {
        throw new AppError(`Invalid status. Must be one of: ${validStatuses.join(', ')}`, 400);
    }

    const client = await clientService.getClientById(id as string);
    
    let updatedNotes = client.notes || '';
    if (note) {
        const timestamp = new Date().toISOString().slice(0, 16).replace('T', ' '); // YYYY-MM-DD HH:mm
        const newNote = `[${timestamp}] Abogado: ${note}`;
        updatedNotes = updatedNotes ? `${updatedNotes}\n${newNote}` : newNote;
    }
    
    // We bypass regular update restrictions since this is an admin/lawyer action
    const clientSheetsService = (clientService as any).clientSheetsService;
    await clientSheetsService.update(id as string, { 
        status: status as any,
        lastUpdatedDate: new Date().toISOString(),
        ...(note && { notes: updatedNotes })
    });

    // Create AuditLog entry
    if (user && user.id) {
        await prisma.auditLog.create({
            data: {
                lawyerId: user.id,
                clientId: id as string,
                action: 'STATUS_CHANGE',
                details: `Status changed to ${status}${note ? '. Note added.' : ''}`
            }
        });
    }

    res.status(200).json({
        status: 'success',
        message: 'Client review updated successfully'
    });
});
