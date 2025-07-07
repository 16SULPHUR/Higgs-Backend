// src/controllers/rooms/index.ts

import { Request, Response } from 'express';
import pool from '../../lib/db.js';
import { validateNewRoom, validateUpdateRoom } from '../../validations/roomValidator.js';

export const getAllRooms = async (req: Request, res: Response) => {
    console.log('Fetching all meeting rooms');
    console.log('Request body:', req.body);
    try {
        const { rows } = await pool.query('SELECT * FROM meeting_rooms ORDER BY created_at DESC');
        res.json(rows);
    } catch (err) {
        console.error('Error fetching rooms:', err);
        res.status(500).json({ message: 'Failed to fetch meeting rooms' });
    }
};

export const getRoomById = async (req: Request, res: Response) => {
    const { id } = req.params;
    try {
        const { rows, rowCount } = await pool.query('SELECT * FROM meeting_rooms WHERE id = $1', [id]);
        if (rowCount === 0) {
            return res.status(404).json({ message: 'Meeting room not found' });
        }
        res.json(rows[0]);
    } catch (err) {
        console.error(`Error fetching meeting room ${id}:`, err);
        res.status(500).json({ message: 'Failed to fetch meeting room' });
    }
};

export const createRoom = async (req: Request, res: Response) => {
    const validationErrors = validateNewRoom(req.body);
    if (validationErrors.length > 0) {
        return res.status(400).json({ message: 'Invalid input', errors: validationErrors });
    }

    const { name, type_of_room, location_id, capacity, credits_per_booking, availability = true } = req.body;
    const admin = req.admin!;

    if (admin.role === 'LOCATION_ADMIN' && admin.locationId !== location_id) {
        return res.status(403).json({ 
            message: 'Forbidden: You can only create rooms for your assigned location.' 
        });
    }

    console.log("create room")
    console.log(req.body)

    try {
        const { rows } = await pool.query(
            `INSERT INTO meeting_rooms (name, type_of_room, location_id, capacity, credits_per_booking, availability)
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
            [name, type_of_room, location_id, capacity, credits_per_booking, availability]
        );
        res.status(201).json(rows[0]);
    } catch (err) {
        console.error('Error creating meeting room:', err);
        // Check for foreign key violation
        if ((err as any).code === '23503') {
            return res.status(404).json({ message: `Location with id ${location_id} not found.` });
        }
        res.status(500).json({ message: 'Failed to create meeting room' });
    }
};

export const updateRoom = async (req: Request, res: Response) => {
    const validationErrors = validateUpdateRoom(req.body);
    if (validationErrors.length > 0) {
        return res.status(400).json({ message: 'Invalid input', errors: validationErrors });
    }

    console.log("update room")
    console.log(req.body)

    const { id } = req.params;
    const body = req.body;
    
    const fields = [];
    const values = [];
    let i = 1;

    
    for (const key in body) {
        if (Object.prototype.hasOwnProperty.call(body, key)) {
            fields.push(`${key} = $${i++}`);
            values.push(body[key]);
        }
    }

    values.push(id);
    const query = `UPDATE meeting_rooms SET ${fields.join(', ')} WHERE id = $${i} RETURNING *`;

    try {
        const { rows, rowCount } = await pool.query(query, values);
        if (rowCount === 0) {
            return res.status(404).json({ message: 'Meeting room not found' });
        }
        res.json(rows[0]);
    } catch (err) {
        console.error(`Error updating meeting room ${id}:`, err);
        if ((err as any).code === '23503') {
            return res.status(404).json({ message: `Location ID not found.` });
        }
        res.status(500).json({ message: 'Failed to update meeting room' });
    }
};

export const deleteRoom = async (req: Request, res: Response) => {
    const { id } = req.params;
    try {
        const { rowCount } = await pool.query('DELETE FROM meeting_rooms WHERE id = $1', [id]);
        if (rowCount === 0) {
            return res.status(404).json({ message: 'Meeting room not found' });
        }
        res.status(200).json({ message: 'Meeting room deleted successfully' });
    } catch (err) {
        console.error(`Error deleting meeting room ${id}:`, err);
        res.status(500).json({ message: 'Failed to delete meeting room' });
    }
};