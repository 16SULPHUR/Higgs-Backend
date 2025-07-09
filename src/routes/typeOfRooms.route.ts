import express from 'express'; 
import { createRoomType, deleteRoomType, getAllRoomTypes, getRoomTypeById, updateRoomType } from '../controllers/rooms/typeOfRooms.controller.js';

const typeOfRoomsRouter = express.Router(); 

typeOfRoomsRouter.get('/', getAllRoomTypes);
typeOfRoomsRouter.post('/', createRoomType);
typeOfRoomsRouter.get('/:id', getRoomTypeById);
typeOfRoomsRouter.patch('/:id', updateRoomType);
typeOfRoomsRouter.delete('/:id', deleteRoomType);

export default typeOfRoomsRouter;