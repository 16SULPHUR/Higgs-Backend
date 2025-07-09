import express from 'express'; 
import { createRoom, deleteRoom, getAllRooms, getRoomById, updateRoom } from '../controllers/rooms/rooms.controller.js';


const roomsRouter = express.Router(); 

roomsRouter.get('/', getAllRooms);
roomsRouter.post('/', createRoom);
roomsRouter.get('/:id', getRoomById);
roomsRouter.patch('/:id', updateRoom);
roomsRouter.delete('/:id', deleteRoom);

export default roomsRouter;
