import express from 'express';
import {
    getAllRooms,
    createRoom,
    updateRoom,
    deleteRoom,
} from '../controllers/rooms/meeting_rooms.controller.js';
import { searchAvailableRoomTypes } from '../controllers/rooms/search.controller.js';
import { getAllRoomTypes, getRoomTypeById } from '../controllers/rooms/typeOfRooms.controller.js';
const meetingRoomsRoutes = express.Router();
const adminMeetingRoomsRoutes = express.Router();

// meetingRoomsRoutes.get('/', getAllRooms);

meetingRoomsRoutes.get('/', getAllRoomTypes);

meetingRoomsRoutes.get('/search', searchAvailableRoomTypes);

// meetingRoomsRoutes.get('/:id', getRoomById);

meetingRoomsRoutes.get('/:id', getRoomTypeById);

adminMeetingRoomsRoutes.get('/', getAllRooms);

adminMeetingRoomsRoutes.post('/', createRoom);

adminMeetingRoomsRoutes.patch('/:id', updateRoom);

adminMeetingRoomsRoutes.delete('/:id', deleteRoom);


export { meetingRoomsRoutes, adminMeetingRoomsRoutes };