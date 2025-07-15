

import { Request, Response } from 'express';
import pool from '../../lib/db.js';
import { validateNewEvent } from '../../validations/eventValidator.js';
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
    console.log(`[Backend] Received PATCH for event ${req.params.id}`);
    console.log("[Backend] Body:", req.body);
    console.log("[Backend] File:", req.file ? req.file.originalname : "No file uploaded");
    
    const { id } = req.params;
    const { title, description, date } = req.body;
    const file = req.file;


    const fields = [];
    const values = [];
    let i = 1;

    // Use a helper to safely add fields to the query
    const addField = (key: string, value: any) => {
        if (value !== undefined && value !== null) {
            fields.push(`${key} = $${i++}`);
            values.push(value);
        }
    };
    
    // Explicitly check for the fields you allow to be updated
    addField('title', title);
    addField('description', description);
    addField('date', date);

    try {
        // Handle the file upload separately
        if (file) {
            console.log("[Backend] Uploading new image to ImageKit...");
            const imageUrl = await uploadImage(file);
            fields.push(`image_url = $${i++}`);
            values.push(imageUrl);
            console.log("[Backend] Image uploaded successfully.");
        }

        // If no fields were provided, there's nothing to do.
        if (fields.length === 0) {
            return res.status(400).json({ message: 'No valid fields provided for update.' });
        }

        values.push(id);
        const query = `UPDATE events SET ${fields.join(', ')} WHERE id = $${i} RETURNING *`;

        console.log("[Backend] Executing update query...");
        const { rows, rowCount } = await pool.query(query, values);

        if (rowCount === 0) {
            return res.status(404).json({ message: 'Event not found.' });
        }

        console.log("[Backend] Update successful.");
        res.json(rows[0]);

    } catch (err) {
        console.error(`Error updating event ${id}:`, err);
        res.status(500).json({ message: 'Failed to update event due to a server error.' });
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