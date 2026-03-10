import { Request, Response } from 'express';
import { DashboardService } from '../services/DashboardService';
import { asyncHandler } from '../utils/asyncHandler';

const dashboardService = new DashboardService();

export const getDashboard = asyncHandler(async (req: Request, res: Response) => {
    // Aquí el req.user ya está validado y es de tipo Abogado por el middleware
    const dashboardData = await dashboardService.getDashboardData();

    res.status(200).json({
        success: true,
        data: dashboardData
    });
});
