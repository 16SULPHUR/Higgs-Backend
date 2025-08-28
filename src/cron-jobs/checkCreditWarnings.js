import dotenv from "dotenv";
dotenv.config();
import pool from "../../build/src/lib/db.js";
import { zeptoClient } from "../../build/src/lib/zeptiMail.js";

async function checkCreditWarnings() {
  const client = await pool.connect();
  try {
    const query = `
      SELECT o.id as org_id, o.name as org_name, o.credits_pool, p.plan_credits, u.email as admin_email, u.name as admin_name
      FROM organizations o
      JOIN plans p ON o.plan_id = p.id
      JOIN users u ON o.org_admin_id = u.id
      WHERE p.plan_credits > 0 AND (o.credits_pool * 1.0 / p.plan_credits) <= 0.1;
    `;
    const { rows: orgs } = await client.query(query);

    for (const org of orgs) {
      console.log(
        `Organization ${org.org_name} is low on credits. Sending warning.`
      );

      await zeptoClient.sendMail({
        from: {
          address: process.env.INVITE_EMAIL_FROM,
          name: "Higgs Workspace",
        },
        to: [
          {
            email_address: {
              address: org.admin_email,
              name: org.admin_name,
            },
          },
        ],
        subject: "Low Credit Warning for your Organization",
        htmlbody: `
          <p>Hi ${org.admin_name},</p>
          <p>This is a notification that your organization, <strong>${org.org_name}</strong>, has 10% or less of its monthly credits remaining.</p>
        `,
      });
    }
  } catch (err) {
    console.error("Error checking credit warnings:", err);
  } finally {
    client.release();
  }
}

checkCreditWarnings().then(() => pool.end());
