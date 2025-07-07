import express from 'express';
import { getRoomAvailability } from '../controllers/rooms/availability.controller.js';

const availabilityRoutes = express.Router();

availabilityRoutes.get('/', getRoomAvailability);

export default availabilityRoutes;