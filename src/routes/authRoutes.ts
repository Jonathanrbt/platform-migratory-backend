import { Router } from 'express';
import { register, login, googleLogin } from '../controllers/authController';
import { validateRequest } from '../middleware/validateRequest';
import { userSchema, loginSchema, googleLoginSchema } from '../models/User';

const router = Router();

router.post('/register', validateRequest(userSchema), register);
router.post('/login', validateRequest(loginSchema), login);
router.post('/google', validateRequest(googleLoginSchema), googleLogin);

export default router;
