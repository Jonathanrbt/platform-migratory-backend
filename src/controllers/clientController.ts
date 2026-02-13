import { Request, Response } from 'express';
import { ClientService } from '../services/clientService';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError } from '../utils/AppError';

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

export const createClient = asyncHandler(async (req: Request, res: Response) => {
    const newClient = await clientService.registerClient(req.body);
    
    res.status(201).json({ 
        status: 'success',
        message: 'Client created successfully',
        data: { id: newClient.id }
    });
});

export const updateClient = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const updates = req.body;
    const user = req.user;

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
