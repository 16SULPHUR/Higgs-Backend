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


export const listAllEventIds = async (req: Request, res: Response) => {
    console.log(req.body);
    try {
        const { rows } = await pool.query("SELECT id FROM events WHERE date >= NOW()");
        res.json(rows);
    } catch (err) {
        res.status(500).json({ message: 'Failed to fetch event IDs.' });
    }
};

export const getEventDetails = async (req: Request, res: Response) => {
    const { id } = req.params;
    try {
        const query = `
            SELECT 
                e.id, e.title, e.description, e.image_url, e.date,
                (
                    (SELECT COUNT(*) FROM event_registrations er WHERE er.event_id = e.id) +
                    (SELECT COUNT(*) FROM guest_event_registrations ger WHERE ger.event_id = e.id)
                ) as registration_count
            FROM events e
            WHERE e.id = $1;
        `;
        const { rows, rowCount } = await pool.query(query, [id]);
        if (rowCount === 0) return res.status(404).json({ message: 'Event not found.' });
        res.json(rows[0]);
    } catch (err) {
        res.status(500).json({ message: 'Failed to fetch event details.' });
    }
};


export const getRegistrationStatus = async (req: Request, res: Response) => {
    const { id } = req.params;
    const user = (req as any).user;
    try {
        const query = `SELECT EXISTS (SELECT 1 FROM event_registrations WHERE event_id = $1 AND user_id = $2) as is_registered;`;
        const { rows } = await pool.query(query, [id, user.id]);
        res.json(rows[0]);
    } catch (err) {
        res.status(500).json({ message: 'Failed to fetch registration status.' });
    }
};