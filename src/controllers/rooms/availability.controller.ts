


import { Request, Response } from 'express';
import pool from '../../lib/db.js';

export const getRoomAvailability = async (req: Request, res: Response) => {
    const { room_id, date } = req.query; 
    
    if (!room_id || !date || typeof date !== 'string') {
        return res.status(400).json({ message: 'A valid room_id and date (YYYY-MM-DD) are required.' });
    }

    try {
        
        const roomDetailsResult = await pool.query(
            'SELECT operating_start_time, operating_end_time FROM meeting_rooms WHERE id = $1 AND availability = TRUE',
            [room_id]
        );

        if (roomDetailsResult.rowCount === 0) {
            return res.status(404).json({ message: 'Active meeting room not found.' });
        }

        const { operating_start_time, operating_end_time } = roomDetailsResult.rows[0];

        
        const bookingsResult = await pool.query(
            `SELECT start_time, end_time FROM bookings
             WHERE meeting_room_id = $1 AND status = 'CONFIRMED' AND start_time::date = $2`,
            [room_id, date]
        );
        const existingBookings = bookingsResult.rows;

        
        const availabilitySlots = [];
        const dayStart = new Date(`${date}T${operating_start_time}Z`);
        const dayEnd = new Date(`${date}T${operating_end_time}Z`);

        let currentSlotStart = new Date(dayStart);

        while (currentSlotStart < dayEnd) {
            const currentSlotEnd = new Date(currentSlotStart.getTime() + 30 * 60 * 1000);

            
            const isAvailable = !existingBookings.some(booking => {
                const bookingStart = new Date(booking.start_time);
                const bookingEnd = new Date(booking.end_time);
                return currentSlotStart < bookingEnd && currentSlotEnd > bookingStart;
            });

            availabilitySlots.push({
                start_time: currentSlotStart.toISOString(),
                end_time: currentSlotEnd.toISOString(),
                is_available: isAvailable,
            });

            currentSlotStart = currentSlotEnd;
        }

        res.json(availabilitySlots);

    } catch (err) {
        console.error('Error fetching availability:', err);
        res.status(500).json({ message: 'Failed to fetch availability' });
    }
};