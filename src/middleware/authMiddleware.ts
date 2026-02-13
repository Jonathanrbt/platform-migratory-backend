import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/authService';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError } from '../utils/AppError';

export const authMiddleware = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    let token: string | undefined;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
        throw new AppError('You are not logged in. Please login to get access.', 401);
    }

    const decoded = AuthService.verifyToken(token);
    
    // Check if user still exists (optional but recommended)
    // For now, we trust the JWT payload
    req.user = {
        id: decoded.id,
        email: decoded.email,
        role: decoded.role
    };

    next();
});
