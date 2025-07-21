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
import { listAllEventsForUser } from '../controllers/events/userEvents.controller.js';

const storage = multer.memoryStorage()

const upload = multer({
    storage: storage, limits: {
        fileSize: 5 * 1024 * 1024, // 5 MB
    }
})

const adminEventsRoutes = express.Router();
const eventsRoutes = express.Router();

adminEventsRoutes.get('/', (req, res, next) => authorizeAdmin(req, res, next), getAllEventsWithDetails);

adminEventsRoutes.get('/:id', (req, res, next) => authorizeAdmin(req, res, next), getEventById);

adminEventsRoutes.post('/', upload.single("eventImage"), (req, res, next) => authorizeAdmin(req, res, next), createEvent);

adminEventsRoutes.patch('/:id', upload.single("eventImage"), (req, res, next) => authorizeAdmin(req, res, next), updateEvent);

adminEventsRoutes.delete('/:id', (req, res, next) => authorizeAdmin(req, res, next), deleteEvent);

adminEventsRoutes.get('/:eventId/registrations', (req, res, next) => authorizeAdmin(req, res, next), getEventRegistrations);

// -----------------------------------------

eventsRoutes.get('/', listAllEventsForUser);

eventsRoutes.get('/:id', getEventById);

eventsRoutes.post('/:eventId/register', registerInEvent);

eventsRoutes.delete('/:eventId/cancel-registration', deregisterInEvent);



export { eventsRoutes, adminEventsRoutes };