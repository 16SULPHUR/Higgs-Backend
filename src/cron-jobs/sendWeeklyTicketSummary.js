const { Pool } = require('pg');
const { Resend } = require('resend');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const resend = new Resend(process.env.RESEND_API_KEY);

async function sendWeeklySummary() {
    console.log('Starting weekly support ticket summary generation...');
    const client = await pool.connect();
    
    try {
        const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

        const newTicketsQuery = `SELECT COUNT(*) FROM support_tickets WHERE created_at >= $1;`;
        const closedTicketsQuery = `SELECT COUNT(*) FROM support_tickets WHERE status = 'CLOSED' AND updated_at >= $1;`;
        const openTicketsQuery = `SELECT COUNT(*) FROM support_tickets WHERE status = 'OPEN';`;
        const oldestOpenTicketQuery = `SELECT id, subject, created_at FROM support_tickets WHERE status = 'OPEN' ORDER BY created_at ASC LIMIT 1;`;
        const adminEmailsQuery = `SELECT email FROM admins WHERE role IN ('SUPER_ADMIN', 'SUPPORT_ADMIN') AND is_active = TRUE;`;
        
        const [
            newTicketsResult,
            closedTicketsResult,
            openTicketsResult,
            oldestTicketResult,
            adminEmailsResult
        ] = await Promise.all([
            client.query(newTicketsQuery, [oneWeekAgo]),
            client.query(closedTicketsQuery, [oneWeekAgo]),
            client.query(openTicketsQuery),
            client.query(oldestTicketQuery),
            client.query(adminEmailsQuery)
        ]);

        const newTicketsCount = newTicketsResult.rows[0].count;
        const closedTicketsCount = closedTicketsResult.rows[0].count;
        const totalOpenCount = openTicketsResult.rows[0].count;
        const oldestTicket = oldestTicketResult.rows[0];
        const adminEmails = adminEmailsResult.rows.map(admin => admin.email);

        if (adminEmails.length === 0) {
            console.log('No active admins found to send summary to. Exiting.');
            return;
        }
        
        const today = new Date();
        const weekStartDate = new Date(oneWeekAgo).toLocaleDateString('en-US');
        const weekEndDate = today.toLocaleDateString('en-US');

        console.log(`Generating summary for ${adminEmails.length} admin(s)...`);

        await resend.emails.send({
            from: `Higgs Workspace Reports <${process.env.INVITE_EMAIL_FROM}>`,
            to: adminEmails,
            subject: `Weekly Support Ticket Summary: ${weekStartDate} - ${weekEndDate}`,
            html: `
                <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px;">
                    <h1 style="text-align: center; color: #333;">Weekly Support Summary</h1>
                    <p style="text-align: center; color: #555;">${weekStartDate} - ${weekEndDate}</p>
                    <div style="display: flex; justify-content: space-around; text-align: center; margin: 30px 0;">
                        <div><h2 style="font-size: 2.5em; margin: 0;">${newTicketsCount}</h2><p style="margin: 0; color: #777;">New Tickets</p></div>
                        <div><h2 style="font-size: 2.5em; margin: 0;">${closedTicketsCount}</h2><p style="margin: 0; color: #777;">Tickets Closed</p></div>
                        <div><h2 style="font-size: 2.5em; margin: 0;">${totalOpenCount}</h2><p style="margin: 0; color: #777;">Currently Open</p></div>
                    </div>
                    <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
                    <h3 style="color: #333;">Attention Needed</h3>
                    ${oldestTicket ? `
                        <div style="background-color: #f9f9f9; padding: 15px; border-radius: 4px;">
                            <p style="margin: 0; font-weight: bold;">Oldest Open Ticket:</p>
                            <p style="margin: 5px 0;">#${oldestTicket.id}: ${oldestTicket.subject}</p>
                            <p style="margin: 0; font-size: 0.9em; color: #777;">Opened on: ${new Date(oldestTicket.created_at).toLocaleString('en-US')}</p>
                        </div>
                    ` : `
                        <p style="color: #22c55e; font-weight: bold;">Great job! There are no open tickets.</p>
                    `}
                    <p style="text-align: center; margin-top: 30px;">
                        <a href="${process.env.ADMIN_PANEL_URL}/tickets" style="background-color: #1976D2; color: white; padding: 12px 20px; text-decoration: none; border-radius: 4px;">View All Tickets</a>
                    </p>
                </div>
            `
        });
        
        console.log('Weekly summary sent successfully.');
    } catch (err) {
        console.error('Failed to send weekly summary:', err);
    } finally {
        client.release();
    }
}

sendWeeklySummary().then(() => {
    console.log('Script finished.');
    pool.end();
});