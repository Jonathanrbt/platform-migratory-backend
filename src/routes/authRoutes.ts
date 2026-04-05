import { Router } from 'express';
import { 
    register, login, googleLogin, googleAuthUrl, googleCallback, 
    completeProfile, getCurrentUser, verifyEmail, resendVerification, 
    forgotPassword, resetPassword 
} from '../controllers/authController';
import { validateRequest } from '../middleware/validateRequest';
import { userSchema, loginSchema, googleLoginSchema, completeProfileSchema } from '../models/User';
import { authMiddleware } from '../middleware/authMiddleware';

const router = Router();

router.post('/register', validateRequest(userSchema), register);
router.post('/login', validateRequest(loginSchema), login);
router.post('/verify-email', verifyEmail);
router.post('/resend-verification', resendVerification);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);

router.post('/google', validateRequest(googleLoginSchema), googleLogin);
router.get('/google/url', googleAuthUrl);
router.get('/google/callback', googleCallback);
router.get('/me', authMiddleware, getCurrentUser);
router.patch('/complete-profile', authMiddleware, validateRequest(completeProfileSchema), completeProfile);

export default router;