import express from 'express';
import { cancelOrganizationPlan, createNewOrg, deleteOrg, getAllOrgs, getCurrentOrgPlan, getOrgById, setAdmin, updateOrg } from '../controllers/orgs/orgs.controller.js';
import { getOwnOrgProfile, updateOwnOrgProfile } from '../controllers/orgs/orgProfile.controller.js';
import multer from 'multer';

const adminOrgsRoutes = express.Router();
const orgAdminOrgsRoutes = express.Router();
 
const upload = multer({ storage: multer.memoryStorage() });

adminOrgsRoutes.get('/', getAllOrgs);
adminOrgsRoutes.get('/:id', getOrgById);
adminOrgsRoutes.post('/', createNewOrg);
adminOrgsRoutes.patch('/:id', updateOrg);
adminOrgsRoutes.delete('/:id', deleteOrg);

adminOrgsRoutes.post('/:orgId/set-admin', setAdmin);
adminOrgsRoutes.get('/:orgId/plan', getCurrentOrgPlan);

adminOrgsRoutes.delete('/:orgId/plan', cancelOrganizationPlan);

orgAdminOrgsRoutes.get(
    '/profile',
    getOwnOrgProfile
);

orgAdminOrgsRoutes.patch(
    '/profile',
    upload.single('logo_image'),
    updateOwnOrgProfile
);


export {adminOrgsRoutes, orgAdminOrgsRoutes};