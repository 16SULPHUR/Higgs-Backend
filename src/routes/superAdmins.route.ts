import express from 'express';
import { authorizeAdmin, requireSuperAdmin } from '../middleware/authorizeAdmin.js';
import { createOrPromoteSuperAdmin, demoteOrDeactivateSuperAdmin, listSuperAdmins } from '../controllers/adminControllers/superAdmins.controller.js';

const superAdminsRoutes = express.Router();

superAdminsRoutes.use(authorizeAdmin, requireSuperAdmin);

superAdminsRoutes.get('/', listSuperAdmins);
superAdminsRoutes.post('/', createOrPromoteSuperAdmin);
superAdminsRoutes.delete('/:id', demoteOrDeactivateSuperAdmin);

export default superAdminsRoutes;



