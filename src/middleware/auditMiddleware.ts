import { Request, Response, NextFunction } from 'express';
import prisma from '../config/prisma';

export const auditProfileChanges = async (req: Request, res: Response, next: NextFunction) => {
    const user = req.user as any;
    const clientId = req.params.id;
    const newBody = req.body;

    // We process changes. For the minimal implementation we mock the diffing.
    if (user && user.role === 'Abogado' && Object.keys(newBody).length > 0) {
        const changedFields = Object.keys(newBody).join(', ');
        try {
            await prisma.auditLog.create({
                data: {
                    lawyerId: user.id,
                    clientId: clientId as string,
                    action: 'PROFILE_UPDATE',
                    details: `Campos modificados: ${changedFields}`
                }
            });
        } catch (error) {
            console.error('AuditLog Error:', error);
        }
    }
    next();
};
