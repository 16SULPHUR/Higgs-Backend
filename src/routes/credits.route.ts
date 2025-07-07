import express from 'express';
import { assignCredits } from '../controllers/credits/credits.controller.js';

const creditRoutes = express.Router();

creditRoutes.post('/:id', assignCredits);

export default creditRoutes;
