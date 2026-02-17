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

    const { clients, total } = await clientService.getAllClients({ page, limit, status, search, sort });

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

    // Add familyId to client data if present, and use user.id as client.id
    const clientData = { ...req.body, id: user.id, familyId };

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
