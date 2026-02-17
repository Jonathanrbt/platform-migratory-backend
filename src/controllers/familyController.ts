import { Request, Response, NextFunction } from 'express';
import { FamilyService } from '../services/FamilyService';
import { AppError } from '../utils/AppError';

const familyService = new FamilyService();

export const createFamily = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = (req as any).user.id; // From authMiddleware
        const { name } = req.body;

        if (!name) {
            throw new AppError('El nombre de la familia es requerido', 400);
        }

        const family = await familyService.createFamily(userId, name);
        res.status(201).json(family);
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
        const userId = (req as any).user.id;
        const memberId = req.params.memberId as string;

        if (!memberId) {
            throw new AppError('El ID del miembro es requerido', 400);
        }

        await familyService.removeMember(userId, memberId);
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
