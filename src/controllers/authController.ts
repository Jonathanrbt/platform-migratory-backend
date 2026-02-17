import { Request, Response } from 'express';
import { AuthService } from '../services/authService';
import { asyncHandler } from '../utils/asyncHandler';

const authService = new AuthService();

export const register = asyncHandler(async (req: Request, res: Response) => {
    const result = await authService.register(req.body);
    res.status(201).json({
        status: 'success',
        data: result
    });
});

export const login = asyncHandler(async (req: Request, res: Response) => {
    const { email, password } = req.body;
    const result = await authService.login(email, password);
    res.status(200).json({
        status: 'success',
        data: result
    });
});

export const googleLogin = asyncHandler(async (req: Request, res: Response) => {
    const { idToken } = req.body;
    const result = await authService.googleLogin(idToken);
    res.status(200).json({
        status: 'success',
        data: result
    });
});

export const completeProfile = asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).user.id;
    const { documentType, documentNumber } = req.body;
    
    if (!documentType || !documentNumber) {
        throw new Error('Document type and number are required');
    }

    const updatedUser = await authService.completeProfile(userId, { documentType, documentNumber });
    
    res.status(200).json({
        status: 'success',
        data: { user: updatedUser }
    });
});
