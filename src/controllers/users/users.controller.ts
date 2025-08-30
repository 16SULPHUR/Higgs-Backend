import { Request, Response } from 'express';
import pool from '../../lib/db.js';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto'; 
import { zeptoClient } from '../../lib/zeptiMail.js';

export const createNewUserByAdmin = async (req: Request, res: Response) => {
    const {
        name,
        email,
        phone,
        profession,
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
                name, email, password, phone, profession, role, organization_id,
                is_verified, created_by_admin, is_active
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE, TRUE, $8)
            RETURNING id, name, email;
        `;

        const insertValues = [
            name,
            email,
            hashedPassword,
            phone,
            profession,
            role,
            role.startsWith('ORG_') ? organization_id : null,
            is_active
        ];

        const { rows } = await client.query(insertQuery, insertValues);

        const emailResponse = await zeptoClient.sendMail({
            from: {
                address: process.env.EMAIL_FROM as string,
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
            subject: "Your Higgs Workspace Account Has Been Created",
            htmlbody: `
    <div style="font-family: sans-serif; padding: 20px; color: #333;">
      <h2>Welcome, ${name}!</h2>
      <p>An administrator has created your account on Higgs Workspace. Here are your login credentials:</p>
      <div style="border: 1px solid #ddd; padding: 15px; background-color: #f9f9f9;">
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Password:</strong> ${generatedPassword}</p>
      </div>
      <p>Please log in and change your password as soon as possible from your profile page.</p>
    </div>
  `,
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

        await zeptoClient.sendMail({
            from: {
                address: process.env.INVITE_EMAIL_FROM as string,
                name: "Higgs Workspace",
            },
            to: [
                {
                    email_address: {
                        address: user.email,
                        name: user.name,
                    },
                },
            ],
            subject: `You've been added to ${orgName} on Higgs Workspace`,
            htmlbody: `
                <p>Hi ${user.name},</p>
                <p>An administrator has added you to the <strong>${orgName}</strong> organization.</p>
            `,
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
                u.profession,
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


export const getPublicMemberNames = async (req: Request, res: Response) => {
    console.log("getPublicMemberNames")
    console.log(req.user)
    try {
        const query = `
            SELECT 
                u.id, 
                u.name
            FROM users u
            WHERE 
                u.is_verified = TRUE 
                AND u.role IN ('INDIVIDUAL_USER', 'ORG_USER', 'ORG_ADMIN')
            ORDER BY u.name ASC;
        `;
        const { rows } = await pool.query(query);
        res.json(rows);
    } catch (err) {
        console.error('Error fetching public member names:', err);
        res.status(500).json({ message: 'Failed to fetch member names.' });
    }
};



export const getInvitableUsers = async (req: Request, res: Response) => {
    const user = (req as any).user;
    const { bookingId } = req.query;

    if (!bookingId) {
        return res.status(400).json({ message: 'A bookingId query parameter is required.' });
    }

    try {
        const query = `
            SELECT id, name, email 
            FROM users 
            WHERE 
                is_verified = TRUE 
                AND role != 'SUPER_ADMIN'
                AND id != $1 -- Exclude the current user
                AND email NOT IN (
                    -- Exclude users whose email is already in the guest list for this booking
                    SELECT guest_email FROM guest_invitations WHERE booking_id = $2
                )
            ORDER BY name ASC;
        `;
        const { rows } = await pool.query(query, [user.id, bookingId]);
        res.json(rows);
    } catch (err) {
        console.error('Error fetching invitable users:', err);
        res.status(500).json({ message: 'Failed to fetch invitable users.' });
    }
};