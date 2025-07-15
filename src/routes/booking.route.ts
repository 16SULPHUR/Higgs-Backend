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

bookingsRoutes.get('/', authorize([ROLES.ADMIN, ROLES.ORG_ADMIN, ROLES.INDIVIDUAL_USER]), listUserBookings);

bookingsRoutes.get('/:id', authorize([ROLES.ADMIN, ROLES.ORG_ADMIN, ROLES.INDIVIDUAL_USER]), getBookingById);

bookingsRoutes.delete('/:id', authorize([ROLES.ADMIN, ROLES.ORG_ADMIN, ROLES.INDIVIDUAL_USER]), cancelBooking);

bookingsRoutes.post('/:bookingId/invite', authorize([ROLES.ADMIN, ROLES.ORG_ADMIN, ROLES.INDIVIDUAL_USER]), inviteGuestToBooking);

bookingsRoutes.get('/:bookingId/invitations', authorize([ROLES.ADMIN, ROLES.ORG_ADMIN, ROLES.INDIVIDUAL_USER]), getBookingInvitations);

bookingsRoutes.post('/:bookingId/reschedule', authorize([ROLES.ADMIN, ROLES.ORG_ADMIN, ROLES.INDIVIDUAL_USER]), rescheduleBooking);

export default bookingsRoutes;