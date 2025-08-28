import dotenv from "dotenv";
dotenv.config();
import pool from "../../build/src/lib/db.js";
import { zeptoClient } from "../../build/src/lib/zeptiMail.js";

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
      const { rows: registrants } = await client.query(registrantsQuery, [
        event.id,
      ]);

      for (const registrant of registrants) {
        console.log(
          `Sending reminder for ${event.title} to ${registrant.email}`
        );

        await zeptoClient.sendMail({
          from: {
            address: process.env.INVITE_EMAIL_FROM,
            name: "Higgs Workspace",
          },
          to: [
            {
              email_address: {
                address: registrant.email,
                name: registrant.name,
              },
            },
          ],
          subject: `Reminder: ${event.title} is tomorrow!`,
          htmlbody: `
            <p>Hi ${registrant.name},</p>
            <p>This is a reminder that the event <strong>${event.title}</strong> is happening tomorrow. We look forward to seeing you!</p>
          `,
        });
      }
    }
  } catch (err) {
    console.error("Error sending event reminders:", err);
  } finally {
    client.release();
  }
}

sendEventReminders().then(() => pool.end());
