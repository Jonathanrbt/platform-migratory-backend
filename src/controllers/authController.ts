import { Request, Response } from 'express';
import { AuthService } from '../services/authService';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError } from '../utils/AppError';

const authService = new AuthService();

export const register = asyncHandler(async (req: Request, res: Response) => {
    const result = await authService.register(req.body);
    res.status(201).json({
        status: 'success',
        data: result
    });
});

export const login = asyncHandler(async (req: Request, res: Response) => {
    const { email, password } = req.body;
    const result = await authService.login(email, password);
    res.status(200).json({
        status: 'success',
        data: result
    });
});

export const googleLogin = asyncHandler(async (req: Request, res: Response) => {
    const { idToken } = req.body;
    const result = await authService.googleLogin(idToken);
    res.status(200).json({
        status: 'success',
        data: result
    });
});

export const googleAuthUrl = asyncHandler(async (req: Request, res: Response) => {
    console.info('[googleAuthUrl] Starting Google Auth URL generation...');
    const result = authService.generateGoogleAuthUrl();
    
    console.info(`[googleAuthUrl] Generated URL (truncated): ${result.url.substring(0, 50)}...`);
    console.info(`[googleAuthUrl] Generated State: ${result.state}`);

    // Guardar el state en una cookie httpOnly, segura y con tiempo de vida corto (ej. 10 min)
    res.cookie('oauth_state', result.state, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 10 * 60 * 1000 // 10 minutos
    });
    console.info('[googleAuthUrl] Cookie oauth_state has been set on response.');

    res.status(200).json({
        status: 'success',
        data: { url: result.url }
    });
});

export const googleCallback = asyncHandler(async (req: Request, res: Response) => {
    console.info('[googleCallback] Callback received from Google');
    const { code, state } = req.query;
    const cookieState = req.cookies.oauth_state;

    console.info(`[googleCallback] Query Code exists: ${!!code}, Query State: ${state}, Cookie State: ${cookieState}`);

    // Validación estricta del parámetro state para evitar CSRF
    if (!state || !cookieState || state !== cookieState) {
        console.error(`[googleCallback] CSRF Validation Failed! state: ${state}, cookieState: ${cookieState}`);
        throw new Error('Invalid or missing state parameter. Posible ataque CSRF.');
    }

    if (!code || typeof code !== 'string') {
        console.error('[googleCallback] Authorization code is missing or invalid.');
        throw new Error('Authorization code is missing or invalid.');
    }

    // Limpiar la cookie de estado, ya se utilizó
    res.clearCookie('oauth_state');
    console.info('[googleCallback] Cleared oauth_state cookie');

    console.info('[googleCallback] Proceeding to exchange code for tokens...');
    const result = await authService.googleCallbackLogin(code);

    // Verificar si el usuario ya completó su perfil (tiene tipo y número de documento)
    const isProfileComplete = Boolean(result.user.documentType && result.user.documentNumber);

    // Redirigir al frontend con el token en la URL y el estado del perfil
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

    if (isProfileComplete) {
        console.info(`[googleCallback] Successful login. Profile complete. Redirecting to frontend: ${frontendUrl}/login/success...`);
        res.redirect(`${frontendUrl}/login/success?token=${result.token}&profileComplete=true`);
    } else {
        console.info(`[googleCallback] Successful login. Profile INCOMPLETE. Redirecting to frontend to complete profile...`);
        res.redirect(`${frontendUrl}/login/success?token=${result.token}&profileComplete=false`);
    }
    });
export const completeProfile = asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).user.id;
    const { documentType, documentNumber } = req.body;
    
    if (!documentType || !documentNumber) {
        throw new Error('Document type and number are required');
    }

    const updatedUser = await authService.completeProfile(userId, { documentType, documentNumber });
    
    res.status(200).json({
        status: 'success',
        data: { user: updatedUser }
    });
});

export const getCurrentUser = asyncHandler(async (req: Request, res: Response) => {
    const authUser = (req as any).user;
    
    if (!authUser || !authUser.id) {
        throw new AppError('User not authenticated', 401);
    }

    const fullUser = await authService.getUserById(authUser.id);

    if (!fullUser) {
        throw new AppError('User not found', 404);
    }
    
    res.status(200).json({
        status: 'success',
        data: { user: fullUser }
    });
});
