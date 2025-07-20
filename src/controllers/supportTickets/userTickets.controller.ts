import { Request, Response } from 'express';
import pool from '../../lib/db.js';
import { resend } from '../../lib/resend.js';
import { validateNewTicketByUser } from '../../validations/userSupportTicketValidator.js';

export const listUserTickets = async (req: Request, res: Response) => {
    const user = (req as any).user;
    try {
        const { rows } = await pool.query(
            'SELECT id, subject, status, updated_at FROM support_tickets WHERE user_id = $1 ORDER BY updated_at DESC',
            [user.id]
        );
        res.json(rows);
    } catch (err) {
        res.status(500).json({ message: 'Failed to fetch tickets.' });
    }
};

export const getTicketById = async (req: Request, res: Response) => {
    const { id } = req.params;
    const user = (req as any).user;
    try {
        const { rows, rowCount } = await pool.query(
            'SELECT * FROM support_tickets WHERE id = $1 AND user_id = $2',
            [id, user.id]
        );
        if (rowCount === 0) {
            return res.status(404).json({ message: 'Ticket not found or permission denied.' });
        }
        res.json(rows[0]);
    } catch (err) {
        res.status(500).json({ message: 'Failed to fetch ticket.' });
    }
};

export const createTicket = async (req: Request, res: Response) => {
    const validationErrors = validateNewTicketByUser(req.body);
    if (validationErrors.length > 0) {
        return res.status(400).json({ message: 'Invalid input.', errors: validationErrors });
    }

    const { subject, description } = req.body;
    const userFromToken = (req as any).user; // Contains id, role, etc. from JWT

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // --- THIS IS THE FIX ---
        // 1. Fetch the user's full details from the database.
        const userDetailsResult = await client.query('SELECT name, email FROM users WHERE id = $1', [userFromToken.id]);
        if (userDetailsResult.rowCount === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: 'Authenticated user not found in database.' });
        }
        const userDetails = userDetailsResult.rows[0];

        // 2. Insert the ticket using the user's ID.
        const { rows } = await client.query(
            'INSERT INTO support_tickets (user_id, subject, description) VALUES ($1, $2, $3) RETURNING *',
            [userFromToken.id, subject, description]
        );
        const newTicket = rows[0];

        const adminEmailsResult = await client.query(
            "SELECT email FROM admins WHERE role IN ('SUPER_ADMIN', 'SUPPORT_ADMIN') AND is_active = TRUE"
        );
        const adminEmails = adminEmailsResult.rows.map(admin => admin.email);

        if (adminEmails.length > 0) {
            // 3. Use the fetched user details in the email template.
            await resend.emails.send({
                from: `Higgs Workspace Alerts <${process.env.INVITE_EMAIL_FROM}>`,
                to: adminEmails,
                subject: `New Support Ticket [#${newTicket.id}]: ${newTicket.subject}`,
                html: `
                    <div style="font-family: sans-serif; padding: 20px;">
                        <h2>New Support Ticket Received</h2>
                        <p>A new support ticket has been created by <strong>${userDetails.name} (${userDetails.email})</strong>.</p>
                        <div style="border: 1px solid #ddd; padding: 15px; margin-top: 20px;">
                            <p><strong>Ticket ID:</strong> #${newTicket.id}</p>
                            <p><strong>Subject:</strong> ${newTicket.subject}</p>
                            <hr style="border: none; border-top: 1px solid #eee;" />
                            <p>${newTicket.description}</p>
                        </div>
                    </div>
                `
            });
        }

        await client.query('COMMIT');
        res.status(201).json(newTicket);
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error creating ticket:', err);
        res.status(500).json({ message: 'Failed to create ticket.' });
    } finally {
        client.release();
    }
};

export const deleteTicket = async (req: Request, res: Response) => {
    const { id } = req.params;
    const user = (req as any).user;
    try {
        const { rowCount } = await pool.query(
            "DELETE FROM support_tickets WHERE id = $1 AND user_id = $2 AND status = 'OPEN'",
            [id, user.id]
        );
        if (rowCount === 0) {
            return res.status(404).json({ message: 'Ticket not found, is already being worked on, or you do not have permission.' });
        }
        res.status(204).send();
    } catch (err) {
        res.status(500).json({ message: 'Failed to delete ticket.' });
    }
};