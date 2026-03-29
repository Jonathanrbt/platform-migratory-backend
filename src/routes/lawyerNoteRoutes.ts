import { Router } from 'express';
import { createNote, getNotesByClient, updateNoteStatus } from '../controllers/lawyerNoteController';
import { validateRequest } from '../middleware/validateRequest';
import { lawyerNoteSchema } from '../models/LawyerNote';
import { authMiddleware } from '../middleware/authMiddleware';
import { roleMiddleware } from '../middleware/roleMiddleware';

const router = Router({ mergeParams: true });

router.use(authMiddleware);

router.post('/', roleMiddleware(['Abogado']), createNote);
router.get('/', roleMiddleware(['Abogado', 'Cliente']), getNotesByClient);
router.patch('/:noteId/status', roleMiddleware(['Abogado', 'Cliente']), updateNoteStatus);

export default router;
