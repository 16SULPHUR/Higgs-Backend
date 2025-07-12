import express from 'express';
import { getProfile, updateUserProfile } from '../controllers/profile/profile.controller.js';
 
import multer from 'multer';

const upload = multer({ storage: multer.memoryStorage() });
const profileRoutes = express.Router();

profileRoutes.get('/', getProfile);
profileRoutes.patch(
    '/', 
    upload.single('profile_picture'), 
    updateUserProfile
);

export default profileRoutes;
