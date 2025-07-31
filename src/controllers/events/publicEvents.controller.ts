import { Request, Response } from 'express';
import pool from '../../lib/db.js';

export const registerGuestForEvent = async (req: Request, res: Response) => {
    const { eventId } = req.params;
    const { name, email, phone } = req.body;

    if (!name || !email) {
        return res.status(400).json({ message: 'Name and email are required for guest registration.' });
    }

    try {
        const query = 'INSERT INTO guest_event_registrations (event_id, guest_name, guest_email, guest_phone) VALUES ($1, $2, $3, $4) RETURNING *';
        const { rows } = await pool.query(query, [eventId, name, email, phone]);
        res.status(201).json({ message: 'Successfully registered for the event as a guest.', registration: rows[0] });
    } catch (err: any) {
        if (err.code === '23505') {  
            return res.status(409).json({ message: 'This email address is already registered for this event.' });
        }
        if (err.code === '23503') {  
            return res.status(404).json({ message: 'Event not found.' });
        }
        res.status(500).json({ message: 'Failed to register as a guest.' });
    }
};