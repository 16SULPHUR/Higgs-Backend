import { Request, Response } from 'express';
import pool from '../../lib/db.js';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import { resend } from '../../lib/resend.js';

export const createNewUserByAdmin = async (req: Request, res: Response) => {
    const {
        name,
        email,
        phone,
        role,
        organization_id,
        is_active = true // Optional with default
    } = req.body;

    // Basic validation
    if (!name || !email || !role) {
        return res.status(400).json({
            message: 'Name, email, and role are required.'
        });
    }

    if (role.startsWith('ORG_') && !organization_id) {
        return res.status(400).json({
            message: 'Organization ID is required for organization-specific roles.'
        });
    }

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // Check if the email is already registered
        const { rowCount: existingUserCount } = await client.query(
            'SELECT id FROM users WHERE email = $1',
            [email]
        );

        if (existingUserCount > 0) {
            await client.query('ROLLBACK');
            return res.status(409).json({
                message: 'A user with this email already exists.'
            });
        }

        // Generate and hash password
        const generatedPassword = randomBytes(10).toString('hex');
        const hashedPassword = await bcrypt.hash(generatedPassword, 10);

        // Insert the new user
        const insertQuery = `
            INSERT INTO users (
                name, email, password, phone, role, organization_id,
                is_verified, created_by_admin, is_active
            )
            VALUES ($1, $2, $3, $4, $5, $6, TRUE, TRUE, $7)
            RETURNING id, name, email;
        `;

        const insertValues = [
            name,
            email,
            hashedPassword,
            phone,
            role,
            role.startsWith('ORG_') ? organization_id : null,
            is_active
        ];

        const { rows } = await client.query(insertQuery, insertValues);
 
        const emailResponse = await resend.emails.send({
            from: `Higgs Workspace <${process.env.EMAIL_FROM}>`,
            to: email,
            subject: 'Your Higgs Workspace Account Has Been Created',
            html: `
                <div style="font-family: sans-serif; padding: 20px; color: #333;">
                    <h2>Welcome, ${name}!</h2>
                    <p>An administrator has created your account on Higgs Workspace. Here are your login credentials:</p>
                    <div style="border: 1px solid #ddd; padding: 15px; background-color: #f9f9f9;">
                        <p><strong>Email:</strong> ${email}</p>
                        <p><strong>Password:</strong> ${generatedPassword}</p>
                    </div>
                    <p>Please log in and change your password as soon as possible from your profile page.</p>
                </div>
            `
        });

        console.log("emailResponse===========================")
        console.log(emailResponse)

        await client.query('COMMIT');

        return res.status(201).json({
            message: 'User created successfully. A welcome email has been sent.',
            user: rows[0]
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Admin create user error:', error);

        return res.status(500).json({
            message: 'Failed to create user due to a server error.'
        });

    } finally {
        client.release();
    }
};


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
    const { userId, orgId } = req.params;
    
    try {
        const userUpdate = await pool.query('UPDATE users SET organization_id = $1 WHERE id = $2 RETURNING email, name', [orgId, userId]);
        if (userUpdate.rowCount === 0) return res.status(404).json({ message: 'User not found.' });

        const orgDetails = await pool.query('SELECT name FROM organizations WHERE id = $1', [orgId]);
        const user = userUpdate.rows[0];
        const orgName = orgDetails.rows[0].name;

        await resend.emails.send({
            from: `Higgs Workspace <${process.env.INVITE_EMAIL_FROM}>`,
            to: user.email,
            subject: `You've been added to ${orgName} on Higgs Workspace`,
            html: `<p>Hi ${user.name},</p><p>An administrator has added you to the <strong>${orgName}</strong> organization.</p>`,
        });

        res.status(200).json({ message: 'User successfully added to organization.' });
    } catch (err) {
        res.status(500).json({ message: 'Failed to add user to organization.' });
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
