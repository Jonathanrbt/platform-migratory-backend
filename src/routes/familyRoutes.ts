import express from 'express';
import { createFamily, addMember, removeMember, getFamilyDetails, searchUserByDocument } from '../controllers/familyController';
import { authMiddleware } from '../middleware/authMiddleware';

const router = express.Router();

// All family routes require authentication
router.use(authMiddleware);

// Search user by document number for family inclusion
router.get('/candidates/:documentNumber', searchUserByDocument);

// Create a new family (user becomes admin)
router.post('/', createFamily);

// Add a member by document number (admin only)
router.post('/members', addMember);

// Remove a member by ID (admin only)
router.delete('/members/:memberId', removeMember);

// Get family details (available to all members)
router.get('/me', getFamilyDetails);

export default router;
