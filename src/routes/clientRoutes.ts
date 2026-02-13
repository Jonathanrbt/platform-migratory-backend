import { Router } from 'express';
import { getClients, createClient, updateClient, deleteClient } from '../controllers/clientController';
import { validateRequest } from '../middleware/validateRequest';
import { clientSchema } from '../models/Client';
import { authMiddleware } from '../middleware/authMiddleware';
import { roleMiddleware } from '../middleware/roleMiddleware';
import lawyerNoteRoutes from './lawyerNoteRoutes';

const router = Router();

// Mount nested routes
router.use('/:clientId/notes', lawyerNoteRoutes);

router.use(authMiddleware);

// Only Abogados can see the list of all clients or create/delete
router.get('/', roleMiddleware(['Abogado']), getClients);
router.post('/', roleMiddleware(['Abogado']), validateRequest(clientSchema), createClient);
router.delete('/:id', roleMiddleware(['Abogado']), deleteClient);

// Both Abogados and Clientes can update, but logic in controller restricts Clientes
router.patch('/:id', updateClient);

export default router;
