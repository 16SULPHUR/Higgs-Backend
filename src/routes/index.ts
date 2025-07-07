import { Router } from 'express';
import plansRoutes from './plans.route.js';
import authRoutes from '../routes/auth.route.js';
import orgsRoutes from './orgs.route.js';
import meetingRoomsRoutes from './meetingRooms.route.js';
import availabilityRoutes from './availability.route.js';
import bookingsRoutes from './booking.route.js';
import { authenticate } from '../middleware/auth.js';
import { ADMIN_ROLES } from '../lib/constants.js';
import profileRoutes from './profile.route.js';
import creditRoutes from './credits.route.js';
import { adminEventsRoutes, eventsRoutes } from './events.route.js';
import { authorizeAdmin } from '../middleware/authorizeAdmin.js';
import adminAuthRoutes from './adminAuthRoutes.js';
import locationsRoutes from './locationsRoutes.js';
import usersRoutes from './users.route.js';

const router = Router();

router.use('/auth', authRoutes);
router.use('/availability', authenticate, availabilityRoutes);
router.use('/bookings', authenticate, bookingsRoutes);
router.use('/events', authenticate, eventsRoutes);
router.use('/profile', authenticate, profileRoutes);

router.use('/admin/auth', adminAuthRoutes)
router.use('/admin/users', authorizeAdmin([ADMIN_ROLES.SUPER_ADMIN, ADMIN_ROLES.LOCATION_ADMIN]), usersRoutes);

router.use('/admin/plans', authorizeAdmin([ADMIN_ROLES.SUPER_ADMIN, ADMIN_ROLES.LOCATION_ADMIN]), plansRoutes);

router.use('/admin/orgs', authorizeAdmin([ADMIN_ROLES.SUPER_ADMIN, ADMIN_ROLES.LOCATION_ADMIN]), orgsRoutes);

router.use('/admin/events',  adminEventsRoutes);

router.use('/meeting-rooms',  meetingRoomsRoutes);

router.use('/admin/assign-credits', authorizeAdmin([ADMIN_ROLES.SUPER_ADMIN, ADMIN_ROLES.LOCATION_ADMIN]), creditRoutes);

router.use('/admin/locations', locationsRoutes); 


export default router;
