import { Request, Response } from 'express';
import pool from '../../lib/db.js';
import { ADMIN_ROLES } from '../../lib/constants.js';
import { randomBytes } from 'crypto';
import bcrypt from 'bcryptjs';
import { zeptoClient } from '../../lib/zeptiMail.js';

export const listSuperAdmins = async (_req: Request, res: Response) => {
    try {
        const { rows } = await pool.query(
            `SELECT id, name, email, role, is_active, created_at
             FROM admins
             WHERE role = $1
             ORDER BY created_at DESC`,
            [ADMIN_ROLES.SUPER_ADMIN]
        );
        res.json(rows);
    } catch (err) {
        console.error('Error listing super admins:', err);
        res.status(500).json({ message: 'Failed to fetch super admins.' });
    }
};

export const createOrPromoteSuperAdmin = async (req: Request, res: Response) => {
    const { mode } = req.body as { mode: 'invite' | 'promote' };
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        if (mode === 'promote') {
            const { adminId } = req.body as { adminId: string };
            if (!adminId) {
                await client.query('ROLLBACK');
                return res.status(400).json({ message: 'adminId is required for promotion.' });
            }

            const { rows: currentRows } = await client.query(
                'SELECT id, role FROM admins WHERE id = $1',
                [adminId]
            );
            if (currentRows.length === 0) {
                await client.query('ROLLBACK');
                return res.status(404).json({ message: 'Admin not found.' });
            }
            if (currentRows[0].role !== ADMIN_ROLES.LOCATION_ADMIN) {
                await client.query('ROLLBACK');
                return res.status(400).json({ message: 'Only LOCATION_ADMIN can be promoted to SUPER_ADMIN.' });
            }

            const { rows: updatedRows } = await client.query(
                'UPDATE admins SET role = $1 WHERE id = $2 RETURNING id, name, email, role, is_active, created_at',
                [ADMIN_ROLES.SUPER_ADMIN, adminId]
            );

            await client.query('COMMIT');
            return res.status(200).json(updatedRows[0]);
        }

        if (mode === 'invite') {
            const { name, email } = req.body as { name: string; email: string };
            if (!name || !email) {
                await client.query('ROLLBACK');
                return res.status(400).json({ message: 'name and email are required for invite.' });
            }

            const existing = await client.query('SELECT id FROM admins WHERE email = $1', [email]);
            if (existing.rowCount > 0) {
                await client.query('ROLLBACK');
                return res.status(409).json({ message: 'An admin with this email already exists.' });
            }

            const resetToken = randomBytes(6).toString('hex').toUpperCase();
            const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
 
            const tempPassword = randomBytes(10).toString('hex');
            const hashedPassword = await bcrypt.hash(tempPassword, parseInt(process.env.SALT!));
            
            const { rows: inserted } = await client.query(
                `INSERT INTO admins (name, email, password, role, location_id, is_active, reset_password_token, reset_password_expires_at)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                 RETURNING id, name, email, role, is_active, created_at`,
                [name, email, hashedPassword, ADMIN_ROLES.SUPER_ADMIN, null, true, resetToken, expiresAt]
            );


            await zeptoClient.sendMail({
                from: {
                    address: process.env.EMAIL_FROM as string,
                    name: 'Higgs Workspace',
                },
                to: [
                    {
                        email_address: {
                            address: email,
                            name,
                        },
                    },
                ],
                subject: 'Welcome to Higgs Workspace — Super Admin Access',
                htmlbody: `
    <div style="font-family: sans-serif; padding: 20px; color: #333;">
      <h2>Welcome, ${name}!</h2>
      <p>You have been invited to join Higgs Workspace as a <strong>Super Admin</strong>.</p>
      <div style="border: 1px solid #eee; border-radius: 8px; padding: 12px; margin: 16px 0; background:#fafafa;">
        <p style="margin:0 0 6px;"><strong>Username (email):</strong> ${email}</p>
        <p style="margin:0;"><strong>Temporary password:</strong> ${tempPassword}</p>
      </div>
     
      <p style="font-size: 0.9rem; color:#555;">You can sign in with the temporary password if needed, but we recommend resetting your password right away.</p>
      <p style="font-size: 0.85rem; color:#777; margin-top: 20px;">If you did not expect this invitation, you can ignore this email.</p>
    </div>
                `,
            });

            await client.query('COMMIT');
            return res.status(201).json(inserted[0]);
        }

        await client.query('ROLLBACK');
        return res.status(400).json({ message: 'Invalid mode. Use "invite" or "promote".' });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error creating super admin:', err.error.details);
        res.status(500).json({ message: 'Failed to create or promote super admin.' });
    } finally {
        client.release();
    }
};

export const demoteOrDeactivateSuperAdmin = async (req: Request, res: Response) => {
    const { id } = req.params;
    const { toLocationAdmin, location_id } = req.body || {} as { toLocationAdmin?: boolean; location_id?: string };
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const { rows: currentRows } = await client.query(
            'SELECT id, role FROM admins WHERE id = $1',
            [id]
        );
        if (currentRows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: 'Admin not found.' });
        }
        if (currentRows[0].role !== ADMIN_ROLES.SUPER_ADMIN) {
            await client.query('ROLLBACK');
            return res.status(400).json({ message: 'Target is not a SUPER_ADMIN.' });
        }

        if (toLocationAdmin) {
            if (!location_id) {
                await client.query('ROLLBACK');
                return res.status(400).json({ message: 'location_id is required to demote to LOCATION_ADMIN.' });
            }
            const { rows: updated } = await client.query(
                'UPDATE admins SET role = $1, location_id = $2 WHERE id = $3 RETURNING id, name, email, role, is_active, created_at, location_id',
                [ADMIN_ROLES.LOCATION_ADMIN, location_id, id]
            );
            await client.query('COMMIT');
            return res.status(200).json(updated[0]);
        }

        const { rows: deactivated } = await client.query(
            'UPDATE admins SET is_active = false WHERE id = $1 RETURNING id, name, email, role, is_active, created_at',
            [id]
        );
        await client.query('COMMIT');
        return res.status(200).json(deactivated[0]);
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error demoting/deactivating super admin:', err);
        res.status(500).json({ message: 'Failed to update super admin.' });
    } finally {
        client.release();
    }
};


