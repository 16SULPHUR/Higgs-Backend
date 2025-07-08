import { Request, Response } from 'express';
import pool from '../../lib/db.js';


const MAX_BOOKING_DAYS_AHEAD = 3;
const COOLDOWN_WINDOW_MINUTES = 30; 

const CANCELLATION_MINUTES_BEFORE = 15;
const MAX_CANCELLATIONS_PER_MONTH = 5;

export const createBooking = async (req: Request, res: Response) => {
    const { room_id, start_time, end_time } = req.body;
    console.log("bookings::::::::req.user");
    console.log(req.user);
    const user = (req as any).user;
    

    
    if (!room_id || !start_time || !end_time || new Date(start_time) >= new Date(end_time)) {
        return res.status(400).json({ message: 'Valid room_id, start_time, and end_time are required.' });
    }

    const client = await pool.connect();

    try {
        await client.query('BEGIN');
        

        
        const bookingStartDate = new Date(start_time);
        const maxBookingDate = new Date();
        maxBookingDate.setDate(maxBookingDate.getDate() + MAX_BOOKING_DAYS_AHEAD);

        if (bookingStartDate > maxBookingDate) {
            await client.query('ROLLBACK');
            return res.status(400).json({ message: `Bookings can only be made up to ${MAX_BOOKING_DAYS_AHEAD} days in advance.` });
        }

        
        const roomResult = await client.query(
            'SELECT availability, operating_start_time, operating_end_time, credits_per_booking FROM meeting_rooms WHERE id = $1 FOR UPDATE',
            [room_id]
        );

        if (roomResult.rowCount === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: 'Active meeting room not found.' });
        }
        const roomCost = roomResult.rows[0].credits_per_booking;
        console.log(roomResult.rows[0]);

        
        let hasSufficientCredits = false;
        if (user.role === 'INDIVIDUAL_USER' || user.role === 'ORG_ADMIN') {
            const userCreditsResult = await client.query('SELECT individual_credits FROM users WHERE id = $1', [user.id]);
            const userCredits = userCreditsResult.rows[0].individual_credits;
            console.log('User Credits:', userCredits, 'Room Cost:', roomCost);
            if (userCredits >= roomCost) {
                hasSufficientCredits = true;
            }
        } else if (user.role === 'ORG_USER') {
            const orgCreditsResult = await client.query('SELECT credits_pool FROM organizations WHERE id = $1', [user.organization_id]);
            const orgCredits = orgCreditsResult.rows[0].credits_pool;
            if (orgCredits >= roomCost) {
                hasSufficientCredits = true;
            }
        }

        if (!hasSufficientCredits) {
            await client.query('ROLLBACK');
            return res.status(402).json({ message: 'Insufficient credits to make this booking.' });
        }

        
        const cooldownCheckStart = new Date(new Date(start_time).getTime() - COOLDOWN_WINDOW_MINUTES * 60000).toISOString();
        const cooldownCheckEnd = new Date(new Date(end_time).getTime() + COOLDOWN_WINDOW_MINUTES * 60000).toISOString();

        const cooldownConflictResult = await client.query(
            `SELECT id FROM bookings WHERE user_id = $1 AND status = 'CONFIRMED' AND (start_time < $3 AND end_time > $2)`,
            [user.id, cooldownCheckStart, cooldownCheckEnd]
        );

        if (cooldownConflictResult.rowCount > 0) {
            await client.query('ROLLBACK');
            return res.status(409).json({ message: `You have another booking within the ${COOLDOWN_WINDOW_MINUTES}-minute cooldown period.` });
        }

        
        if (user.role === 'INDIVIDUAL_USER' || user.role === 'ORG_ADMIN') {
            await client.query('UPDATE users SET individual_credits = individual_credits - $1 WHERE id = $2', [roomCost, user.id]);
        } else if (user.role === 'ORG_USER') {
            await client.query('UPDATE organizations SET credits_pool = credits_pool - $1 WHERE id = $2', [roomCost, user.organization_id]);
        }

        
        const { rows } = await client.query(
            'INSERT INTO bookings (meeting_room_id, user_id, start_time, end_time) VALUES ($1, $2, $3, $4) RETURNING *',
            [room_id, user.id, start_time, end_time]
        );

        await client.query('COMMIT'); 
        
        res.status(201).json(rows[0]);

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error creating booking:', err);
        res.status(500).json({ message: 'Failed to create booking' });
    } finally {
        client.release();
    }
};

export const cancelBooking = async (req: Request, res: Response) => {
    const { id: bookingId } = req.params;
    const user = (req as any).user;

    const client = await pool.connect();

    try {
        await client.query('BEGIN'); 
        

        const bookingResult = await client.query(
            `SELECT b.start_time, b.status, b.room_id, mr.credits_per_booking
             FROM bookings b
             JOIN meeting_rooms mr ON b.room_id = mr.id
             WHERE b.id = $1 AND b.user_id = $2`,
            [bookingId, user.id]
        );

        if (bookingResult.rowCount === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: 'Booking not found or you do not have permission to cancel it.' });
        }

        const booking = bookingResult.rows[0];
        if (booking.status !== 'CONFIRMED') {
            await client.query('ROLLBACK');
            return res.status(400).json({ message: 'This booking cannot be cancelled as it is not confirmed.' });
        }

        
        const bookingStartTime = new Date(booking.start_time);
        const cancellationDeadline = new Date(bookingStartTime.getTime() - CANCELLATION_MINUTES_BEFORE * 60000);

        if (new Date() > cancellationDeadline) {
            await client.query('ROLLBACK');
            return res.status(403).json({ message: `Bookings must be cancelled at least ${CANCELLATION_MINUTES_BEFORE} minutes in advance.` });
        }

        
        const monthlyCancellations = await client.query(
            `SELECT COUNT(*) FROM bookings 
             WHERE user_id = $1 AND status = 'CANCELLED' 
             AND date_trunc('month', start_time) = date_trunc('month', now())`,
            [user.id]
        );

        if (parseInt(monthlyCancellations.rows[0].count, 10) >= MAX_CANCELLATIONS_PER_MONTH) {
            await client.query('ROLLBACK');
            return res.status(403).json({ message: 'You have reached your monthly cancellation limit.' });
        }

        
        const creditsToRefund = booking.credits_per_booking;
        if (user.role === 'INDIVIDUAL_USER' || user.role === 'ORG_ADMIN') {
            await client.query('UPDATE users SET individual_credits = individual_credits + $1 WHERE id = $2', [creditsToRefund, user.id]);
        } else if (user.role === 'ORG_USER') {
            await client.query('UPDATE organizations SET credits_pool = credits_pool + $1 WHERE id = $2', [creditsToRefund, user.organization_id]);
        }

        
        const { rows } = await client.query(
            `UPDATE bookings SET status = 'CANCELLED' WHERE id = $1 RETURNING *`,
            [bookingId]
        );

        await client.query('COMMIT');
        
        res.status(200).json({ message: 'Booking cancelled successfully.', booking: rows[0] });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error(`Error cancelling booking ${bookingId}:`, err);
        res.status(500).json({ message: 'Failed to cancel booking' });
    } finally {
        client.release();
    }
};


export const listUserBookings = async (req: Request, res: Response) => {
    
    
    const user_id = (req as any).user.id;
    try {
        const { rows } = await pool.query(
            `SELECT b.id, b.start_time, b.end_time, b.status, mr.name as room_name, mr.id as room_id
             FROM bookings b JOIN meeting_rooms mr ON b.meeting_room_id = mr.id
             WHERE b.user_id = $1 ORDER BY b.start_time DESC`,
            [user_id]
        );
        res.json(rows);
    } catch (err) {
        console.error('Error fetching user bookings:', err);
        res.status(500).json({ message: 'Failed to fetch bookings' });
    }
};