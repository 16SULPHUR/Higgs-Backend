import express from 'express';
import {
    getAllRooms,
    createRoom,
    updateRoom,
    deleteRoom,
    getRoomById
} from '../controllers/rooms/rooms.controller.js';
import { searchAvailableRooms } from '../controllers/rooms/search.controller.js';
import { authorizeAdmin } from '../middleware/authorizeAdmin.js';
import { ADMIN_ROLES } from '../lib/constants.js';

const meetingRoomsRoutes = express.Router();

meetingRoomsRoutes.get('/', getAllRooms);

meetingRoomsRoutes.post('/admin/', authorizeAdmin([ADMIN_ROLES.SUPER_ADMIN, ADMIN_ROLES.LOCATION_ADMIN]), createRoom);

meetingRoomsRoutes.patch('/admin/:id', authorizeAdmin([ADMIN_ROLES.SUPER_ADMIN, ADMIN_ROLES.LOCATION_ADMIN]), updateRoom);

meetingRoomsRoutes.delete('/admin/:id', authorizeAdmin([ADMIN_ROLES.SUPER_ADMIN, ADMIN_ROLES.LOCATION_ADMIN]), deleteRoom);

meetingRoomsRoutes.get('/search', searchAvailableRooms);

meetingRoomsRoutes.get('/:id', getRoomById);


export default meetingRoomsRoutes;