import { Router } from 'express';
import { reviewClient } from '../controllers/clientController';
import { authMiddleware } from '../middleware/authMiddleware';
import { roleMiddleware } from '../middleware/roleMiddleware';
import { streamDocument, getClientDocumentsForReview } from '../controllers/lawyerDocumentController';
import { getFamilyMembersByLawyer } from '../controllers/familyController';

const router = Router();

router.use(authMiddleware);
router.use(roleMiddleware(['Abogado']));

// Lawyer review endpoint
router.patch('/:id/review', reviewClient);

// Lawyer documents list endpoint
router.get('/:id/documents', getClientDocumentsForReview);

// Lawyer document stream endpoint
router.get('/documents/:documentId/view', streamDocument);

// Lawyer family group endpoint
router.get('/:id/family', getFamilyMembersByLawyer);

export default router;