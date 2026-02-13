import { Router } from 'express';
import { handleDriveWebhook } from '../controllers/driveWebhookController';

const router = Router();

// Endpoint for Google Drive Push Notifications
router.post('/drive', handleDriveWebhook);

export default router;
