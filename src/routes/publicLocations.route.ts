import { Router } from 'express';
import { getAllLocations, getLocationById } from '../controllers/locations/locations.controller.js';

const publicLocationsRoutes = Router();

// Public endpoints to fetch locations for signup flows
publicLocationsRoutes.get('/', getAllLocations);
publicLocationsRoutes.get('/:id', getLocationById);

export default publicLocationsRoutes;

