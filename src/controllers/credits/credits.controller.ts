import { Request, Response } from 'express';
import pool from '../../lib/db.js';
import { resend } from '../../lib/resend.js';

export const assignCredits = async (req: Request, res: Response) => {
    const { id } = req.params;
    const { creditsToAssign } = req.body;

    console.log(req.body);
    console.log(id);

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const userCheck = await pool.query('SELECT * FROM users WHERE id = $1', [id]);

        if (userCheck.rowCount > 0) {
            const currentCredits = userCheck.rows[0].individual_credits;
            const { rows } = await client.query(
                'UPDATE users SET individual_credits = $1 WHERE id = $2 RETURNING id, individual_credits',
                [currentCredits + creditsToAssign, id]
            );
            await client.query('COMMIT');
            return res.json({ type: 'user', ...rows[0] });
        }

        const orgCheck = await pool.query('SELECT * FROM organizations WHERE id = $1', [id]);
        if (orgCheck.rowCount > 0) {
            const currentCredits = orgCheck.rows[0].credits_pool || 0;
            const { rows } = await client.query(
                'UPDATE organizations SET credits_pool = $1 WHERE id = $2 RETURNING id, credits_pool',
                [currentCredits + creditsToAssign, id]
            );

            const orgAdminQuery = `SELECT u.email, u.name FROM users u JOIN organizations o ON u.id = o.org_admin_id WHERE o.id = $1`;

            const orgAdminResult = await client.query(orgAdminQuery, [id]);

            if (orgAdminResult.rowCount > 0) {
                const orgAdmin = orgAdminResult.rows[0];
                await resend.emails.send({
                    from: `Higgs Workspace <${process.env.INVITE_EMAIL_FROM}>`,
                    to: orgAdmin.email,
                    subject: 'Credits have been added to your organization',
                    html: `<p>Hi ${orgAdmin.name},</p><p>An administrator has added <strong>${creditsToAssign} credits</strong> to your organization's pool. Your new balance is ${rows[0].credits_pool}.</p>`,
                });
            }

            await client.query('COMMIT');
            return res.json({ type: 'organization', ...rows[0] });
        }



        await client.query('ROLLBACK');
        return res.status(404).json({ message: 'User or Organization not found' });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error(`Error assigning credits for id ${id}:`, err);
        res.status(500).json({ message: 'Failed to assign credits' });
    } finally {
        client.release();
    }
};