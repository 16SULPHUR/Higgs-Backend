import express from 'express';
import { 
    createLocationAdmin, 
    getAllLocationAdmins, 
    getLocationAdminById, 
    updateLocationAdmin, 
    deleteLocationAdmin 
} from '../controllers/adminControllers/locationAdmins.controller.js';
import { authorizeAdmin } from '../middleware/authorizeAdmin.js';

const locationAdminsRoutes = express.Router();

// All routes require admin authorization
locationAdminsRoutes.use(authorizeAdmin);

// Create new location admin
locationAdminsRoutes.post('/', createLocationAdmin);

// Get all location admins
locationAdminsRoutes.get('/', getAllLocationAdmins);

// Get location admin by ID
locationAdminsRoutes.get('/:id', getLocationAdminById);
 
locationAdminsRoutes.put('/:id', updateLocationAdmin);
 
locationAdminsRoutes.delete('/:id', deleteLocationAdmin);

export default locationAdminsRoutes;

