import express from 'express';
import { authorizeAdmin } from '../middleware/authorizeAdmin.js';
import { getAllLocations, getLocationById } from '../controllers/locations/locations.controller.js';


const locationsRoutes = express.Router();

// Define the roles that are allowed to access these endpoints
const allowedRoles = ['SUPER_ADMIN', 'LOCATION_ADMIN', 'SUPPORT_ADMIN'];

// A route to get a list of all locations
locationsRoutes.get('/', authorizeAdmin(allowedRoles), getAllLocations);

// A route to get a single location by its ID
locationsRoutes.get('/:id', authorizeAdmin(allowedRoles), getLocationById);

export default locationsRoutes;