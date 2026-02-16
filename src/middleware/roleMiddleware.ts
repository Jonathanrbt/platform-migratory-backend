import { Request, Response, NextFunction } from 'express';
import { User } from '../models/User';
import { AppError } from '../utils/AppError';

export const roleMiddleware = (roles: User['role'][]) => {
    return (req: Request, res: Response, next: NextFunction) => {
        const userRole = req.user?.role;
        console.log(`[RoleMiddleware] User: ${req.user?.email}, Role: ${userRole}, Required Roles: ${roles}`);
        
        if (!req.user || !userRole) {
            return next(new AppError('You are not logged in or have no role', 401));
        }

        const hasPermission = roles.some(role => role.toLowerCase() === userRole.toLowerCase());

        if (!hasPermission) {
            console.warn(`[RoleMiddleware] Access denied for user ${req.user?.email}. Role ${userRole} not in [${roles}]`);
            return next(new AppError('You do not have permission to perform this action', 403));
        }
        next();
    };
};
