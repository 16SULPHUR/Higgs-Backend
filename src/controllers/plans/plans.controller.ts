import { Request, Response } from 'express';
import pool from '../../lib/db.js';
import { validateNewPlan, validateUpdatePlan } from '../../validations/planValidator.js';

export const getAllPlans = async (req: Request, res: Response) => {
    console.log('Fetching all plans');
    console.log('Request body:', req.body);
    try {
        const { rows } = await pool.query('SELECT * FROM plans ORDER BY created_at DESC');
        res.json(rows);
    } catch (err) {
        console.error('Error fetching plans:', err);
        res.status(500).json({ message: 'Failed to fetch plans' });
    }
};

export const getPlanById = async (req: Request, res: Response) => {
    const { id } = req.params;
    try {
        const { rows, rowCount } = await pool.query('SELECT * FROM plans WHERE id = $1', [id]);
        if (rowCount === 0) {
            return res.status(404).json({ message: 'Plan not found' });
        }
        console.log(rows[0])
        res.json(rows[0]);
    } catch (err) {
        console.error(`Error fetching plan ${id}:`, err);
        res.status(500).json({ message: 'Failed to fetch plan' });
    }
};

export const createNewPlan = async (req: Request, res: Response) => {
    
    const validationErrors = validateNewPlan(req.body);
    if (validationErrors.length > 0) {
        return res.status(400).json({ message: 'Invalid input', errors: validationErrors });
    }

    const { name, plan_credits, price } = req.body;

    
    try {
        const { rows } = await pool.query(
            'INSERT INTO plans (name, plan_credits, price) VALUES ($1, $2, $3) RETURNING *',
            [name, plan_credits, price]
        );
        res.status(201).json(rows[0]);
    } catch (err) {
        console.error('Error creating plan:', err);
        res.status(500).json({ message: 'Failed to create plan' });
    }
};

export const updatePlan = async (req: Request, res: Response) => {
    
    console.log(req.body)
    const validationErrors = validateUpdatePlan(req.body);
    if (validationErrors.length > 0) {
        return res.status(400).json({ message: 'Invalid input', errors: validationErrors });
    }

    const { id } = req.params;
    const { name, plan_credits, price } = req.body;

    
    try {
        const fields = [];
        const values = [];
        let i = 1;

        if (name != null) {
            fields.push(`name = $${i++}`);
            values.push(name);
        }
        if (plan_credits != null) {
            fields.push(`plan_credits = $${i++}`);
            values.push(plan_credits);
        }
        if (price != null) {
            fields.push(`price = $${i++}`);
            values.push(price);
        }

        
        if (fields.length === 0) {
            return res.status(400).json({ message: 'No valid fields provided for update.' });
        }

        values.push(id);
        const query = `UPDATE plans SET ${fields.join(', ')} WHERE id = $${i} RETURNING *`;

        const { rows, rowCount } = await pool.query(query, values);

        if (rowCount === 0) {
            return res.status(404).json({ message: 'Plan not found' });
        }

        res.json(rows[0]);
    } catch (err) {
        console.error(`Error updating plan ${id}:`, err);
        res.status(500).json({ message: 'Failed to update plan' });
    }
};

export const deletePlan = async (req: Request, res: Response) => {
    const { id } = req.params;


    try {
        const { rowCount } = await pool.query('DELETE FROM plans WHERE id = $1', [id]);
        if (rowCount === 0) {
            return res.status(404).json({ message: 'Plan not found' });
        }
        res.status(200).json({ message: 'Plan deleted successfully' });
    } catch (err) {
        console.error(`Error deleting plan ${id}:`, err);
        res.status(500).json({ message: 'Failed to delete plan' });
    }
};