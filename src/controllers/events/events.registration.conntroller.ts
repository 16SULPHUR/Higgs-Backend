import { Request, Response } from 'express';
import pool from '../../lib/db.js';
import { resend } from '../../lib/resend.js';
 
export const getEventRegistrations = async (req: Request, res: Response) => {
    const { eventId } = req.params;
    try {
        const eventCheck = await pool.query('SELECT title FROM events WHERE id = $1', [eventId]);
        if (eventCheck.rowCount === 0) {
            return res.status(404).json({ message: 'Event not found' });
        }
        const eventTitle = eventCheck.rows[0].title;

        const query = ` 
            SELECT 
                u.id, 
                u.name, 
                u.email,
                er.created_at as registration_date,
                'MEMBER' as registration_type
            FROM users u
            JOIN event_registrations er ON u.id = er.user_id
            WHERE er.event_id = $1
            
            UNION ALL
             
            SELECT 
                ger.id, 
                ger.guest_name as name, 
                ger.guest_email as email,
                ger.created_at as registration_date,
                'GUEST' as registration_type
            FROM guest_event_registrations ger
            WHERE ger.event_id = $1
            
            ORDER BY registration_date DESC;
        `;
        const { rows } = await pool.query(query, [eventId]);
        
        const members = rows.filter(r => r.registration_type === 'MEMBER');
        const guests = rows.filter(r => r.registration_type === 'GUEST');

        res.json({
            eventTitle: eventTitle,
            registrations: {
                members: members,
                guests: guests
            }
        });

    } catch (err) {
        console.error(`Error fetching registrations for event ${eventId}:`, err);
        res.status(500).json({ message: 'Failed to fetch event registrations' });
    }
};



export const registerInEvent = async (req: Request, res: Response) => {

    const { eventId } = req.params;
    const { id: userId } = req.user;

    console.log(req.body)
    console.log(userId)

    try {

        const eventCheck = await pool.query('SELECT id FROM events WHERE id = $1', [eventId]);

        if (eventCheck.rowCount === 0) {
            return res.status(404).json({ message: 'Event not found' });
        }

        const { rows } = await pool.query(
            'INSERT INTO event_registrations (event_id, user_id) VALUES ($1, $2) RETURNING *',
            [eventId, userId]
        );

        const eventDetailsQuery = `SELECT e.title, u.name, u.email FROM events e, users u WHERE e.id = $1 AND u.id = $2`;
        const detailsResult = await pool.query(eventDetailsQuery, [eventId, userId]);
        const details = detailsResult.rows[0];

        console.log("details")
        console.log(detailsResult.rows)

        await resend.emails.send({
            from: `Higgs Workspace <${process.env.INVITE_EMAIL_FROM}>`,
            to: details.email,
            subject: `You're registered for ${details.title}!`,
            html: `<p>Hi ${details.name},</p><p>You have successfully registered for our upcoming event: <strong>${details.title}</strong>. We look forward to seeing you there!</p>`,
        });


        res.json(rows);

    } catch (err) {
        console.error(`Error registrating for event ${eventId}:`, err);
        res.status(500).json({ message: 'Failed to register for event' });
    }
}

export const deregisterInEvent = async (req: Request, res: Response) => {
    const { eventId } = req.params;
    const { id: userId } = req.user;

    console.log(req.body)
    console.log(userId)

    try {

        const eventCheck = await pool.query('SELECT id FROM events WHERE id = $1', [eventId]);

        if (eventCheck.rowCount === 0) {
            return res.status(404).json({ message: 'Event not found' });
        }

        const { rows } = await pool.query(
            'DELETE FROM event_registrations WHERE event_id = $1 AND user_id = $2 RETURNING *',
            [eventId, userId]
        );


        res.json(rows);

    } catch (err) {
        console.error(`Error deregistrating for event ${eventId}:`, err);
        res.status(500).json({ message: 'Failed to deregister for event' });
    }
}