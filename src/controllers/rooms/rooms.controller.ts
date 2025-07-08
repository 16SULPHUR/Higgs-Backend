import { Request, Response } from 'express';
import pool from '../../lib/db.js';

export const getAllRooms = async (req: Request, res: Response) => {
    console.log(req.body)
    try {
        const query = 'SELECT r.id, r.name, r.is_active, r.type_of_room_id, tor.name as type_name, l.name as location_name FROM rooms r JOIN type_of_rooms tor ON r.type_of_room_id = tor.id JOIN locations l ON tor.location_id = l.id ORDER BY r.name ASC';
        const { rows } = await pool.query(query);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ message: 'Failed to fetch rooms' });
    }
};

export const getRoomById = async (req: Request, res: Response) => {
    const { id } = req.params;
    try {
        const query = 'SELECT r.id, r.name, r.is_active, r.type_of_room_id, tor.name as type_name FROM rooms r JOIN type_of_rooms tor ON r.type_of_room_id = tor.id WHERE r.id = $1';
        const { rows, rowCount } = await pool.query(query, [id]);
        if (rowCount === 0) {
            return res.status(404).json({ message: 'Room not found' });
        }
        res.json(rows[0]);
    } catch (err) {
        res.status(500).json({ message: 'Failed to fetch room' });
    }
};

export const createRoom = async (req: Request, res: Response) => {
    const { name, type_of_room_id, is_active = true } = req.body;
    try {
        const { rows } = await pool.query(
            'INSERT INTO rooms (name, type_of_room_id, is_active) VALUES ($1, $2, $3) RETURNING *',
            [name, type_of_room_id, is_active]
        );
        res.status(201).json(rows[0]);
    } catch (err) {
        res.status(500).json({ message: 'Failed to create room' });
    }
};

export const updateRoom = async (req: Request, res: Response) => {
    const { id } = req.params;
    const updates = req.body;

    const fields = Object.keys(updates).map((key, index) => `"${key}" = $${index + 1}`).join(', ');
    const values = Object.values(updates);

    if (fields.length === 0) {
        return res.status(400).json({ message: 'No fields to update provided.' });
    }

    const query = `UPDATE rooms SET ${fields} WHERE id = $${values.length + 1} RETURNING *`;

    try {
        const { rows, rowCount } = await pool.query(query, [...values, id]);
        if (rowCount === 0) {
            return res.status(404).json({ message: 'Room not found' });
        }
        res.json(rows[0]);
    } catch (err) {
        res.status(500).json({ message: 'Failed to update room' });
    }
};

export const deleteRoom = async (req: Request, res: Response) => {
    const { id } = req.params;
    try {
        const { rowCount } = await pool.query('DELETE FROM rooms WHERE id = $1', [id]);
        if (rowCount === 0) {
            return res.status(404).json({ message: 'Room not found' });
        }
        res.status(204).send();
    } catch (err) {
        res.status(500).json({ message: 'Failed to delete room' });
    }
};
