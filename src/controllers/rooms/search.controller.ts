import { Request, Response } from 'express';
import pool from '../../lib/db.js'; 

export const searchAvailableRoomTypes = async (req: Request, res: Response) => {
    const { date, startTime, endTime, capacity } = req.query;

    if (!date || !startTime || !endTime || !capacity) {
        return res.status(400).json({ message: 'Date, start time, end time, and capacity are required.' });
    }

    try { 
        const timezone = '+05:30';
        const pad = (n: number) => n.toString().padStart(2, '0');
 
        const searchStartTimestamp = `${date}T${pad(Number((startTime as string).split(':')[0]))}:${pad(Number((startTime as string).split(':')[1]))}:00${timezone}`;
        
        const searchEndTimestamp = `${date}T${pad(Number((endTime as string).split(':')[0]))}:${pad(Number((endTime as string).split(':')[1]))}:00${timezone}`;


        const query = `
            SELECT
                DISTINCT
                tor.id,
                tor.name,
                tor.capacity,
                tor.credits_per_booking,
                tor.room_icon,
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

        console.log(rows)

        res.json(rows);

    } catch (err) {
        console.error('Room Type search error:', err);
        res.status(500).json({ message: 'Failed to search for available room types due to a server error.' });
    }
};










// const query = `
//             SELECT
//                 DISTINCT
//                 tor.id,
//                 tor.name,
//                 tor.capacity,
//                 tor.credits_per_booking,
//                 tor.room_icon,
//                 l.name as location_name
//             FROM
//                 rooms r
//             JOIN
//                 type_of_rooms tor ON r.type_of_room_id = tor.id
//             JOIN
//                 locations l ON tor.location_id = l.id
//             LEFT JOIN
//                 -- Find bookings that CONFLICT with the desired time slot
//                 bookings b ON r.id = b.room_id
//                     AND b.status = 'CONFIRMED'
//                     AND b.start_time < $3 AND b.end_time > $2
//             WHERE
//                 r.is_active = TRUE          -- The physical room instance must be active
//                 AND tor.capacity >= $1      -- The room type must have enough capacity
//                 AND b.id IS NULL            -- This is the key: only include rooms where no conflicting booking was found
//             ORDER BY
//                 tor.capacity ASC;
//         `;















// const query = `
//             SELECT
//                 tor.id,
//                 tor.name,
//                 tor.capacity,
//                 tor.credits_per_booking,
//                 tor.room_icon,
//                 l.name AS location_name,
//                 COUNT(r.id)::int AS available_room_count
//             FROM
//                 type_of_rooms tor
//             JOIN
//                 rooms r ON tor.id = r.type_of_room_id
//             JOIN
//                 locations l ON tor.location_id = l.id
//             WHERE
//                 r.is_active = TRUE
//                 AND tor.capacity >= $1
//                 AND r.id NOT IN (
//                     SELECT b.room_id FROM bookings b
//                     WHERE b.status = 'CONFIRMED'
//                       AND b.start_time < $3 -- searchEnd
//                       AND b.end_time > $2   -- searchStart
//                 )
//             GROUP BY
//                 tor.id, l.name
//             HAVING
//                 COUNT(r.id) > 0
//             ORDER BY
//                 tor.capacity ASC;
//         `;