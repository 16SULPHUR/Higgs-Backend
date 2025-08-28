import dotenv from 'dotenv';
dotenv.config();

import pool from '../../build/src/lib/db.js';
import { zeptoClient } from '../../build/src/lib/zeptiMail.js';

async function fetchBookingRecipients(client, bookingId) {
  const ownerQuery = `
    SELECT u.email, u.name
    FROM bookings b
    JOIN users u ON b.user_id = u.id
    WHERE b.id = $1
  `;
  const guestsQuery = `
    SELECT guest_email as email, guest_name as name
    FROM guest_invitations
    WHERE booking_id = $1
  `;

  const [ownerRes, guestsRes] = await Promise.all([
    client.query(ownerQuery, [bookingId]),
    client.query(guestsQuery, [bookingId]),
  ]);

  const recipients = [];
  if (ownerRes.rows[0]) recipients.push(ownerRes.rows[0]);
  for (const g of guestsRes.rows) recipients.push(g);

  const seen = new Set();
  return recipients.filter((r) => {
    if (!r.email) return false;
    const key = r.email.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function fetchBookingsInWindow(client, minutesFrom, minutesTo) {
  const query = `
    SELECT 
      b.id,
      b.start_time,
      r.name AS room_instance_name,
      tor.name AS room_type_name
    FROM bookings b
    JOIN rooms r ON b.room_id = r.id
    JOIN type_of_rooms tor ON r.type_of_room_id = tor.id
    WHERE b.status = 'CONFIRMED'
      AND b.start_time BETWEEN NOW() + ($1 || ' minutes')::interval 
                           AND NOW() + ($2 || ' minutes')::interval
  `;
  const { rows } = await client.query(query, [minutesFrom, minutesTo]);
  return rows;
}

function buildEmailSubject(prefix, roomTypeName) {
  return `${prefix}: ${roomTypeName}`;
}

function buildEmailBody(name, roomType, roomInstance, startIso, notice) {
  const dt = new Date(startIso);
  const date = dt.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
  const time = dt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  const greeting = name ? `Hi ${name},` : 'Hi,';
  return `
    <div style="font-family: sans-serif; color: #333;">
      <p>${greeting}</p>
      <p>This is a ${notice} reminder for your meeting at <strong>Higgs Workspace</strong>.</p>
      <div style="border: 1px solid #eee; border-radius: 8px; padding: 16px; margin: 16px 0;">
        <p style="margin: 4px 0;"><strong>Room:</strong> ${roomType} (${roomInstance})</p>
        <p style="margin: 4px 0;"><strong>Date:</strong> ${date}</p>
        <p style="margin: 4px 0;"><strong>Time:</strong> ${time}</p>
      </div>
      <p style="font-size: 12px; color: #777;">This is an automated reminder. Please do not reply.</p>
    </div>
  `;
}

async function sendRemindersForWindow(client, windowLabel) {
  const windowMinutes = windowLabel === '30min' ? [29, 30] : [23 * 60, 24 * 60];
  const noticeText = windowLabel === '30min' ? '30 minutes' : '1 day';

  const bookings = await fetchBookingsInWindow(client, windowMinutes[0], windowMinutes[1]);
  if (bookings.length === 0) return;

  for (const b of bookings) {
    const recipients = await fetchBookingRecipients(client, b.id);
    if (recipients.length === 0) continue;

    const subject = buildEmailSubject(
      windowLabel === '30min' ? 'Upcoming Meeting (in 30 mins)' : 'Upcoming Meeting (tomorrow)',
      b.room_type_name
    );

    const sendPromises = recipients.map((r) =>
      zeptoClient.sendMail({
        from: {
          address: process.env.INVITE_EMAIL_FROM,
          name: 'Higgs Workspace',
        },
        to: [
          {
            email_address: {
              address: r.email,
              name: r.name ?? undefined,
            },
          },
        ],
        subject,
        htmlbody: buildEmailBody(r.name, b.room_type_name, b.room_instance_name, b.start_time, noticeText),
      })
    );

    try {
      await Promise.all(sendPromises);
      console.log(`[meetingAlerts] Sent ${windowLabel} reminder for booking ${b.id} to ${recipients.length} recipient(s).`);
    } catch (err) {
      console.error(`[meetingAlerts] Failed to send ${windowLabel} reminder for booking ${b.id}:`, err);
    }
  }
}

async function runMeetingAlerts() {
  const client = await pool.connect();
  try {
    await sendRemindersForWindow(client, '1day');
    await sendRemindersForWindow(client, '30min');
  } catch (err) {
    console.error('[meetingAlerts] Error running alerts:', err);
  } finally {
    client.release();
  }
}

runMeetingAlerts()
  .then(() => {
    console.log('[meetingAlerts] Completed.');
    process.exit(0);
  })
  .catch((err) => {
    console.error('[meetingAlerts] Fatal error:', err);
    process.exit(1);
  });


