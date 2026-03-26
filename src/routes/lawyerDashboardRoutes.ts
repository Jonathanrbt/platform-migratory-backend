import { Router } from 'express';
import { getDashboard, updateAlertStatus } from '../controllers/dashboardController';
import { authMiddleware } from '../middleware/authMiddleware';
import { roleMiddleware } from '../middleware/roleMiddleware';

const router = Router();

router.use(authMiddleware);
router.use(roleMiddleware(['Abogado']));

// Dashboard endpoints
router.get('/', getDashboard);
router.patch('/alerts/:alertId/status', updateAlertStatus);

export default router;