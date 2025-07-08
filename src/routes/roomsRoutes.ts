import express from 'express';
import { authorizeAdmin } from '../middleware/authorizeAdmin.js';
import { createRoom, deleteRoom, getAllRooms, getRoomById, updateRoom } from '../controllers/rooms/rooms.controller.js';


const router = express.Router();
const allowedRoles = ['SUPER_ADMIN', 'LOCATION_ADMIN'];

router.get('/admin/', authorizeAdmin(allowedRoles), getAllRooms);
router.post('/admin/', authorizeAdmin(allowedRoles), createRoom);
router.get('/admin/:id', authorizeAdmin(allowedRoles), getRoomById);
router.patch('/admin/:id', authorizeAdmin(allowedRoles), updateRoom);
router.delete('/admin/:id', authorizeAdmin(allowedRoles), deleteRoom);

export default router;
