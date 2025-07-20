import { Request, Response } from 'express';
import pool from '../../lib/db.js'; 

export const listAllEventsForUser = async (req: Request, res: Response) => {
    const user = (req as any).user;

    try {
        const query = `
            SELECT 
                e.id,
                e.title,
                e.description,
                e.image_url,
                e.date,
                (SELECT COUNT(*) FROM event_registrations er_count WHERE er_count.event_id = e.id) as registration_count,
                EXISTS (
                    SELECT 1 
                    FROM event_registrations er 
                    WHERE er.event_id = e.id AND er.user_id = $1
                ) as is_registered
            FROM 
                events e
            WHERE 
                e.date >= NOW()
            ORDER BY 
                e.date ASC;
        `;
        const { rows } = await pool.query(query, [user.id]);




        res.json(rows);
    } catch (err) {
        console.error('Error fetching events for user:', err);
        res.status(500).json({ message: 'Failed to fetch events.' });
    }
};