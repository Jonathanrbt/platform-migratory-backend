import { Router } from 'express';
import { reviewClient } from '../controllers/clientController';
import { authMiddleware } from '../middleware/authMiddleware';
import { roleMiddleware } from '../middleware/roleMiddleware';

const router = Router();

router.use(authMiddleware);
router.use(roleMiddleware(['Abogado']));

// Lawyer review endpoint
router.patch('/:id/review', reviewClient);

export default router;