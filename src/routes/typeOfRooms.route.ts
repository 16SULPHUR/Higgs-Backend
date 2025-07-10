import express from 'express';
import { getRoomTypeById } from '../controllers/rooms/typeOfRooms.controller.js';

const typeOfRoomsRouter = express.Router(); 

typeOfRoomsRouter.get('/:id', getRoomTypeById);

export default typeOfRoomsRouter;