import express from 'express';
import { createNewPlan, deletePlan, getAllPlans, getPlanById, updatePlan } from '../controllers/plans/plans.controller.js';

const plansRoutes = express.Router();

plansRoutes.get('/', getAllPlans);
plansRoutes.get('/:id', getPlanById);
plansRoutes.post('/', createNewPlan);
plansRoutes.patch('/:id', updatePlan);
plansRoutes.delete('/:id', deletePlan);

export default plansRoutes;
