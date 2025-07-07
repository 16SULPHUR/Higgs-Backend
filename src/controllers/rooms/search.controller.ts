import { Request, Response } from 'express';
import pool from '../../lib/db.js';

export const searchAvailableRooms = async (req: Request, res: Response) => {
    const { date, startTime, endTime, capacity } = req.query;

    
    if (!date || !startTime || !endTime || !capacity) {
        return res.status(400).json({ message: 'Date, start time, end time, and capacity are required.' });
    }

    try {
        
        const searchStartTimestamp = `${date}T${startTime}:00Z`;
        const searchEndTimestamp = `${date}T${endTime}:00Z`;
        
        const query = `
            SELECT 
                r.id,
                r.name,
                r.type_of_room,
                r.capacity,
                r.credits_per_booking,
                l.name as location_name
            FROM 
                meeting_rooms r
            JOIN 
                locations l ON r.location_id = l.id
            WHERE 
                r.availability = TRUE
                AND r.capacity >= $1
                AND NOT EXISTS (
                    -- Subquery to check for any conflicting bookings for this room
                    SELECT 1
                    FROM bookings b
                    WHERE 
                        b.meeting_room_id = r.id
                        AND b.status = 'CONFIRMED'
                        -- This condition checks for any overlap between the requested time and existing bookings
                        AND (b.start_time < $3 AND b.end_time > $2)
                )
            ORDER BY 
                r.capacity ASC;
        `;

        const { rows } = await pool.query(query, [capacity, searchStartTimestamp, searchEndTimestamp]);
        
        res.json(rows);

    } catch (err) {
        console.error('Room search error:', err);
        res.status(500).json({ message: 'Failed to search for available rooms.' });
    }
};