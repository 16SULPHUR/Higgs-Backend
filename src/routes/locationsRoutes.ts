import express from 'express';
import { authorizeAdmin } from '../middleware/authorizeAdmin.js';
import { getAllLocations, getLocationById } from '../controllers/locations/locations.controller.js';


const locationsRoutes = express.Router();



locationsRoutes.get('/', (req, res, next) => authorizeAdmin(req, res, next), getAllLocations);


locationsRoutes.get('/:id', (req, res, next) => authorizeAdmin(req, res, next), getLocationById);

export default locationsRoutes;