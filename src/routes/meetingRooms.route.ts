import express from 'express';
import {
    getAllRooms,
    createRoom,
    updateRoom,
    deleteRoom,
    getRoomById
} from '../controllers/rooms/meeting_rooms.controller.js';
import { searchAvailableRooms } from '../controllers/rooms/search.controller.js';

const meetingRoomsRoutes = express.Router();
const adminMeetingRoomsRoutes = express.Router();

meetingRoomsRoutes.get('/', getAllRooms);

meetingRoomsRoutes.get('/search', searchAvailableRooms);

meetingRoomsRoutes.get('/:id', getRoomById);

adminMeetingRoomsRoutes.get('/', getAllRooms);

adminMeetingRoomsRoutes.post('/', createRoom);

adminMeetingRoomsRoutes.patch('/:id', updateRoom);

adminMeetingRoomsRoutes.delete('/:id', deleteRoom);


export { meetingRoomsRoutes, adminMeetingRoomsRoutes };