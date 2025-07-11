import { Request, Response } from 'express';
import pool from '../../lib/db.js';

export const getAllUsers = async (req: Request, res: Response) => {
    console.log(req.body)
    try {
        const { rows } = await pool.query(`
            SELECT id, name, email, phone, role, organization_id, location_id, is_verified, created_at
            FROM users WHERE is_verified = true
            ORDER BY created_at DESC
        `);
        res.json(rows);
    } catch (err) {
        console.error('Error fetching users:', err);
        res.status(500).json({ message: 'Failed to fetch users' });
    }
};

export const addUserToOrg = async (req: Request, res: Response) => {
    const { id } = req.params;
    const { organization_id } = req.body; 

    console.log("ADDing user to org")
    console.log(organization_id)

    try {
        const { rows } = await pool.query(
            'UPDATE users SET organization_id = $1 WHERE id = $2 RETURNING *',
            [organization_id, id]
        );
        if (rows.length === 0) {
            return res.status(404).json({ message: 'User not found.' });
        }
        res.json(rows[0]);
    } catch (err) {
        console.error(`Error updating user ${id}:`, err);
        res.status(500).json({ message: 'Failed to update user.' });
    }
};

export const removeUserFromOrg = async (req: Request, res: Response) => {
    const { id } = req.params;

    try {
        const { rows } = await pool.query(
            'UPDATE users SET organization_id = NULL WHERE id = $1 RETURNING *',
            [id]
        );
        if (rows.length === 0) {
            return res.status(404).json({ message: 'User not found.' });
        }
        res.json({ message: 'User removed from organization.', user: rows[0] });
    } catch (err) {
        console.error(`Error removing user ${id} from org:`, err);
        res.status(500).json({ message: 'Failed to remove user from organization.' });
    }
};

export const getAllUsersForMemberBook = async (req: Request, res: Response) => {
    console.log(req.user)
    try {
        const query = `
            SELECT 
                u.id, 
                u.name, 
                u.email, 
                u.profile_picture,
                o.name as organization_name
            FROM users u
            LEFT JOIN organizations o ON u.organization_id = o.id
            WHERE 
                u.is_verified = TRUE 
                AND u.role IN ('INDIVIDUAL_USER', 'ORG_USER', 'ORG_ADMIN')
            ORDER BY u.name ASC;
        `;
        const { rows } = await pool.query(query);
        res.json(rows);
    } catch (err) {
        console.error('Error fetching users for member book:', err);
        res.status(500).json({ message: 'Failed to fetch members.' });
    }
};
