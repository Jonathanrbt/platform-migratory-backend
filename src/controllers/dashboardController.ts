import { Request, Response } from 'express';
import { DashboardService } from '../services/DashboardService';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError } from '../utils/AppError';
import prisma from '../config/prisma';

const dashboardService = new DashboardService();

export const getDashboard = asyncHandler(async (req: Request, res: Response) => {
    // Aquí el req.user ya está validado y es de tipo Abogado por el middleware
    const dashboardData = await dashboardService.getDashboardData();

    res.status(200).json({
        success: true,
        data: dashboardData
    });
});

export const updateAlertStatus = asyncHandler(async (req: Request, res: Response) => {
    const alertId = req.params.alertId as string;
    const { status } = req.body;
    const user = req.user as any;

    if (!alertId || !status) {
        throw new AppError('Alert ID and status are required', 400);
    }

    if (status !== 'PENDIENTE' && status !== 'REALIZADO') {
        throw new AppError('Status must be PENDIENTE or REALIZADO', 400);
    }

    const alert = await prisma.alert.findUnique({
        where: { id: alertId }
    });

    if (!alert) {
        throw new AppError('Alert not found', 404);
    }

    const updatedAlert = await prisma.alert.update({
        where: { id: alertId },
        data: { status }
    });

    await prisma.auditLog.create({
        data: {
            lawyerId: user.id,
            clientId: alert.clientId,
            action: 'ALERT_STATUS_CHANGED',
            details: `El usuario ${user.firstName} ${user.lastName} cambió el estado de la alerta ${alert.type} a ${status}`
        }
    });

    res.status(200).json({
        success: true,
        data: { alert: updatedAlert }
    });
});
