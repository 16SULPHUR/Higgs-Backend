import express from 'express';
import { googleAuthController } from '../controllers/auth/auth.controller.js';
import { getMe, login, register, verifyOtp } from '../controllers/auth/email.auth.controller.js';
import { authenticate } from '../middleware/auth.js';
import { refreshTokenController } from '../controllers/auth/token.controller.js';

const router = express.Router();

router.post('/google', googleAuthController);
router.post('/email-auth/register', register);
router.post('/email-auth/login', login);
router.post('/verify-otp', verifyOtp);
router.get('/me',authenticate, getMe); 
router.post('/refresh-token', refreshTokenController);


export default router;