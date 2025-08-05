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
// import { ADMIN_ROLES } from '../lib/constants.js';
import multer from 'multer'
import { authorizeAdmin } from '../middleware/authorizeAdmin.js';
import { getEventDetails, getRegistrationStatus, listAllEventIds, listAllEventsForGuest, listAllEventsForUser } from '../controllers/events/userEvents.controller.js';
import { authenticate } from '../middleware/auth.js';
import { registerGuestForEvent } from '../controllers/events/publicEvents.controller.js';

const storage = multer.memoryStorage()

const upload = multer({
    storage: storage, limits: {
        fileSize: 5 * 1024 * 1024, // 5 MB
    }
})

const adminEventsRoutes = express.Router();
const publicEventsRoutes = express.Router();
const eventsRoutes = express.Router(); 

adminEventsRoutes.get('/', (req, res, next) => authorizeAdmin(req, res, next), getAllEventsWithDetails);

adminEventsRoutes.get('/:id', (req, res, next) => authorizeAdmin(req, res, next), getEventById);

adminEventsRoutes.post('/', upload.single("eventImage"), (req, res, next) => authorizeAdmin(req, res, next), createEvent);

adminEventsRoutes.patch('/:id', upload.single("eventImage"), (req, res, next) => authorizeAdmin(req, res, next), updateEvent);

adminEventsRoutes.delete('/:id', (req, res, next) => authorizeAdmin(req, res, next), deleteEvent);

adminEventsRoutes.get('/:eventId/registrations', (req, res, next) => authorizeAdmin(req, res, next), getEventRegistrations);

// -----------------------------------------

eventsRoutes.get('/', listAllEventsForUser);

eventsRoutes.get('/ids', listAllEventIds);

eventsRoutes.get('/:id/details', getEventDetails);

eventsRoutes.get('/:id/registration-status', authenticate, getRegistrationStatus);

eventsRoutes.get('/:id', authenticate, getEventById);

eventsRoutes.post('/:eventId/register', authenticate, registerInEvent);

eventsRoutes.delete('/:eventId/cancel-registration', authenticate, deregisterInEvent);

// -------------------------------------------

publicEventsRoutes.get('/', listAllEventsForGuest);
publicEventsRoutes.post('/:eventId/register-guest', registerGuestForEvent);



export { eventsRoutes, adminEventsRoutes, publicEventsRoutes };