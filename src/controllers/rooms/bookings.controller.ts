import { Request, Response } from 'express';
import pool from '../../lib/db.js';
import { resend } from '../../lib/resend.js'; 


const MAX_BOOKING_DAYS_AHEAD = 3;
const COOLDOWN_WINDOW_MINUTES = 30;

const CANCELLATION_MINUTES_BEFORE = 15;
const MAX_CANCELLATIONS_PER_MONTH = 5;

export function parseDateWithOffset(dateStr: string): number {
    const match = dateStr.match(
        /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?([+-])(\d{2}):(\d{2})$/
    ); // Allow optional milliseconds

    // const match = dateStr.match(
    //     /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})([+-])(\d{2}):(\d{2})$/
    // );

    if (!match) throw new Error('Invalid datetime format: ' + dateStr);

    const [, year, month, day, hour, minute, second, sign, offsetH, offsetM] = match;

    const utcTime = Date.UTC(
        +year,
        +month - 1,
        +day,
        +hour,
        +minute,
        +second
    );

    const offsetMinutes = (+offsetH * 60 + +offsetM) * (sign === '+' ? 1 : -1);
    return utcTime - offsetMinutes * 60 * 1000;
}




export const createBooking = async (req: Request, res: Response) => {
    const { type_of_room_id, start_time, end_time } = req.body;
    console.log(start_time, end_time)
    const user = (req as any).user;

    console.log("create booking")
    console.log(req.body)

    if (!type_of_room_id || !start_time || !end_time) {
        return res.status(400).json({ message: 'Room type, start time, and end time are required.' });
    }

    let startMillis: number;
    let endMillis: number;

    try {
        startMillis = parseDateWithOffset(start_time);
        endMillis = parseDateWithOffset(end_time);
    } catch (err) {
        return res.status(400).json({ message: 'Invalid date format.' });
    }

    if (startMillis >= endMillis) {
        return res.status(400).json({ message: 'Start time must be before end time.' });
    }

    const currentTime = new Date();
    const bookingStartDate = new Date(startMillis);

    const isSameDay = currentTime.toDateString() === bookingStartDate.toDateString();
    const isInPast = bookingStartDate < currentTime;

    if (isSameDay && isInPast) {
        return res.status(400).json({ message: 'You cannot book a time earlier than the current time on the same day.' });
    }

    const maxBookingMillis = currentTime.getTime() + MAX_BOOKING_DAYS_AHEAD * 24 * 60 * 60 * 1000;

    if (startMillis > maxBookingMillis) {
        return res.status(400).json({ message: `Bookings can only be made up to ${MAX_BOOKING_DAYS_AHEAD} days in advance.` });
    }


    if (startMillis > maxBookingMillis) {
        return res.status(400).json({ message: `Bookings can only be made up to ${MAX_BOOKING_DAYS_AHEAD} days in advance.` });
    }

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const roomTypeResult = await client.query(
            'SELECT credits_per_booking FROM type_of_rooms WHERE id = $1',
            [type_of_room_id]
        );

        if (roomTypeResult.rowCount === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: 'Room type not found.' });
        }

        const roomCost = roomTypeResult.rows[0].credits_per_booking;
        let hasSufficientCredits = false;

        if (user.role === 'ORG_ADMIN' || user.role === 'ORG_USER') {
            const orgCreditsResult = await client.query('SELECT credits_pool FROM organizations WHERE id = $1', [user.organization_id]);
            if (orgCreditsResult.rows[0]?.credits_pool >= roomCost) {
                hasSufficientCredits = true;
            }
        } else if (user.role === 'INDIVIDUAL_USER') {
            const userCreditsResult = await client.query('SELECT individual_credits FROM users WHERE id = $1', [user.id]);
            if (userCreditsResult.rows[0]?.individual_credits >= roomCost) {
                hasSufficientCredits = true;
            }
        }

        if (!hasSufficientCredits) {
            await client.query('ROLLBACK');
            return res.status(402).json({ message: 'Insufficient credits for this booking.' });
        }

        const cooldownStart = new Date(startMillis - COOLDOWN_WINDOW_MINUTES * 60 * 1000).toISOString();
        const cooldownEnd = new Date(endMillis + COOLDOWN_WINDOW_MINUTES * 60 * 1000).toISOString();

        const cooldownConflictResult = await client.query(
            `SELECT * FROM bookings
             WHERE user_id = $1
             AND status = 'CONFIRMED'
             AND (start_time < $3 AND end_time > $2)`,
            [user.id, cooldownStart, cooldownEnd]
        );

        if (cooldownConflictResult.rowCount > 0) {
            await client.query('ROLLBACK');
            return res.status(409).json({ message: `You have another booking within the ${COOLDOWN_WINDOW_MINUTES}-minute cooldown period.` });
        }

        const roomQuery = `
            SELECT id FROM rooms
            WHERE type_of_room_id = $1 AND is_active = TRUE
            AND id NOT IN (
                SELECT room_id FROM bookings
                WHERE start_time < $3 AND end_time > $2 AND status = 'CONFIRMED'
            )
            LIMIT 1
            FOR UPDATE;
        `;
        const availableRoomResult = await client.query(roomQuery, [type_of_room_id, start_time, end_time]);

        if (availableRoomResult.rowCount === 0) {
            await client.query('ROLLBACK');
            return res.status(409).json({ message: 'No available rooms of this type for the selected time slot.' });
        }

        const allocatedRoomId = availableRoomResult.rows[0].id;


        console.log("roomCost, user.role============")
        console.log(roomCost, user.role)

        if (user.role === 'ORG_ADMIN' || user.role === 'ORG_USER') {
            await client.query('UPDATE organizations SET credits_pool = credits_pool - $1 WHERE id = $2', [roomCost, user.organization_id]);
        } else if (user.role === 'INDIVIDUAL_USER') {
            await client.query('UPDATE users SET individual_credits = individual_credits - $1 WHERE id = $2', [roomCost, user.id]);
        }

        const insertQuery = `
            INSERT INTO bookings (room_id, user_id, start_time, end_time, status)
            VALUES ($1, $2, $3, $4, 'CONFIRMED')
            RETURNING *;
        `;
        const { rows } = await client.query(insertQuery, [
            allocatedRoomId,
            user.id,
            start_time,
            end_time,
        ]);

        await client.query('COMMIT');

        const bookingDetailsQuery = `SELECT u.name, u.email, tor.name as type_name, r.name as instance_name, b.start_time FROM bookings b JOIN users u ON b.user_id = u.id JOIN rooms r ON b.room_id = r.id JOIN type_of_rooms tor ON r.type_of_room_id = tor.id WHERE b.id = $1`;
    const detailsResult = await pool.query(bookingDetailsQuery, [rows[0].id]);
    const details = detailsResult.rows[0];
    
    await resend.emails.send({
                   from: `Higgs Workspace <${process.env.INVITE_EMAIL_FROM}>`,

        to: details.email,
        subject: `Booking Confirmed: ${details.type_name}`,
        html: `<p>Hi ${details.name},</p><p>Your booking for <strong>${details.type_name} (${details.instance_name})</strong> on ${new Date(details.start_time).toDateString()} is confirmed.</p>`,
    });


        res.status(201).json(rows[0]);

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error creating booking:', err);
        res.status(500).json({ message: 'Failed to create booking.' });
    } finally {
        client.release();
    }
};

export const cancelBooking = async (req: Request, res: Response) => {
    const { id: bookingId } = req.params;
    const user = (req as any).user;

    if (!bookingId) {
        return res.status(400).json({ message: 'Booking ID is required.' });
    }

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const bookingResult = await client.query(
            `SELECT 
                b.start_time, 
                b.status,
                u.role as user_role,
                u.organization_id,
                tor.credits_per_booking
             FROM bookings b
             JOIN users u ON b.user_id = u.id
             JOIN rooms r ON b.room_id = r.id
             JOIN type_of_rooms tor ON r.type_of_room_id = tor.id
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
            return res.status(400).json({ message: `This booking cannot be cancelled as its status is '${booking.status}'.` });
        }

        const bookingStartTime = new Date(booking.start_time);
        const now = new Date();
        const cancellationDeadline = new Date(bookingStartTime.getTime() - CANCELLATION_MINUTES_BEFORE * 60000);

        if (now > cancellationDeadline) {
            await client.query('ROLLBACK');
            return res.status(403).json({ message: `Bookings must be cancelled at least ${CANCELLATION_MINUTES_BEFORE} minutes in advance.` });
        }

        const monthlyCancellationsResult = await client.query(
            `SELECT COUNT(*) FROM bookings 
             WHERE user_id = $1 AND status = 'CANCELLED' 
             AND date_trunc('month', start_time) = date_trunc('month', NOW())`,
            [user.id]
        );

        const monthlyCancellationsCount = parseInt(monthlyCancellationsResult.rows[0].count, 10);

        if (monthlyCancellationsCount >= MAX_CANCELLATIONS_PER_MONTH) {
            await client.query('ROLLBACK');
            return res.status(403).json({ message: 'You have reached your monthly cancellation limit.' });
        }

        // --- THIS IS THE ONLY MODIFIED LOGIC BLOCK ---
        const creditsToRefund = booking.credits_per_booking;
        if (booking.user_role === 'ORG_ADMIN' || booking.user_role === 'ORG_USER') {
            await client.query('UPDATE organizations SET credits_pool = credits_pool + $1 WHERE id = $2', [creditsToRefund, booking.organization_id]);
        } else if (booking.user_role === 'INDIVIDUAL_USER') {
            await client.query('UPDATE users SET individual_credits = individual_credits + $1 WHERE id = $2', [creditsToRefund, user.id]);
        }
        // ---------------------------------------------

        const { rows } = await client.query(
            `UPDATE bookings SET status = 'CANCELLED' WHERE id = $1 RETURNING *`,
            [bookingId]
        );

        await client.query('COMMIT');

        const bookingDetailsQuery = `SELECT u.name, u.email, tor.name as type_name FROM bookings b JOIN users u ON b.user_id = u.id JOIN rooms r ON b.room_id = r.id JOIN type_of_rooms tor ON r.type_of_room_id = tor.id WHERE b.id = $1`;
    const detailsResult = await pool.query(bookingDetailsQuery, [bookingId]);
    const details = detailsResult.rows[0];

    await resend.emails.send({
        from: 'Higgs Workspace <confirmations@yourdomain.com>',
        to: details.email,
        subject: `Booking Cancelled: ${details.type_name}`,
        html: `<p>Hi ${details.name},</p><p>Your booking for <strong>${details.type_name}</strong> has been successfully cancelled.</p>`,
    });

        res.status(200).json({ message: 'Booking cancelled successfully.', booking: rows[0] });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error(`Error cancelling booking ${bookingId}:`, err);
        res.status(500).json({ message: 'Failed to cancel booking due to a server error.' });
    } finally {
        client.release();
    }
};



export const listUserBookings = async (req: Request, res: Response) => {
    const user_id = (req as any).user.id;
    try {
        const { rows } = await pool.query(
            `SELECT 
                b.id, b.start_time, b.end_time, b.status,
                r.name as room_instance_name,
                tor.name as room_type_name
             FROM bookings b 
             JOIN rooms r ON b.room_id = r.id
             JOIN type_of_rooms tor ON r.type_of_room_id = tor.id
             WHERE b.user_id = $1 ORDER BY b.start_time DESC`,
            [user_id]
        );
        res.json(rows);
    } catch (err) {
        res.status(500).json({ message: 'Failed to fetch bookings' });
    }
};

export const getBookingById = async (req: Request, res: Response) => {
    const { id: bookingId } = req.params;
    const user = (req as any).user;

    if (!bookingId) {
        return res.status(400).json({ message: 'Booking ID is required.' });
    }

    try {
        const query = `
            SELECT 
                b.id, 
                b.start_time, 
                b.end_time, 
                b.status,
                b.user_id,
                r.name as room_instance_name,
                tor.name as room_type_name,
                tor.credits_per_booking -- The missing piece of data
             FROM bookings b 
             JOIN rooms r ON b.room_id = r.id
             JOIN type_of_rooms tor ON r.type_of_room_id = tor.id
             WHERE b.id = $1;
        `;

        const { rows, rowCount } = await pool.query(query, [bookingId]);

        if (rowCount === 0) {
            return res.status(404).json({ message: 'Booking not found.' });
        }

        const booking = rows[0];

        if (booking.user_id !== user.id) {
            return res.status(403).json({ message: 'Forbidden: You do not have permission to view this booking.' });
        }

        delete booking.user_id;

        res.json(booking);

    } catch (err) {
        console.error(`Error fetching booking ${bookingId}:`, err);
        res.status(500).json({ message: 'Failed to fetch booking details.' });
    }
};


export const rescheduleBooking = async (req: Request, res: Response) => {
    const { bookingId } = req.params;
    const { new_type_of_room_id, new_start_time, new_end_time } = req.body;
    const user = (req as any).user;

    if (!new_type_of_room_id || !new_start_time || !new_end_time) {
        return res.status(400).json({ message: 'New room type and time range are required.' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const originalBookingQuery = `
            SELECT b.*, tor.credits_per_booking as old_cost
            FROM bookings b
            JOIN rooms r ON b.room_id = r.id
            JOIN type_of_rooms tor ON r.type_of_room_id = tor.id
            WHERE b.id = $1 AND b.user_id = $2 FOR UPDATE;
        `;
        const originalBookingResult = await client.query(originalBookingQuery, [bookingId, user.id]);

        if (originalBookingResult.rowCount === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: 'Original booking not found or permission denied.' });
        }
        const oldBooking = originalBookingResult.rows[0];

        const newRoomTypeResult = await client.query('SELECT credits_per_booking FROM type_of_rooms WHERE id = $1', [new_type_of_room_id]);
        if (newRoomTypeResult.rowCount === 0) { throw new Error('New room type not found.'); }
        const newCost = newRoomTypeResult.rows[0].credits_per_booking;
        
        const findInstanceQuery = `
            SELECT id FROM rooms
            WHERE type_of_room_id = $1 AND is_active = TRUE AND id NOT IN (
                SELECT room_id FROM bookings WHERE start_time < $3 AND end_time > $2 AND status = 'CONFIRMED' AND id != $4
            ) LIMIT 1 FOR UPDATE;
        `;
        const availableRoomResult = await client.query(findInstanceQuery, [new_type_of_room_id, new_start_time, new_end_time, bookingId]);
        if (availableRoomResult.rowCount === 0) {
            await client.query('ROLLBACK');
            return res.status(409).json({ message: 'The new time slot is no longer available.' });
        }
        const newAllocatedRoomId = availableRoomResult.rows[0].id;
        
        const creditDifference = oldBooking.old_cost - newCost;
        
        // --- THIS IS THE ONLY MODIFIED LOGIC BLOCK ---
        if (user.role === 'ORG_ADMIN' || user.role === 'ORG_USER') {
            await client.query('UPDATE organizations SET credits_pool = credits_pool + $1 WHERE id = $2', [creditDifference, user.organization_id]);
        } else if (user.role === 'INDIVIDUAL_USER') {
            await client.query('UPDATE users SET individual_credits = individual_credits + $1 WHERE id = $2', [creditDifference, user.id]);
        }
        // ---------------------------------------------
        
        const { rows: updatedBookingRows } = await client.query(
            `UPDATE bookings SET room_id = $1, start_time = $2, end_time = $3, status = 'CONFIRMED' WHERE id = $4 RETURNING *`,
            [newAllocatedRoomId, new_start_time, new_end_time, bookingId]
        );

        const guestsResult = await client.query('SELECT guest_name, guest_email FROM guest_invitations WHERE booking_id = $1', [bookingId]);
        
        if (guestsResult.rows.length > 0) { 
            const inviterResult = await client.query('SELECT name FROM users WHERE id = $1', [user.id]);
            const inviter_name = inviterResult.rows[0]?.name || 'A colleague';
 
            const roomDetailsQuery = `
                SELECT r.name as room_instance_name, tor.name as room_type_name, l.name as location_name, l.address as location_address
                FROM rooms r
                JOIN type_of_rooms tor ON r.type_of_room_id = tor.id
                JOIN locations l ON tor.location_id = l.id
                WHERE r.id = $1;
            `;
            const roomDetailsResult = await client.query(roomDetailsQuery, [newAllocatedRoomId]);
            const detailsForEmail = roomDetailsResult.rows[0];

            const newStartTime = new Date(new_start_time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' });
            const newEndTime = new Date(new_end_time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' });
            const newDate = new Date(new_start_time).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

            const emailPromises = guestsResult.rows.map(guest => 
                resend.emails.send({
                    from: `Higgs Workspace <updates@yourdomain.com>`,
                    to: guest.guest_email,
                    subject: `Update: Your Meeting at Higgs Workspace has been Rescheduled`,
                    html: `<div style="font-family: sans-serif; padding: 20px; color: #333;"><h2>Hello ${guest.guest_name},</h2><p>Please note, your meeting with <strong>${inviter_name}</strong> has been updated.</p><p style="color: #d9534f;">Please disregard any previous invitations.</p><div style="border: 1px solid #ddd; border-radius: 8px; padding: 20px; margin-top: 20px;"><h3 style="margin-top: 0;">New Meeting Details</h3><p><strong>Room:</strong> ${detailsForEmail.room_type_name} (${detailsForEmail.room_instance_name})</p><p><strong>Date:</strong> ${newDate}</p><p><strong>Time:</strong> ${newStartTime} - ${newEndTime} (IST)</p><p><strong>Location:</strong> ${detailsForEmail.location_name}</p><p style="font-size: 0.9em; color: #555;">${detailsForEmail.location_address}</p></div><p style="margin-top: 30px; font-size: 0.8em; color: #777;">This is an automated notification.</p></div>`
                })
            );

            await Promise.all(emailPromises);
        }

        await client.query('COMMIT');
        res.status(200).json({ message: "Booking successfully rescheduled.", booking: updatedBookingRows[0] });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error rescheduling booking:', err);
        res.status(500).json({ message: 'Failed to reschedule booking.' });
    } finally {
        client.release();
    }
};
