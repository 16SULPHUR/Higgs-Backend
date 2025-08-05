const { Pool } = require('pg');
const { Resend } = require('resend');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const resend = new Resend(process.env.RESEND_API_KEY);

async function sendEventReminders() {
    const client = await pool.connect();
    try {
        const query = `
            SELECT id, title, date FROM events
            WHERE date BETWEEN NOW() + interval '23 hours' AND NOW() + interval '24 hours'
        `;
        const { rows: events } = await client.query(query);

        for (const event of events) {
            const registrantsQuery = `
                SELECT u.email, u.name FROM event_registrations er
                JOIN users u ON er.user_id = u.id
                WHERE er.event_id = $1
            `;
            const { rows: registrants } = await client.query(registrantsQuery, [event.id]);

            for (const registrant of registrants) {
                console.log(`Sending reminder for ${event.title} to ${registrant.email}`);
                await resend.emails.send({
                    from: `Higgs Workspace <${process.env.EMAIL_FROM}>`,
                    to: registrant.email,
                    subject: `Reminder: ${event.title} is tomorrow!`,
                    html: `<p>Hi ${registrant.name},</p><p>This is a reminder that the event <strong>${event.title}</strong> is happening tomorrow. We look forward to seeing you!</p>`,
                });
            }
        }
    } catch (err) {
        console.error('Error sending event reminders:', err);
    } finally {
        client.release();
    }
}

sendEventReminders().then(() => pool.end());