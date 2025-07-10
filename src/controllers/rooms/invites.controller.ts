import { Request, Response } from 'express';
import pool from '../../lib/db.js';
import { resend } from '../../lib/resend.js';


export const inviteGuestToBooking = async (req: Request, res: Response) => {
    const { bookingId } = req.params;
    const { guestName, guestEmail } = req.body;
    const userFromToken = (req as any).user; // Contains the user's ID and role from the JWT

    if (!guestName || !guestEmail) {
        return res.status(400).json({ message: 'Guest name and email are required.' });
    }

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // --- THIS IS THE FIX ---
        // Step 1: Fetch all necessary data in one go: booking details AND the inviter's name.
        const detailsQuery = `
            SELECT 
                b.user_id, b.start_time, b.end_time,
                r.name as room_instance_name,
                tor.name as room_type_name,
                l.name as location_name,
                l.address as location_address,
                u.name as inviter_name -- Fetch the inviter's name from the users table
            FROM bookings b
            JOIN rooms r ON b.room_id = r.id
            JOIN type_of_rooms tor ON r.type_of_room_id = tor.id
            JOIN locations l ON tor.location_id = l.id
            JOIN users u ON b.user_id = u.id -- Join with users to get the name
            WHERE b.id = $1
        `;
        const bookingOwnerResult = await client.query(detailsQuery, [bookingId]);

        if (bookingOwnerResult.rowCount === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: 'Booking not found.' });
        }
        
        const bookingDetails = bookingOwnerResult.rows[0];
        
        // Step 2: Verify Ownership using the ID from the token
        if (bookingDetails.user_id !== userFromToken.id) {
            await client.query('ROLLBACK');
            return res.status(403).json({ message: 'Forbidden: You do not have permission to invite guests to this booking.' });
        }

        // Step 3: Insert the invitation record
        await client.query(
            'INSERT INTO guest_invitations (booking_id, sent_by_user_id, guest_name, guest_email) VALUES ($1, $2, $3, $4)',
            [bookingId, userFromToken.id, guestName, guestEmail]
        );

        // Step 4: Send the email using the fetched inviter_name
        const startTime = new Date(bookingDetails.start_time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' });
        const endTime = new Date(bookingDetails.end_time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' });
        const date = new Date(bookingDetails.start_time).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

        await resend.emails.send({
            from: `Higgs Workspace <${process.env.INVITE_EMAIL_FROM}>`,
            to: guestEmail,
            subject: `Meeting Invitation: ${bookingDetails.room_type_name} at Higgs Workspace`,
            html: `
                <div style="font-family: sans-serif; padding: 20px; color: #333;">
                    <h2>Hello ${guestName},</h2>
                    <p><strong>${bookingDetails.inviter_name}</strong> has invited you to a meeting at Higgs Workspace.</p>
                    <div style="border: 1px solid #ddd; border-radius: 8px; padding: 20px; margin-top: 20px;">
                        <h3 style="margin-top: 0;">Meeting Details</h3>
                        <p><strong>Room:</strong> ${bookingDetails.room_type_name} (${bookingDetails.room_instance_name})</p>
                        <p><strong>Date:</strong> ${date}</p>
                        <p><strong>Time:</strong> ${startTime} - ${endTime} (IST)</p>
                        <p><strong>Location:</strong> ${bookingDetails.location_name}</p>
                        <p style="font-size: 0.9em; color: #555;">${bookingDetails.location_address}</p>
                    </div>
                    <p style="margin-top: 30px; font-size: 0.8em; color: #777;">
                        This is an automated notification. Please contact ${bookingDetails.inviter_name} with any questions.
                    </p>
                </div>
            `
        });

        await client.query('COMMIT');
        res.status(201).json({ message: `Invitation successfully sent to ${guestEmail}.` });

    } catch (err: any) {
        await client.query('ROLLBACK');
        
        if (err.code === '23505') {
            return res.status(409).json({ message: 'This guest has already been invited to this booking.' });
        }
        console.error('Invite guest error:', err);
        res.status(500).json({ message: 'Failed to send invitation due to a server error.' });
    } finally {
        client.release();
    }
};


export const getBookingInvitations = async (req: Request, res: Response) => {
    const { bookingId } = req.params;
    const user = (req as any).user;

    try {
        const ownerCheck = await pool.query('SELECT user_id FROM bookings WHERE id = $1', [bookingId]);
        if (ownerCheck.rowCount === 0) {
            return res.status(404).json({ message: 'Booking not found.' });
        }
        if (ownerCheck.rows[0].user_id !== user.id) {
            return res.status(403).json({ message: 'Forbidden.' });
        }

        const { rows } = await pool.query('SELECT id, guest_name, guest_email, created_at FROM guest_invitations WHERE booking_id = $1 ORDER BY created_at DESC', [bookingId]);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ message: 'Failed to fetch invitations.' });
    }
};