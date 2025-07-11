import express from 'express';
import { cancelAnyBooking, getAllBookings } from '../controllers/adminControllers/bookings.controller.js'; 

const adminBookingRoutes
    = express.Router
        (); 

adminBookingRoutes
    .get('/', getAllBookings);
adminBookingRoutes
    .delete('/:bookingId', cancelAnyBooking);

export default adminBookingRoutes
    ;