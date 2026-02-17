import { Router } from 'express';
import { register, login, googleLogin, completeProfile } from '../controllers/authController';
import { validateRequest } from '../middleware/validateRequest';
import { userSchema, loginSchema, googleLoginSchema, completeProfileSchema } from '../models/User';
import { authMiddleware } from '../middleware/authMiddleware';

const router = Router();

router.post('/register', validateRequest(userSchema), register);
router.post('/login', validateRequest(loginSchema), login);
router.post('/google', validateRequest(googleLoginSchema), googleLogin);
router.patch('/complete-profile', authMiddleware, validateRequest(completeProfileSchema), completeProfile);

export default router;
