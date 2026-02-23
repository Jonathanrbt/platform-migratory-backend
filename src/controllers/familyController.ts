import { Request, Response, NextFunction } from 'express';
import { FamilyService } from '../services/FamilyService';
import { AppError } from '../utils/AppError';

const familyService = new FamilyService();

export const createFamily = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { name, adminId, members } = req.body;
        const authenticatedUserId = (req as any).user.id;

        if (!name) {
            throw new AppError('El nombre de la familia es requerido', 400);
        }

        if (!adminId) {
            throw new AppError('El ID del administrador es requerido', 400);
        }

        // Security check: authenticated user must be the admin or have permissions
        if (adminId !== authenticatedUserId) {
            throw new AppError('No tienes permisos para crear un núcleo familiar para otro usuario', 403);
        }

        const family = await familyService.createFamily(adminId, name, members);
        res.status(201).json(family);
    } catch (error) {
        next(error);
    }
};

export const searchUserByDocument = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { documentNumber } = req.params;

        if (!documentNumber) {
            throw new AppError('El número de documento es requerido', 400);
        }

        const user = await familyService.searchByDocument(documentNumber as string);
        res.status(200).json(user);
    } catch (error) {
        next(error);
    }
};

export const addMember = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = (req as any).user.id;
        const { documentNumber } = req.body;

        if (!documentNumber) {
            throw new AppError('El número de documento es requerido', 400);
        }

        const member = await familyService.addMember(userId, documentNumber);
        res.status(200).json(member);
    } catch (error) {
        next(error);
    }
};

export const removeMember = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const requestingUserId = (req as any).user.id;
        const memberId = req.params.memberId as string;

        if (!memberId) {
            throw new AppError('El ID del miembro es requerido', 400);
        }

        await familyService.removeMember(requestingUserId, memberId);
        res.status(204).send();
    } catch (error) {
        next(error);
    }
};

export const getFamilyDetails = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = (req as any).user.id;
        const details = await familyService.getFamilyStatus(userId);
        
        if (!details) {
            return res.status(200).json({ 
                status: 'success',
                data: {
                    hasFamily: false,
                    family: null
                }
            });
        }

        res.status(200).json({
            status: 'success',
            data: {
                hasFamily: true,
                family: details
            }
        });
    } catch (error) {
        next(error);
    }
};
