import { Request, Response } from 'express';
import pool from '../../lib/db.js';
import { resend } from '../../lib/resend.js';

export const registerGuestForEvent = async (req: Request, res: Response) => {
    const { eventId } = req.params;
    const { name, email, phone } = req.body;

    if (!name || !email) {
        return res.status(400).json({ message: 'Name and email are required for guest registration.' });    
    }

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const eventResult = await client.query('SELECT title, date FROM events WHERE id = $1', [eventId]);
        if (eventResult.rowCount === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: 'Event not found.' });
        }
        const event = eventResult.rows[0];

        const query = 'INSERT INTO guest_event_registrations (event_id, guest_name, guest_email, guest_phone) VALUES ($1, $2, $3, $4) RETURNING *';
        const { rows } = await client.query(query, [eventId, name, email, phone]);

        const eventDate = new Date(event.date).toLocaleDateString('en-US', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric',
            timeZone: 'Asia/Kolkata'
        });

        await resend.emails.send({
            from: `Higgs Workspace Events <${process.env.INVITE_EMAIL_FROM}>`,
            to: email,
            subject: `Confirmation: You're registered for ${event.title}!`,
            html: `
                <div style="font-family: sans-serif; padding: 20px; color: #333;">
                    <h2>Hi ${name},</h2>
                    <p>Thank you for registering for our upcoming event. We've saved your spot!</p>
                    <div style="border: 1px solid #ddd; border-radius: 8px; padding: 20px; margin-top: 20px; background-color: #f9f9f9;">
                        <h3 style="margin-top: 0;">Event Details</h3>
                        <p><strong>Event:</strong> ${event.title}</p>
                        <p><strong>Date:</strong> ${eventDate}</p>
                    </div>
                    <p style="margin-top: 30px; font-size: 0.8em; color: #777;">
                        We look forward to seeing you there. If you have any questions, please contact our support team.
                    </p>
                </div>
            `
        });

        await client.query('COMMIT');
        res.status(201).json({ message: 'Successfully registered for the event. A confirmation email has been sent.', registration: rows[0] });

    } catch (err: any) {
        await client.query('ROLLBACK');
        if (err.code === '23505') {  
            return res.status(409).json({ message: 'This email address is already registered for this event.' });
        }
        console.error('Guest registration error:', err);
        res.status(500).json({ message: 'Failed to register as a guest.' });
    } finally {
        client.release();
    }
};