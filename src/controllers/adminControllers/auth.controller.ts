import { Request, Response } from 'express';
import pool from '../../lib/db.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { validateNewAdmin } from '../../validations/adminValidator.js';
import { ADMIN_ROLES } from '../../lib/constants.js';

export const loginAdmin = async (req: Request, res: Response) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ message: 'Email and password are required.' });
    }

    const client = await pool.connect(); 

    try {
        await client.query('BEGIN');

        const result = await client.query('SELECT * FROM admins WHERE email = $1', [email]);
        const admin = result.rows[0];

        if (!admin || !admin.is_active) {
            return res.status(401).json({ message: 'Invalid credentials or account disabled.' });
        }

        const isMatch = await bcrypt.compare(password, admin.password);
        if (!isMatch) {
            return res.status(401).json({ message: 'Invalid credentials.' });
        }

        const jti = uuidv4(); 
        const tokenExpiresIn = '8h';
        const expirationDate = new Date(Date.now() + 8 * 60 * 60 * 1000);

        const payload = {
            adminId: admin.id,
            role: admin.role,
            locationId: admin.location_id,
            type: 'admin',
            jti: jti 
        };
        const token = jwt.sign(payload, process.env.JWT_SECRET!, { expiresIn: tokenExpiresIn });

        await client.query(
            `INSERT INTO active_sessions (jti, subject_id, subject_type, expires_at)
             VALUES ($1, $2, 'ADMIN', $3)`,
            [jti, admin.id, expirationDate]
        );

        await client.query('COMMIT'); 
        res.json({ token, admin: { name: admin.name, role: admin.role } });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Admin login error:', err);
        res.status(500).json({ message: 'Server error during admin login.' });
    } finally {
        client.release();
    }
};


export const logoutAdmin = async (req: Request, res: Response) => {
    try {
        const jti = req.admin?.jti;
        if (!jti) {
            return res.status(400).json({ message: 'Invalid token.' });
        }
        
        await pool.query('DELETE FROM active_sessions WHERE jti = $1', [jti]);
        
        res.status(200).json({ message: 'Logged out successfully.' });
        
    } catch (err) {
        console.error('Admin logout error:', err);
        res.status(500).json({ message: 'Server error during logout.' });
    }
};


export const registerAdmin = async (req: Request, res: Response) => {
    
    const validationErrors = validateNewAdmin(req.body);
    if (validationErrors.length > 0) {
        return res.status(400).json({ message: 'Invalid input', errors: validationErrors });
    }

    const { name, email, password, role, location_id = null } = req.body;
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        
        const existingAdmin = await client.query('SELECT id FROM admins WHERE email = $1', [email]);
        if (existingAdmin.rowCount > 0) {
            return res.status(409).json({ message: 'An admin with this email already exists.' });
        }
        
        
        if (role === ADMIN_ROLES.LOCATION_ADMIN && location_id) {
            const locationCheck = await client.query('SELECT id FROM locations WHERE id = $1', [location_id]);
            if (locationCheck.rowCount === 0) {
                return res.status(400).json({ message: 'The provided location_id does not exist.' });
            }
        }

        
        const hashedPassword = await bcrypt.hash(password, parseInt(process.env.SALT!));

        
        const { rows } = await client.query(
            `INSERT INTO admins (name, email, password, role, location_id)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING id, name, email, role, location_id, is_active, created_at`,
            [name, email, hashedPassword, role, location_id]
        );

        await client.query('COMMIT');
        res.status(201).json(rows[0]);

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Admin registration error:', err);
        res.status(500).json({ message: 'Server error during admin registration.' });
    } finally {
        client.release();
    }
};


export const getMe = async (req: Request, res: Response) => {
    try {
        const adminId = req.admin?.adminId;
        console.log(adminId);

        if (!adminId) {
            return res.status(400).json({ message: 'No admin ID found in token.' });
        }

        const { rows } = await pool.query(
            'SELECT id, name, email, role, location_id, is_active FROM admins WHERE id = $1',
            [adminId]
        );

        if (rows.length === 0) {
            return res.status(404).json({ message: 'Admin not found.' });
        }

        const currentAdminData = rows[0];

        res.json(currentAdminData);

    } catch (err) {
        console.error('Error fetching current admin data:', err);
        res.status(500).json({ message: 'Server error' });
    }
};