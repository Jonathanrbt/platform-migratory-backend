import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/AppError';
import { ClientService } from '../services/clientService';

const clientService = new ClientService();

export const requireEditableStatus = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const user = req.user as any;
        
        if (!user) {
            throw new AppError('Authentication required', 401);
        }

        // Abogados can bypass this if they are doing admin operations, 
        // but typically clients are the ones uploading docs.
        if (user.role === 'Abogado') {
            return next();
        }

        // Find client by email (which matches user's email)
        const client = await clientService.getClientByEmail(user.email);
        
        if (!client) {
            throw new AppError('Client profile not found', 404);
        }

        const allowedStatuses = ['Registro incompleto', 'Requiere subsanación', 'Rechazado'];
        
        if (!allowedStatuses.includes(client.status || '')) {
            throw new AppError(`Operación no permitida. El estado actual de su expediente es '${client.status}'.`, 403);
        }

        next();
    } catch (error) {
        next(error);
    }
};