

import { Request, Response } from 'express';
import pool from '../../lib/db.js';
import { validateNewEvent, validateUpdateEvent } from '../../validations/eventValidator.js';
import uploadImage from '../../services/uploadImage.js';

export const getAllEvents = async (req: Request, res: Response) => {
    console.log('Fetching all events');
    console.log('Request body:', req.body);
    try {
        const { rows } = await pool.query('SELECT * FROM events ORDER BY date ASC');
        res.json(rows);
    } catch (err) {
        console.error('Error fetching events:', err);
        res.status(500).json({ message: 'Failed to fetch events' });
    }
};

export const createEvent = async (req: Request, res: Response) => {
    const validationErrors = validateNewEvent(req.body);
    if (validationErrors.length > 0) {
        return res.status(400).json({ message: 'Invalid input', errors: validationErrors });
    }

    const { title, description, date } = req.body;
    const image = req.file;

    console.log("req.body")
    console.log(req.body)
    console.log("req.file")
    console.log(image)

    try {
        let image_url: string | null = null;
        if (image) {
            image_url = await uploadImage(image);
        }

        const { rows } = await pool.query(
            'INSERT INTO events (title, description, date, image_url) VALUES ($1, $2, $3, $4) RETURNING *',
            [title, description, date, image_url]
        );
        res.status(201).json(rows[0]);
    } catch (err) {
        console.error('Error creating event:', err);
        res.status(500).json({ message: 'Failed to create event' });
    }
};

export const updateEvent = async (req: Request, res: Response) => {
    const validationErrors = validateUpdateEvent(req.body);
    if (validationErrors.length > 0) {
        return res.status(400).json({ message: 'Invalid input', errors: validationErrors });
    }

    const { id } = req.params;
    const fields = [];
    const values = [];
    let i = 1;

    for (const key in req.body) {
        if (Object.prototype.hasOwnProperty.call(req.body, key)) {
            fields.push(`${key} = $${i++}`);
            values.push(req.body[key]);
        }
    }

    values.push(id);
    const query = `UPDATE events SET ${fields.join(', ')} WHERE id = $${i} RETURNING *`;

    try {
        const { rows, rowCount } = await pool.query(query, values);
        if (rowCount === 0) {
            return res.status(404).json({ message: 'Event not found' });
        }
        res.json(rows[0]);
    } catch (err) {
        console.error(`Error updating event ${id}:`, err);
        res.status(500).json({ message: 'Failed to update event' });
    }
};

export const deleteEvent = async (req: Request, res: Response) => {
    const { id } = req.params;
    try {
        const { rowCount } = await pool.query('DELETE FROM events WHERE id = $1', [id]);
        if (rowCount === 0) {
            return res.status(404).json({ message: 'Event not found' });
        }
        res.status(200).json({ message: 'Event deleted successfully' });
    } catch (err) {
        console.error(`Error deleting event ${id}:`, err);
        res.status(500).json({ message: 'Failed to delete event' });
    }
};

export const getEventById = async (req: Request, res: Response) => {
    const { id } = req.params;
    console.log("geteventById")
    try {
        const { rows, rowCount } = await pool.query('SELECT * FROM events WHERE id = $1', [id]);
        if (rowCount === 0) {
            return res.status(404).json({ message: 'Event not found' });
        }
        res.json(rows[0]);
    } catch (err) {
        console.error(`Error fetching event ${id}:`, err);
        res.status(500).json({ message: 'Failed to fetch event' });
    }
};

export const getAllEventsWithDetails = async (req: Request, res: Response) => {
    console.log(req.body)
    try {
        const query = `
            SELECT 
                e.*, 
                COUNT(er.id)::INT AS registration_count 
            FROM events e
            LEFT JOIN event_registrations er ON e.id = er.event_id
            GROUP BY e.id
            ORDER BY e.date DESC;
        `;
        const { rows } = await pool.query(query);
        res.json(rows);
    } catch (err) {
        console.error('Error fetching events with details:', err);
        res.status(500).json({ message: 'Failed to fetch events' });
    }
};
