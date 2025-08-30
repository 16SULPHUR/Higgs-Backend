import express from 'express';
import { getProfile, updateUserProfile } from '../controllers/profile/profile.controller.js';
import { 
    requestEmailChange, 
    verifyEmailChangeWithOTP, 
    resendEmailChangeOTP, 
    cancelEmailChange 
} from '../controllers/profile/emailChange.controller.js';
 
import multer from 'multer';

const upload = multer({ storage: multer.memoryStorage() });
const profileRoutes = express.Router();

// Profile management routes
profileRoutes.get('/', getProfile);
profileRoutes.patch(
    '/', 
    upload.single('profile_picture'), 
    updateUserProfile
);

// Email change routes
profileRoutes.post('/change-email', requestEmailChange);
profileRoutes.post('/verify-email-change', verifyEmailChangeWithOTP);
profileRoutes.post('/resend-email-change-otp', resendEmailChangeOTP);
profileRoutes.delete('/change-email', cancelEmailChange);

export default profileRoutes;
