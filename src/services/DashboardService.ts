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

        // 3. Alertas (Clientes en "Requiere subsanación" con nuevos documentos)
        const clientsNeedingCorrection = clients.filter(c => c.status === 'Requiere subsanación');
        const alerts = [];

        // Definimos "recientemente" como documentos subidos en los últimos 7 días
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

        for (const client of clientsNeedingCorrection) {
            if (!client.id) continue;
            
            // Buscar documentos subidos recientemente para este cliente
            const recentDocs = await prisma.document.findMany({
                where: {
                    userId: client.id,
                    createdAt: { gte: oneWeekAgo }
                },
                orderBy: { createdAt: 'desc' },
                take: 1
            });

            if (recentDocs.length > 0) {
                alerts.push({
                    clientId: client.id,
                    name: `${client.firstName} ${client.lastName}`.trim(),
                    message: `Nuevos documentos subidos`,
                    date: recentDocs[0].createdAt
                });
            }
        }

        return {
            metrics,
            quickActions: {
                recentClients
            },
            alerts
        };
    }
}
