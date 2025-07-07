import express from 'express';
import {
    createBooking,
    listUserBookings,
    cancelBooking
} from '../controllers/rooms/bookings.controller.js';
import { authorize } from '../middleware/auth.js';
import { ROLES } from '../lib/constants.js';

const bookingsRoutes = express.Router();

bookingsRoutes.post('/', authorize([ROLES.ADMIN, ROLES.ORG_ADMIN, ROLES.INDIVIDUAL_USER]), createBooking);

bookingsRoutes.get('/', listUserBookings);

bookingsRoutes.delete('/:id', cancelBooking);

export default bookingsRoutes;