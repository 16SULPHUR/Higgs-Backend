import express from 'express';
import {
    createBooking,
    listUserBookings,
    cancelBooking,
    getBookingById,
    rescheduleBooking
} from '../controllers/rooms/bookings.controller.js';
import { authorize } from '../middleware/auth.js';
import { ROLES } from '../lib/constants.js';
import { getBookingInvitations, inviteGuestToBooking } from '../controllers/rooms/invites.controller.js';

const bookingsRoutes = express.Router();

bookingsRoutes.post('/', authorize([ROLES.ADMIN, ROLES.ORG_ADMIN, ROLES.INDIVIDUAL_USER]), createBooking);

bookingsRoutes.get('/', listUserBookings);

bookingsRoutes.get('/:id', getBookingById);

bookingsRoutes.delete('/:id', cancelBooking);

bookingsRoutes.post('/:bookingId/invite', inviteGuestToBooking);

bookingsRoutes.get('/:bookingId/invitations', getBookingInvitations);

bookingsRoutes.post('/:bookingId/reschedule', rescheduleBooking);

export default bookingsRoutes;