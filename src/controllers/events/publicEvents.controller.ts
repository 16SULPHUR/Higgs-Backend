import { Request, Response } from 'express';
import pool from '../../lib/db.js'; 
import { zeptoClient } from '../../lib/zeptiMail.js';

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

        const existingUserResult = await client.query('SELECT id, name FROM users WHERE email = $1', [email]);
        const existingUser = existingUserResult.rows[0];

        if (existingUser) {
            const insertQuery = 'INSERT INTO event_registrations (event_id, user_id) VALUES ($1, $2) RETURNING *';
            await client.query(insertQuery, [eventId, existingUser.id]);
        } else {
            const insertQuery = 'INSERT INTO guest_event_registrations (event_id, guest_name, guest_email, guest_phone) VALUES ($1, $2, $3, $4) RETURNING *';
            await client.query(insertQuery, [eventId, name, email, phone]);
        }
        // -----------------------------

        const eventDate = new Date(event.date).toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            timeZone: 'Asia/Kolkata'
        });

        await zeptoClient.sendMail({
            from: {
                address: process.env.INVITE_EMAIL_FROM as string,
                name: "Higgs Workspace Events",
            },
            to: [
                {
                    email_address: {
                        address: email,
                        name: existingUser ? existingUser.name : name,
                    },
                },
            ],
            subject: `Confirmation: You're registered for ${event.title}!`,
            htmlbody: `
                <div style="font-family: sans-serif; padding: 20px; color: #333;">
                <h2>Hi ${existingUser ? existingUser.name : name},</h2>
                <p>Thank you for registering for our upcoming event. We've saved your spot!</p>
                <div style="border: 1px solid #ddd; border-radius: 8px; padding: 20px; margin-top: 20px; background-color: #f9f9f9;">
                    <h3 style="margin-top: 0;">Event Details</h3>
                    <p><strong>Event:</strong> ${event.title}</p>
                    <p><strong>Date:</strong> ${eventDate}</p>
                </div>
                <p style="margin-top: 30px; font-size: 0.8em; color: #777;">
                    We look forward to seeing you there.
                </p>
                </div>
            `,
        });


        await client.query('COMMIT');
        res.status(201).json({ message: 'Successfully registered for the event. A confirmation email has been sent.' });

    } catch (err: any) {
        await client.query('ROLLBACK');
        if (err.code === '23505') {
            return res.status(409).json({ message: 'This email address is already registered for this event.' });
        }
        console.error('Guest/Member registration error:', err);
        res.status(500).json({ message: 'Failed to complete registration.' });
    } finally {
        client.release();
    }
};