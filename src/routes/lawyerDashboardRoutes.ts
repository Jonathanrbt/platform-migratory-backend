import { Router } from 'express';
import { getDashboard } from '../controllers/dashboardController';
import { authMiddleware } from '../middleware/authMiddleware';
import { roleMiddleware } from '../middleware/roleMiddleware';

const router = Router();

router.use(authMiddleware);
router.use(roleMiddleware(['Abogado']));

// Dashboard endpoint
router.get('/', getDashboard);

export default router;