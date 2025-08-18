import { Request, Response } from 'express';
import pool from '../../lib/db.js';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto'; 
import { ADMIN_ROLES } from '../../lib/constants.js';
import { validateNewLocationAdmin, validateUpdateLocationAdmin } from '../../validations/locationAdminValidator.js';
import { zeptoClient } from '../../lib/zeptiMail.js';

export const createLocationAdmin = async (req: Request, res: Response) => {
    const validationErrors = validateNewLocationAdmin(req.body);
    if (validationErrors.length > 0) {
        return res.status(400).json({ message: 'Invalid input.', errors: validationErrors });
    }

    const { name, email, phone, location_id } = req.body;

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Check if email already exists
        const existingAdmin = await client.query('SELECT id FROM admins WHERE email = $1', [email]);
        if (existingAdmin.rowCount > 0) {
            await client.query('ROLLBACK');
            return res.status(409).json({ message: 'An admin with this email already exists.' });
        }

        // Check if location exists
        const locationCheck = await client.query('SELECT id, name FROM locations WHERE id = $1', [location_id]);
        if (locationCheck.rowCount === 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ message: 'The provided location_id does not exist.' });
        }

        // Allow multiple admins per location: no uniqueness restriction on location_id

        // Generate password and hash it
        const generatedPassword = randomBytes(10).toString('hex');
        const hashedPassword = await bcrypt.hash(generatedPassword, 10);

        // Insert the new location admin
        const { rows } = await client.query(
            `INSERT INTO admins (name, email, password, phone, role, location_id, is_active)
             VALUES ($1, $2, $3, $4, $5, $6, TRUE)
             RETURNING id, name, email, role, location_id, is_active, created_at`,
            [name, email, hashedPassword, phone, ADMIN_ROLES.LOCATION_ADMIN, location_id]
        );

        const locationName = locationCheck.rows[0].name;

        await zeptoClient.sendMail({
            from: {
                address: process.env.EMAIL_FROM as string, // e.g. noreply@higgs.in
                name: "Higgs Workspace",
            },
            to: [
                {
                    email_address: {
                        address: email,
                        name: name,
                    },
                },
            ],
            subject:
                "Your Higgs Workspace Location Admin Account has been Created",
            htmlbody: `
      <div style="font-family: sans-serif; padding: 20px; color: #333;">
        <h2>Welcome, ${name}!</h2>
        <p>You have been appointed as a Location Admin for <strong>${locationName}</strong> at Higgs Workspace.</p>
        <p>You can now log in using the credentials below and manage your assigned location.</p>
        <div style="border: 1px solid #ddd; padding: 15px; margin: 20px 0; background-color: #f9f9f9;">
          <p><strong>Email:</strong> ${email}</p>
          <p><strong>Password:</strong> ${generatedPassword}</p>
          <p><strong>Assigned Location:</strong> ${locationName}</p>
        </div>
        <p>We recommend changing your password after your first login via your profile page.</p>
        <p>As a Location Admin, you have access to manage rooms, bookings, events, and users within your assigned location.</p>
      </div>
    `,
        });


        await client.query('COMMIT');
        res.status(201).json({
            message: 'Location admin created successfully. A welcome email with credentials has been sent.',
            admin: rows[0]
        });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Create location admin error:', err);
        res.status(500).json({ message: 'Failed to create location admin due to a server error.' });
    } finally {
        client.release();
    }
};

export const getAllLocationAdmins = async (req: Request, res: Response) => {
    console.log(req.query)
    try {
        const query = `
            SELECT 
                a.id, a.name, a.email, a.phone, a.role, a.is_active, a.created_at,
                l.id as location_id, l.name as location_name, l.address as location_address
            FROM admins a
            LEFT JOIN locations l ON a.location_id = l.id
            WHERE a.role = $1
            ORDER BY a.created_at DESC
        `;

        const { rows } = await pool.query(query, [ADMIN_ROLES.LOCATION_ADMIN]);
        res.json(rows);
    } catch (err) {
        console.error('Error fetching location admins:', err);
        res.status(500).json({ message: 'Failed to fetch location admins.' });
    }
};

export const getLocationAdminById = async (req: Request, res: Response) => {
    const { id } = req.params;

    try {
        const query = `
            SELECT 
                a.id, a.name, a.email, a.phone, a.role, a.is_active, a.created_at,
                l.id as location_id, l.name as location_name, l.address as location_address
            FROM admins a
            LEFT JOIN locations l ON a.location_id = l.id
            WHERE a.id = $1 AND a.role = $2
        `;

        const { rows, rowCount } = await pool.query(query, [id, ADMIN_ROLES.LOCATION_ADMIN]);

        if (rowCount === 0) {
            return res.status(404).json({ message: 'Location admin not found' });
        }

        res.json(rows[0]);
    } catch (err) {
        console.error(`Error fetching location admin ${id}:`, err);
        res.status(500).json({ message: 'Failed to fetch location admin.' });
    }
};

export const updateLocationAdmin = async (req: Request, res: Response) => {
    const { id } = req.params;
    const validationErrors = validateUpdateLocationAdmin(req.body);
    if (validationErrors.length > 0) {
        return res.status(400).json({ message: 'Invalid input.', errors: validationErrors });
    }

    const { name, email, phone, location_id, is_active } = req.body;

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Check if location admin exists
        const existingAdmin = await client.query('SELECT id FROM admins WHERE id = $1 AND role = $2', [id, ADMIN_ROLES.LOCATION_ADMIN]);
        if (existingAdmin.rowCount === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: 'Location admin not found.' });
        }

        // Check if email is already taken by another admin
        const emailCheck = await client.query('SELECT id FROM admins WHERE email = $1 AND id != $2', [email, id]);
        if (emailCheck.rowCount > 0) {
            await client.query('ROLLBACK');
            return res.status(409).json({ message: 'An admin with this email already exists.' });
        }

        // Check if location exists
        const locationCheck = await client.query('SELECT id FROM locations WHERE id = $1', [location_id]);
        if (locationCheck.rowCount === 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ message: 'The provided location_id does not exist.' });
        }

        // Allow multiple admins per location: no uniqueness restriction on location_id

        // Update the location admin
        const { rows } = await client.query(
            `UPDATE admins 
             SET name = $1, email = $2, phone = $3, location_id = $4, is_active = $5
             WHERE id = $6 AND role = $7
             RETURNING id, name, email, phone, role, location_id, is_active, created_at`,
            [name, email, phone, location_id, is_active, id, ADMIN_ROLES.LOCATION_ADMIN]
        );

        await client.query('COMMIT');
        res.json({ message: 'Location admin updated successfully.', admin: rows[0] });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Update location admin error:', err);
        res.status(500).json({ message: 'Failed to update location admin due to a server error.' });
    } finally {
        client.release();
    }
};

export const deleteLocationAdmin = async (req: Request, res: Response) => {
    const { id } = req.params;

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Check if location admin exists
        const existingAdmin = await client.query('SELECT id FROM admins WHERE id = $1 AND role = $2', [id, ADMIN_ROLES.LOCATION_ADMIN]);
        if (existingAdmin.rowCount === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: 'Location admin not found.' });
        }

        // Delete the location admin
        await client.query('DELETE FROM admins WHERE id = $1 AND role = $2', [id, ADMIN_ROLES.LOCATION_ADMIN]);

        await client.query('COMMIT');
        res.json({ message: 'Location admin deleted successfully.' });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Delete location admin error:', err);
        res.status(500).json({ message: 'Failed to delete location admin due to a server error.' });
    } finally {
        client.release();
    }
};
