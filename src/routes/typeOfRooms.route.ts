import express from 'express';
import { authorizeAdmin } from '../middleware/authorizeAdmin.js';
import { createRoomType, deleteRoomType, getAllRoomTypes, getRoomTypeById, updateRoomType } from '../controllers/rooms/typeOfRooms.controller.js';

const router = express.Router();
const allowedRoles = ['SUPER_ADMIN', 'LOCATION_ADMIN'];

router.get('/admin/', authorizeAdmin(allowedRoles), getAllRoomTypes);
router.post('/admin/', authorizeAdmin(allowedRoles), createRoomType);
router.get('/admin/:id', authorizeAdmin(allowedRoles), getRoomTypeById);
router.patch('/admin/:id', authorizeAdmin(allowedRoles), updateRoomType);
router.delete('/admin/:id', authorizeAdmin(allowedRoles), deleteRoomType);

export default router;