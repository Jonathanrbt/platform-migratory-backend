import { Router } from 'express';
import { getClients, createClient, updateClient, deleteClient, getClientById, getProfile, getProgress, submitApplication } from '../controllers/clientController';
import { validateRequest } from '../middleware/validateRequest';
import { clientSchema } from '../models/Client';
import { authMiddleware } from '../middleware/authMiddleware';
import { roleMiddleware } from '../middleware/roleMiddleware';
import { auditProfileChanges } from '../middleware/auditMiddleware';
import lawyerNoteRoutes from './lawyerNoteRoutes';

const router = Router();

router.use(authMiddleware);

// Profile route for the logged-in user
router.get('/profile', getProfile);

// Routes with specific role permissions
router.post('/', roleMiddleware(['Abogado', 'Cliente']), validateRequest(clientSchema), createClient);
router.get('/', roleMiddleware(['Abogado']), getClients);
router.get('/:id', roleMiddleware(['Abogado', 'Cliente']), getClientById);
router.delete('/:id', roleMiddleware(['Abogado']), deleteClient);

// Get progress
router.get('/:id/progress', roleMiddleware(['Abogado', 'Cliente']), getProgress);

// Submit application
router.post('/:id/submit', roleMiddleware(['Cliente']), submitApplication);

// Both Abogados and Clientes can update, but logic in controller restricts Clientes
router.patch('/:id', roleMiddleware(['Abogado', 'Cliente']), validateRequest(clientSchema.partial()), auditProfileChanges, updateClient);
router.put('/:id', roleMiddleware(['Abogado', 'Cliente']), validateRequest(clientSchema.partial()), auditProfileChanges, updateClient);

// Mount nested routes at the end to avoid intercepting base routes
router.use('/:clientId/notes', lawyerNoteRoutes);

export default router;
