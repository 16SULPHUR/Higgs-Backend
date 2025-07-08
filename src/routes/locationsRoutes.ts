import express from 'express';
import { authorizeAdmin } from '../middleware/authorizeAdmin.js';
import { getAllLocations, getLocationById } from '../controllers/locations/locations.controller.js';


const locationsRoutes = express.Router();


const allowedRoles = ['SUPER_ADMIN', 'LOCATION_ADMIN', 'SUPPORT_ADMIN'];


locationsRoutes.get('/', authorizeAdmin(allowedRoles), getAllLocations);


locationsRoutes.get('/:id', authorizeAdmin(allowedRoles), getLocationById);

export default locationsRoutes;