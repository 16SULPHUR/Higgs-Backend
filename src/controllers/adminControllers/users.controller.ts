import { Request, Response } from 'express';
import pool from '../../lib/db.js';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import { resend } from '../../lib/resend.js';
import { ROLES } from '../../lib/constants.js';

export const createNewUserByAdmin = async (req: Request, res: Response) => {
    const { name, email, phone, role, organization_id } = req.body;

    if (!name || !email || !role) {
        return res.status(400).json({ message: 'Name, email, and role are required.' });
    }
    if (role.startsWith('ORG_') && !organization_id) {
        return res.status(400).json({ message: 'Organization ID is required for organization users.' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const existingUser = await client.query('SELECT id FROM users WHERE email = $1', [email]);
        if (existingUser.rowCount > 0) {
            await client.query('ROLLBACK');
            return res.status(409).json({ message: 'A user with this email already exists.' });
        }

        const generatedPassword = randomBytes(10).toString('hex');
        const hashedPassword = await bcrypt.hash(generatedPassword, 10);

        const query = `
            INSERT INTO users (name, email, password, phone, role, organization_id, is_verified, created_by_admin)
            VALUES ($1, $2, $3, $4, $5, $6, TRUE, TRUE)
            RETURNING id, name, email;
        `;
        const values = [name, email, hashedPassword, phone, role.startsWith('ORG_') ? organization_id : null];
        
        const { rows } = await client.query(query, values);
        
        await resend.emails.send({
            from: `Higgs Workspace <${process.env.EMAIL_FROM}>`,
            to: email,
            subject: 'Your Higgs Workspace Account has been Created',
            html: `
                <div style="font-family: sans-serif; padding: 20px; color: #333;">
                    <h2>Welcome, ${name}!</h2>
                    <p>An administrator has created an account for you at Higgs Workspace. You can now log in using the credentials below.</p>
                    <div style="border: 1px solid #ddd; padding: 15px; margin: 20px 0; background-color: #f9f9f9;">
                        <p><strong>Email:</strong> ${email}</p>
                        <p><strong>Password:</strong> ${generatedPassword}</p>
                    </div>
                    <p>We recommend changing your password after your first login via your profile page.</p>
                </div>
            `,
        });

        await client.query('COMMIT');
        res.status(201).json({ message: 'User created successfully. A welcome email with credentials has been sent.', user: rows[0] });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Admin create user error:', err);
        res.status(500).json({ message: 'Failed to create user due to a server error.' });
    } finally {
        client.release();
    }
};


export const getAllUsersForAdmin = async (req: Request, res: Response) => {
    console.log('Fetching all users');
    console.log('Request body:', req.body);
    try {
        const query = `
            SELECT 
                u.id, u.name, u.email, u.phone, u.role, u.is_active, u.profile_picture,
                o.name as organization_name
            FROM users u
            LEFT JOIN organizations o ON u.organization_id = o.id
            WHERE u.role != 'SUPER_ADMIN'
            ORDER BY u.name ASC;
        `;
        const { rows } = await pool.query(query);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ message: 'Failed to fetch users.' });
    }
};

export const getUserByIdForAdmin = async (req: Request, res: Response) => {
    const { id } = req.params;
    try {
        const { rows, rowCount } = await pool.query('SELECT id, name, email, phone, role, organization_id, is_active FROM users WHERE id = $1', [id]);
        if (rowCount === 0) return res.status(404).json({ message: 'User not found.' });
        res.json(rows[0]);
    } catch (err) {
        res.status(500).json({ message: 'Failed to fetch user.' });
    }
};

export const updateUserByAdmin = async (req: Request, res: Response) => {
    const { id } = req.params;
    const { name, phone, role, organization_id, is_active } = req.body;

    const fields = [];
    const values = [];
    let i = 1;
    
    const addField = (key: string, value: any) => {
        if (value !== undefined) {
            fields.push(`${key} = $${i++}`);
            values.push(value);
        }
    };
    
    addField('name', name);
    addField('phone', phone);
    addField('role', role);
    addField('organization_id', organization_id);
    addField('is_active', is_active);

    if (fields.length === 0) {
        return res.status(400).json({ message: 'No fields provided for update.' });
    }

    values.push(id);
    const query = `UPDATE users SET ${fields.join(', ')} WHERE id = $${i} RETURNING *`;

    try {
        const { rows } = await pool.query(query, values);
        res.json(rows[0]);
    } catch (err) {
        res.status(500).json({ message: 'Failed to update user.' });
    }
};

export const deleteUserByAdmin = async (req: Request, res: Response) => {
    const { id } = req.params;
    try {
        const { rowCount } = await pool.query('DELETE FROM users WHERE id = $1', [id]);
        if (rowCount === 0) return res.status(404).json({ message: 'User not found.' });
        res.status(204).send();
    } catch (err) {
        res.status(500).json({ message: 'Failed to delete user.' });
    }
};

export const listPendingUsers = async (req: Request, res: Response) => {
    console.log(req.body);
    try {
        const { rows } = await pool.query(`
            SELECT 
                u.id, u.name, u.email, u.phone, u.role, u.organization_id, u.is_active,
                u.approval_status, u.created_at,
                o.name as organization_name
            FROM users u
            LEFT JOIN organizations o ON u.organization_id = o.id
            WHERE u.approval_status = 'PENDING'
            ORDER BY u.created_at ASC;
        `);
        res.json(rows);
    } catch (err) {
        console.error('Failed to list pending users:', err);
        res.status(500).json({ message: 'Failed to list pending users.' });
    }
};

export const approveUser = async (req: Request, res: Response) => {
    const { id } = req.params;
    const { organization_id, role } = req.body as { organization_id?: string; role?: string };

    const adminId = (req as any).admin?.id;
    if (!adminId) {
        return res.status(401).json({ message: 'Unauthorized' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const { rows: userRows, rowCount } = await client.query('SELECT id, email, name FROM users WHERE id = $1', [id]);
        console.log(userRows)
        if (rowCount === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: 'User not found.' });
        }

        let finalRole: string = ROLES.INDIVIDUAL_USER;
        let finalOrg: string | null = null;
        if (organization_id) {
            finalRole = role && [ROLES.ORG_USER, ROLES.ORG_ADMIN].includes(role as any) ? role : ROLES.ORG_USER;
            finalOrg = organization_id;
        }

        const update = await client.query(
            `UPDATE users 
             SET approval_status = 'APPROVED', approved_at = NOW(), approved_by_admin_id = $1,
                 organization_id = $2, role = $3, is_active = TRUE
             WHERE id = $4
             RETURNING id, name, email, role, organization_id, approval_status`,
            [adminId, finalOrg, finalRole, id]
        );

        const approvedUser = update.rows[0];

        // Notify user
        try {
            await resend.emails.send({
                from: `Higgs Workspace <${process.env.INVITE_EMAIL_FROM || process.env.EMAIL_FROM}>`,
                to: approvedUser.email,
                subject: 'Your Higgs Workspace account has been approved',
                html: `<p>Hi ${approvedUser.name},</p><p>Your account has been approved. You can now log in.</p>`,
            });
        } catch {}

        await client.query('COMMIT');
        res.json({ message: 'User approved successfully.', user: approvedUser });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Approve user error:', err);
        res.status(500).json({ message: 'Failed to approve user.' });
    } finally {
        client.release();
    }
};

export const rejectUser = async (req: Request, res: Response) => {
    const { id } = req.params;
    const { reason } = req.body as { reason?: string };
    const adminId = (req as any).admin?.id;

    try {
        const { rowCount } = await pool.query(
            `UPDATE users SET approval_status = 'REJECTED', is_active = FALSE, rejected_at = NOW(), rejected_by_admin_id = $1, rejection_reason = $2 WHERE id = $3`,
            [adminId || null, reason || null, id]
        );
        if (rowCount === 0) return res.status(404).json({ message: 'User not found.' });
        res.json({ message: 'User rejected.' });
    } catch (err) {
        console.error('Reject user error:', err);
        res.status(500).json({ message: 'Failed to reject user.' });
    }
};
