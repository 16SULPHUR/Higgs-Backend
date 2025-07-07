import express from 'express';
import { getMe, loginAdmin, logoutAdmin, registerAdmin } from '../controllers/adminControllers/auth.controller.js';
import { ADMIN_ROLES } from '../lib/constants.js';
import { authorizeAdmin } from '../middleware/authorizeAdmin.js';

const adminAuthRoutes = express.Router();

adminAuthRoutes.post('/login', loginAdmin);
adminAuthRoutes.post('/logout', authorizeAdmin([ADMIN_ROLES.LOCATION_ADMIN, ADMIN_ROLES.SUPER_ADMIN]), logoutAdmin);
adminAuthRoutes.post(
    '/register',
    // authorizeAdmin([ADMIN_ROLES.SUPER_ADMIN]), 
    registerAdmin
);

adminAuthRoutes.get('/me', authorizeAdmin(['SUPER_ADMIN', 'LOCATION_ADMIN']), getMe);


export default adminAuthRoutes;