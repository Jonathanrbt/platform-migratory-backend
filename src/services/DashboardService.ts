import { ClientSheetsService } from './googleSheets/ClientSheetsService';
import prisma from '../config/prisma';
import { Client } from '../models/Client';

export class DashboardService {
    private clientSheetsService: ClientSheetsService;

    constructor() {
        this.clientSheetsService = new ClientSheetsService();
    }

    async getDashboardData() {
        const { clients } = await this.clientSheetsService.getClients();

        // 1. Métrica Rápidas (KPIs)
        let totalPendingReview = 0;
        let inProcess = 0;
        let requiresCorrection = 0;

        for (const client of clients) {
            const status = client.status;
            if (status === 'En revisión por abogado') {
                totalPendingReview++;
            } else if (status === 'En proceso') {
                inProcess++;
            } else if (status === 'Requiere subsanación') {
                requiresCorrection++;
            }
        }

        const metrics = {
            totalPendingReview,
            inProcess,
            requiresCorrection
        };

        // 2. Accesos Directos (Últimos Modificados)
        // Obtener los IDs de los clientes con acciones recientes
        const recentLogs = await prisma.auditLog.findMany({
            orderBy: { createdAt: 'desc' },
            take: 50 // Tomar suficientes para poder agrupar y obtener 10 únicos
        });

        // Agrupar para obtener solo el último evento por cliente
        const uniqueRecentLogs = [];
        const seenClientIds = new Set();
        
        for (const log of recentLogs) {
            if (!seenClientIds.has(log.clientId)) {
                seenClientIds.add(log.clientId);
                uniqueRecentLogs.push(log);
                if (uniqueRecentLogs.length >= 10) break;
            }
        }

        const recentClients = uniqueRecentLogs.map(log => {
            const client = clients.find(c => c.id === log.clientId);
            if (!client) return null;
            return {
                id: client.id,
                name: `${client.firstName} ${client.lastName}`.trim(),
                status: client.status,
                lastModified: log.createdAt
            };
        }).filter(Boolean).slice(0, 10);

        // 3. Alertas (Basadas en modelo Alert)
        const pendingAlerts = await prisma.alert.findMany({
            where: { status: 'PENDIENTE' },
            orderBy: { createdAt: 'desc' },
            take: 50
        });

        const alerts = pendingAlerts.map(alert => {
            const client = clients.find(c => c.id === alert.clientId);
            if (!client) return null;

            return {
                id: alert.id,
                clientId: alert.clientId,
                name: `${client.firstName} ${client.lastName}`.trim(),
                message: alert.message,
                date: alert.createdAt,
                type: alert.type
            };
        }).filter(Boolean);

        return {
            metrics,
            quickActions: {
                recentClients
            },
            alerts
        };
    }
}
