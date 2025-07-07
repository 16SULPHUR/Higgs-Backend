import express from 'express';
import { getProfile, updateProfile } from '../controllers/profile/profile.controller.js';

const profileRoutes = express.Router();

profileRoutes.get('/', getProfile);
profileRoutes.patch('/', updateProfile);

export default profileRoutes;
