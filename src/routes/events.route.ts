import express from 'express';
import {
    createEvent,
    updateEvent,
    deleteEvent,
    getEventById,
    getAllEventsWithDetails
} from '../controllers/events/events.controller.js';
import { deregisterInEvent, getEventRegistrations, registerInEvent } from '../controllers/events/events.registration.conntroller.js';
// import { authorize } from '../middleware/auth.js';
import { ADMIN_ROLES } from '../lib/constants.js';
import multer from 'multer'
import { authorizeAdmin } from '../middleware/authorizeAdmin.js';

const storage = multer.memoryStorage()

const upload = multer({ storage: storage })

const adminEventsRoutes = express.Router();
const eventsRoutes = express.Router();

adminEventsRoutes.get('/', authorizeAdmin([ADMIN_ROLES.SUPER_ADMIN, ADMIN_ROLES.LOCATION_ADMIN]), getAllEventsWithDetails);

adminEventsRoutes.get('/:id', authorizeAdmin([ADMIN_ROLES.SUPER_ADMIN, ADMIN_ROLES.LOCATION_ADMIN]), getEventById);

adminEventsRoutes.post('/', authorizeAdmin([ADMIN_ROLES.SUPER_ADMIN, ADMIN_ROLES.LOCATION_ADMIN]), upload.single("eventImage"), createEvent);

adminEventsRoutes.patch('/:id', authorizeAdmin([ADMIN_ROLES.SUPER_ADMIN, ADMIN_ROLES.LOCATION_ADMIN]), updateEvent);

adminEventsRoutes.delete('/:id', authorizeAdmin([ADMIN_ROLES.SUPER_ADMIN, ADMIN_ROLES.LOCATION_ADMIN]), deleteEvent);

adminEventsRoutes.get('/:eventId/registrations', authorizeAdmin([ADMIN_ROLES.SUPER_ADMIN, ADMIN_ROLES.LOCATION_ADMIN]), getEventRegistrations);

// -----------------------------------------

eventsRoutes.get('/:id', getEventById);


eventsRoutes.post('/:eventId/register', registerInEvent);

eventsRoutes.delete('/:eventId/calcel-registration', deregisterInEvent);



export { eventsRoutes, adminEventsRoutes };