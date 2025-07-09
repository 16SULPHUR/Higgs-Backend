import { Request, Response } from 'express';
import pool from '../../lib/db.js';

export const searchAvailableRoomTypes = async (req: Request, res: Response) => {
    const { date, startTime, endTime, capacity } = req.query;

    if (!date || !startTime || !endTime || !capacity) {
        return res.status(400).json({ message: 'Date, start time, end time, and capacity are required.' });
    }

    try {
        const searchStartTimestamp = `${date}T${startTime}:00Z`;
        const searchEndTimestamp = `${date}T${endTime}:00Z`;
        
        
        const query = `
            SELECT 
                DISTINCT -- Only return each room type once, even if multiple instances are free
                tor.id,
                tor.name,
                tor.capacity,
                tor.credits_per_booking,
                l.name as location_name
            FROM 
                rooms r
            JOIN 
                type_of_rooms tor ON r.type_of_room_id = tor.id
            JOIN 
                locations l ON tor.location_id = l.id
            LEFT JOIN 
                -- Find bookings that CONFLICT with the desired time slot
                bookings b ON r.id = b.room_id 
                    AND b.status = 'CONFIRMED' 
                    AND b.start_time < $3 AND b.end_time > $2
            WHERE
                r.is_active = TRUE          -- The physical room instance must be active
                AND tor.capacity >= $1      -- The room type must have enough capacity
                AND b.id IS NULL            -- This is the key: only include rooms where no conflicting booking was found
            ORDER BY 
                tor.capacity ASC;
        `;

        const { rows } = await pool.query(query, [capacity, searchStartTimestamp, searchEndTimestamp]);
        
        res.json(rows);

    } catch (err) {
        console.error('Room Type search error:', err);
        res.status(500).json({ message: 'Failed to search for available room types due to a server error.' });
    }
};