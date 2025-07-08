import { Request, Response } from 'express';
import pool from '../../lib/db.js';


export const getAllLocations = async (req: Request, res: Response) => {
    console.log(req.body)
    try {
        
        const { rows } = await pool.query('SELECT * FROM locations ORDER BY name ASC');
        res.json(rows);
    } catch (err) {
        console.error('Error fetching all locations:', err);
        res.status(500).json({ message: 'Failed to fetch locations' });
    }
};


export const getLocationById = async (req: Request, res: Response) => {
    const { id } = req.params;
    try {
        const { rows, rowCount } = await pool.query('SELECT * FROM locations WHERE id = $1', [id]);
        
        
        if (rowCount === 0) {
            return res.status(404).json({ message: 'Location not found' });
        }
        
        res.json(rows[0]);
    } catch (err) {
        console.error(`Error fetching location ${id}:`, err);
        res.status(500).json({ message: 'Failed to fetch location' });
    }
};