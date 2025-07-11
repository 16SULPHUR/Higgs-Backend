import { Request, Response } from 'express';
import pool from '../../lib/db.js';

// const CANCELLATION_MINUTES_BEFORE = 15;

export const getAllBookings = async (req: Request, res: Response) => {
    console.log(req.body) 
    try {
        const query = `
            SELECT 
                b.id, b.start_time, b.end_time, b.status,
                u.name as user_name, u.email as user_email,
                r.name as room_instance_name,
                tor.name as room_type_name,
                l.name as location_name
             FROM bookings b 
             JOIN users u ON b.user_id = u.id
             JOIN rooms r ON b.room_id = r.id
             JOIN type_of_rooms tor ON r.type_of_room_id = tor.id
             JOIN locations l ON tor.location_id = l.id
             ORDER BY b.start_time DESC;
        `;
        const { rows } = await pool.query(query);
        res.json(rows);
    } catch (err) {
        console.error('Error fetching all bookings for admin:', err);
        res.status(500).json({ message: 'Failed to fetch all bookings.' });
    }
};


export const cancelAnyBooking = async (req: Request, res: Response) => {
    const { bookingId } = req.params;
    const adminUser = (req as any).admin;

    if (!bookingId) {
        return res.status(400).json({ message: 'Booking ID is required.' });
    }

    const client = await pool.connect();

    try {
        await client.query('BEGIN');
        
        const bookingQuery = `
            SELECT 
                b.start_time, 
                b.status,
                b.user_id,
                u.role as user_role,
                u.organization_id,
                tor.credits_per_booking
             FROM bookings b
             JOIN users u ON b.user_id = u.id
             JOIN rooms r ON b.room_id = r.id
             JOIN type_of_rooms tor ON r.type_of_room_id = tor.id
             WHERE b.id = $1;
        `;
        const bookingResult = await client.query(bookingQuery, [bookingId]);

        if (bookingResult.rowCount === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: 'Booking not found.' });
        }

        const booking = bookingResult.rows[0];

        if (booking.status !== 'CONFIRMED') {
            await client.query('ROLLBACK');
            return res.status(400).json({ message: 'This booking cannot be cancelled as it is not confirmed.' });
        }

        const bookingStartTime = new Date(booking.start_time);
        if (new Date() > bookingStartTime) {
             console.log(`Admin ${adminUser.adminId} is cancelling a past booking.`);
        }
        
        const creditsToRefund = booking.credits_per_booking;
        if (booking.user_role === 'INDIVIDUAL_USER' || booking.user_role === 'ORG_ADMIN') {
            await client.query('UPDATE users SET individual_credits = individual_credits + $1 WHERE id = $2', [creditsToRefund, booking.user_id]);
        } else if (booking.user_role === 'ORG_USER') {
            await client.query('UPDATE organizations SET credits_pool = credits_pool + $1 WHERE id = $2', [creditsToRefund, booking.organization_id]);
        }
        
        const { rows } = await client.query(
            `UPDATE bookings SET status = 'CANCELLED' WHERE id = $1 RETURNING *`,
            [bookingId]
        );

        await client.query('COMMIT');
        
        res.status(200).json({ message: 'Booking cancelled successfully by admin.', booking: rows[0] });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error(`Admin error cancelling booking ${bookingId}:`, err);
        res.status(500).json({ message: 'Failed to cancel booking due to a server error.' });
    } finally {
        client.release();
    }
};
