import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import authRoutes from './routes/authRoutes';
import clientRoutes from './routes/clientRoutes';
import lawyerClientRoutes from './routes/lawyerClientRoutes';
import familyRoutes from './routes/familyRoutes';
import webhookRoutes from './routes/webhookRoutes';
import documentRoutes from './routes/documentRoutes';
import { errorMiddleware } from './middleware/errorMiddleware';

dotenv.config();

const app = express();

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json());
app.use(cookieParser());

app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/clients', clientRoutes);
app.use('/api/v1/lawyer/clients', lawyerClientRoutes);
app.use('/api/v1/family', familyRoutes);
app.use('/api/v1/webhooks', webhookRoutes);
app.use('/api/v1/documents', documentRoutes);

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', message: 'Platform Migratory Backend is running' });
});

app.use(errorMiddleware);

export default app;
