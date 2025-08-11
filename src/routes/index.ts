import { Router } from 'express';
import plansRoutes from './plans.route.js';
import authRoutes from '../routes/auth.route.js';
import availabilityRoutes from './availability.route.js';
import bookingsRoutes from './booking.route.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { ROLES } from '../lib/constants.js';
import profileRoutes from './profile.route.js';
import creditRoutes from './credits.route.js';
import { adminEventsRoutes, eventsRoutes, publicEventsRoutes } from './events.route.js';
import { authorizeAdmin } from '../middleware/authorizeAdmin.js';
import adminAuthRoutes from './adminAuthRoutes.js';
import locationsRoutes from './locationsRoutes.js';
import publicLocationsRoutes from './publicLocations.route.js';
import { adminMeetingRoomsRoutes, meetingRoomsRoutes } from './meetingRooms.route.js';
import typeOfRoomsRouter from './adminTypeOfRooms.route.js';
import roomsRouter from './roomsRoutes.js';
import adminBookingRoutes from './adminBooking.route.js';
import { adminUsersRoutes, usersRoutes } from './users.route.js';
import { adminOrgsRoutes, orgAdminOrgsRoutes } from './orgs.route.js';
import supportTicketsRouter from './adminSupportTicketsRoutes.js';
import userSupportTicketsRouter from './userSupportTicketsRoutes.js';

const router = Router();

router.use('/auth', authRoutes);
router.use('/availability', authenticate, availabilityRoutes);
router.use('/bookings', authenticate, bookingsRoutes);
router.use('/events', eventsRoutes);
router.use('/profile', authenticate, profileRoutes);
router.use('/room-types', authenticate, typeOfRoomsRouter)
router.use('/users', authenticate, usersRoutes)
router.use('/support-tickets', authenticate, userSupportTicketsRouter)
router.use('/meeting-rooms', meetingRoomsRoutes);
router.use('/orgs', authenticate, authorize([ROLES.ORG_ADMIN]), orgAdminOrgsRoutes)

router.use('/public/events', publicEventsRoutes);


router.use('/admin/auth', adminAuthRoutes)
router.use('/admin/users', (req, res, next) => authorizeAdmin(req, res, next), adminUsersRoutes);

router.use('/admin/plans', (req, res, next) => authorizeAdmin(req, res, next), plansRoutes);

router.use('/admin/orgs', (req, res, next) => authorizeAdmin(req, res, next), adminOrgsRoutes);

router.use('/admin/events', (req, res, next) => authorizeAdmin(req, res, next), adminEventsRoutes);


router.use('/admin/room-types', (req, res, next) => authorizeAdmin(req, res, next), typeOfRoomsRouter)

router.use('/admin/rooms', (req, res, next) => authorizeAdmin(req, res, next), roomsRouter)

router.use('/admin/room', (req, res, next) => authorizeAdmin(req, res, next), typeOfRoomsRouter)

router.use('/admin/meeting-rooms', (req, res, next) => authorizeAdmin(req, res, next), adminMeetingRoomsRoutes);

router.use('/admin/bookings', (req, res, next) => authorizeAdmin(req, res, next), adminBookingRoutes);

router.use('/admin/assign-credits', (req, res, next) => authorizeAdmin(req, res, next), creditRoutes);

router.use('/admin/locations', locationsRoutes);

// Public locations for signup
router.use('/public/locations', publicLocationsRoutes);

router.use('/admin/support-tickets', (req, res, next) => authorizeAdmin(req, res, next), supportTicketsRouter);


export default router;
