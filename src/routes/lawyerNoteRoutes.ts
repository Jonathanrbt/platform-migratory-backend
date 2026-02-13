import { Router } from 'express';
import { createNote, getNotesByClient } from '../controllers/lawyerNoteController';
import { validateRequest } from '../middleware/validateRequest';
import { lawyerNoteSchema } from '../models/LawyerNote';
import { authMiddleware } from '../middleware/authMiddleware';
import { roleMiddleware } from '../middleware/roleMiddleware';

const router = Router({ mergeParams: true });

router.use(authMiddleware);
router.use(roleMiddleware(['Abogado']));

router.post('/', validateRequest(lawyerNoteSchema), createNote);
router.get('/', getNotesByClient);

export default router;
