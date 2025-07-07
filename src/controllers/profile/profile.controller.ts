import { Request, Response } from 'express';
import pool from '../../lib/db.js';

export const getProfile = async (req: Request, res: Response) => {
    console.log(req.body)
    try{
        const result = await pool.query('SELECT name, email, phone FROM users WHERE id = $1', [req.user.id]);

        if(result.rows.length < 0){
            res.status(404).json({ message: 'user not found' });
        }

        console.log(result.rows[0]);

        res.json(result.rows[0]);
    }
    catch (err) {
        console.error(`Error fetching user data`, err);
        res.status(500).json({ message: 'Failed to fetch user data' });
    }
}

export const updateProfile = async (req: Request, res: Response) => {
    console.log(req.body)
    const {name, email, phone} = req.body;

    try {
        const fields = [];
        const values = [];
        let i = 1;

        if (name != null) {
            fields.push(`name = $${i++}`);
            values.push(name);
        }
        if (email != null) {
            fields.push(`email = $${i++}`);
            values.push(email);
        }
        if (phone != null) {
            fields.push(`phone = $${i++}`);
            values.push(phone);
        }

        
        if (fields.length === 0) {
            return res.status(400).json({ message: 'No valid fields provided for update.' });
        }

        values.push(req.user.id);

        const query = `UPDATE users SET ${fields.join(', ')} WHERE id = $${i} RETURNING name, email, phone`;

        const { rows, rowCount } = await pool.query(query, values);

        if (rowCount === 0) {
            return res.status(404).json({ message: 'User not found' });
        }

        res.json(rows[0]);
    } catch (err) {
        console.error(`Error updating user ${req.user.id}:`, err);
        res.status(500).json({ message: 'Failed to update user' });
    }
}