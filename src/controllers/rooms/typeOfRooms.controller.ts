import { Request, Response } from 'express';
import pool from '../../lib/db.js';

export const getAllRoomTypes = async (req: Request, res: Response) => {
    console.log(req.body)
    try {
        const { rows } = await pool.query(`
            SELECT tor.*, l.name as location_name
            FROM type_of_rooms tor
            JOIN locations l ON tor.location_id = l.id
            ORDER BY tor.name ASC
        `); 
        const result = rows.map(({ location_id, ...rest }) => rest);
        res.json(result);
    } catch (err) {
        res.status(500).json({ message: 'Failed to fetch room types' });
    }
};

export const getRoomTypeById = async (req: Request, res: Response) => {
    const { id } = req.params;
    try {
        
        const { rows, rowCount } = await pool.query('SELECT tor.*, l.name as location_name FROM type_of_rooms tor JOIN locations l ON tor.location_id = l.id WHERE tor.id = $1', [id]);

        if (rowCount === 0) {
            return res.status(404).json({ message: 'Room type not found' });
        }
        res.json(rows[0]);
    } catch (err) {
        res.status(500).json({ message: 'Failed to fetch room type' });
    }
};

export const createRoomType = async (req: Request, res: Response) => {
    const { name, capacity, credits_per_booking, location_id } = req.body;
    try {
        const { rows } = await pool.query(
            'INSERT INTO type_of_rooms (name, capacity, credits_per_booking, location_id) VALUES ($1, $2, $3, $4) RETURNING *',
            [name, capacity, credits_per_booking, location_id]
        );
        res.status(201).json(rows[0]);
    } catch (err) {
        res.status(500).json({ message: 'Failed to create room type' });
    }
};

export const updateRoomType = async (req: Request, res: Response) => {
    const { id } = req.params;
    const updates = req.body;
    
    const fields = Object.keys(updates).map((key, index) => `"${key}" = $${index + 1}`).join(', ');
    const values = Object.values(updates);
    
    if (fields.length === 0) {
        return res.status(400).json({ message: 'No fields to update provided.' });
    }

    const query = `UPDATE type_of_rooms SET ${fields} WHERE id = $${values.length + 1} RETURNING *`;
    
    try {
        const { rows, rowCount } = await pool.query(query, [...values, id]);
        if (rowCount === 0) {
            return res.status(404).json({ message: 'Room type not found' });
        }
        res.json(rows[0]);
    } catch (err) {
        res.status(500).json({ message: 'Failed to update room type' });
    }
};

export const deleteRoomType = async (req: Request, res: Response) => {
    const { id } = req.params;
    try {
        const { rowCount } = await pool.query('DELETE FROM type_of_rooms WHERE id = $1', [id]);
        if (rowCount === 0) {
            return res.status(404).json({ message: 'Room type not found' });
        }
        res.status(204).send();
    } catch (err: any) {
        if (err.code === '23503') { // Foreign key violation
            return res.status(409).json({ message: 'Cannot delete: This room type is being used by one or more room instances.' });
        }
        res.status(500).json({ message: 'Failed to delete room type' });
    }
};