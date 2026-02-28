import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/authRoutes';
import clientRoutes from './routes/clientRoutes';
import familyRoutes from './routes/familyRoutes';
import webhookRoutes from './routes/webhookRoutes';
import documentRoutes from './routes/documentRoutes';
import { errorMiddleware } from './middleware/errorMiddleware';

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/clients', clientRoutes);
app.use('/api/v1/family', familyRoutes);
app.use('/api/v1/webhooks', webhookRoutes);
app.use('/api/v1/documents', documentRoutes);

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', message: 'Platform Migratory Backend is running' });
});

app.use(errorMiddleware);

export default app;
