import express from 'express';
import { getMe, loginAdmin, logoutAdmin, registerAdmin } from '../controllers/adminControllers/auth.controller.js';
// import { ADMIN_ROLES } from '../lib/constants.js';
import { authorizeAdmin } from '../middleware/authorizeAdmin.js';

const adminAuthRoutes = express.Router();

adminAuthRoutes.post('/login', loginAdmin);
adminAuthRoutes.post(
    '/logout',
    (req, res, next) => authorizeAdmin(req, res, next),
    logoutAdmin
);
adminAuthRoutes.post(
    '/register',
    // authorizeAdmin([ADMIN_ROLES.SUPER_ADMIN]), 
    registerAdmin
);

adminAuthRoutes.get('/me', (req, res, next) => authorizeAdmin(req, res, next), getMe);


export default adminAuthRoutes;