const { Pool } = require('pg');
const { Resend } = require('resend');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const resend = new Resend(process.env.RESEND_API_KEY);

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
            console.log(`Organization ${org.org_name} is low on credits. Sending warning.`);
            await resend.emails.send({
                from: 'Higgs Workspace <billing@yourdomain.com>',
                to: org.admin_email,
                subject: 'Low Credit Warning for your Organization',
                html: `<p>Hi ${org.admin_name},</p><p>This is a notification that your organization, <strong>${org.org_name}</strong>, has 10% or less of its monthly credits remaining.</p>`,
            });
        }
    } catch (err) {
        console.error('Error checking credit warnings:', err);
    } finally {
        client.release();
    }
}

checkCreditWarnings().then(() => pool.end());