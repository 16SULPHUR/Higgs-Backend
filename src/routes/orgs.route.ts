import express from 'express';
import { createNewOrg, deleteOrg, getAllOrgs, getCurrentOrgPlan, getOrgById, setAdmin, updateOrg } from '../controllers/orgs/orgs.controller.js';

const orgsRoutes = express.Router();

orgsRoutes.get('/', getAllOrgs);
orgsRoutes.get('/:id', getOrgById);
orgsRoutes.post('/', createNewOrg);
orgsRoutes.patch('/:id', updateOrg);
orgsRoutes.delete('/:id', deleteOrg);

orgsRoutes.post('/:orgId/set-admin', setAdmin);
orgsRoutes.get('/:orgId/plan', getCurrentOrgPlan);


export default orgsRoutes;