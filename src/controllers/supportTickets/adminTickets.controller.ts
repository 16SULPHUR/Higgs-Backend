import { Request, Response } from 'express';
import pool from '../../lib/db.js';
import { validateNewTicketByAdmin, validateUpdateTicketByAdmin } from '../../validations/adminSupportTicketValidator.js';
import { resend } from '../../lib/resend.js';

export const listAllTickets = async (req: Request, res: Response) => {
    console.log(req.body)
    try {
        const query = `
            SELECT t.id, t.subject, t.status, t.updated_at, u.name as user_name, u.email as user_email
            FROM support_tickets t
            JOIN users u ON t.user_id = u.id
            ORDER BY t.status ASC, t.updated_at DESC
        `;
        const { rows } = await pool.query(query);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ message: 'Failed to fetch tickets.' });
    }
};

export const getTicketById = async (req: Request, res: Response) => {
    const { id } = req.params;
    try {
        const query = `
            SELECT t.*, u.name as user_name, u.email as user_email
            FROM support_tickets t
            JOIN users u ON t.user_id = u.id
            WHERE t.id = $1
        `;
        const { rows, rowCount } = await pool.query(query, [id]);
        if (rowCount === 0) {
            return res.status(404).json({ message: 'Ticket not found.' });
        }
        res.json(rows[0]);
    } catch (err) {
        res.status(500).json({ message: 'Failed to fetch ticket.' });
    }
};

export const createTicketForUser = async (req: Request, res: Response) => {
    const validationErrors = validateNewTicketByAdmin(req.body);
    if (validationErrors.length > 0) {
        return res.status(400).json({ message: 'Invalid input.', errors: validationErrors });
    }

    const { user_id, subject, description } = req.body;
    const admin = (req as any).admin;

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const userCheck = await client.query('SELECT name, email FROM users WHERE id = $1', [user_id]);
        if (userCheck.rowCount === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: `User with id ${user_id} does not exist.` });
        }
        const user = userCheck.rows[0];

        const { rows } = await client.query(
            'INSERT INTO support_tickets (user_id, subject, description, created_by_admin_id, status) VALUES ($1, $2, $3, $4, $5) RETURNING *',
            [user_id, subject, description, admin.adminId, 'OPEN']
        );

        await resend.emails.send({
            from: `Higgs Workspace Support <${process.env.INVITE_EMAIL_FROM}>`,
            to: user.email,
            subject: `A new support ticket has been opened for you: #${rows[0].id}`,
            html: `
                <div style="font-family: sans-serif; padding: 20px;">
                    <h2>Hi ${user.name},</h2>
                    <p>Our support team has opened a new ticket on your behalf regarding: <strong>${subject}</strong>.</p>
                    <p>Our team will review it and get back to you shortly. You can view the status of this ticket in your portal.</p>
                </div>
            `
        });

        await client.query('COMMIT');
        res.status(201).json(rows[0]);
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(500).json({ message: 'Failed to create ticket for user.' });
    } finally {
        client.release();
    }
};

export const updateTicketStatus = async (req: Request, res: Response) => {
    const validationErrors = validateUpdateTicketByAdmin(req.body);
    if (validationErrors.length > 0) {
        return res.status(400).json({ message: 'Invalid input.', errors: validationErrors });
    }

    const { id } = req.params;
    const { status } = req.body;

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const { rows, rowCount } = await client.query(
            "UPDATE support_tickets SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *",
            [status, id]
        );
        if (rowCount === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: 'Ticket not found.' });
        }
        const updatedTicket = rows[0];

        const userResult = await client.query(
            'SELECT name, email FROM users WHERE id = $1',
            [updatedTicket.user_id]
        );
        const user = userResult.rows[0];

        await resend.emails.send({
            from: `Higgs Workspace Support <${process.env.INVITE_EMAIL_FROM}>`,
            to: user.email,
            subject: `Update on your support ticket #${updatedTicket.id}`,
            html: `
                <div style="font-family: sans-serif; padding: 20px;">
                    <h2>Hi ${user.name},</h2>
                    <p>There has been an update on your support ticket regarding: <strong>${updatedTicket.subject}</strong>.</p>
                    <p>The status has been changed to: <strong>${status.toUpperCase()}</strong>.</p>
                    ${status === 'CLOSED' ? '<p>This ticket is now considered resolved. If you have further questions, please open a new ticket.</p>' : ''}
                    <p>You can view the details in your portal.</p>
                </div>
            `
        });

        await client.query('COMMIT');
        res.json(updatedTicket);
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(500).json({ message: 'Failed to update ticket.' });
    } finally {
        client.release();
    }
};


export const deleteTicket = async (req: Request, res: Response) => {
    const { id } = req.params;
    try {
        const { rowCount } = await pool.query('DELETE FROM support_tickets WHERE id = $1', [id]);
        if (rowCount === 0) {
            return res.status(404).json({ message: 'Ticket not found' });
        }
        res.status(204).send();
    } catch (err) {
        res.status(500).json({ message: 'Failed to delete ticket' });
    }
};