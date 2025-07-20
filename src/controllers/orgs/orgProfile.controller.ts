import { Request, Response } from 'express';
import pool from '../../lib/db.js';
import uploadImage from '../../services/uploadImage.js';
import { resend } from '../../lib/resend.js';

export const updateOwnOrgProfile = async (req: Request, res: Response) => {
    const user = (req as any).user;
    const orgId = user.organization_id;

    console.log(req.body)

    if (!orgId) {
        return res.status(403).json({ message: 'Forbidden: User is not associated with an organization.' });
    }

    const { name, email } = req.body;
    const file = req.file;

    const fields = [];
    const values = [];
    let i = 1;

    if (name) { fields.push(`name = $${i++}`); values.push(name); }
    if (email) { fields.push(`email = $${i++}`); values.push(email); }
    
    try {
        if (file) {
            const imageUrl = await uploadImage(file);
            fields.push(`logo_image_url = $${i++}`);
            values.push(imageUrl);
        }

        if (fields.length === 0) {
            return res.status(400).json({ message: 'No fields to update were provided.' });
        }

        values.push(orgId);
        const query = `UPDATE organizations SET ${fields.join(', ')} WHERE id = $${i} RETURNING *`;

        const { rows, rowCount } = await pool.query(query, values);

        if (rowCount === 0) {
            return res.status(404).json({ message: 'Organization not found.' });
        }

        // --- NOTIFICATION LOGIC ---
        await resend.emails.send({
            from: `Higgs Workspace <${process.env.INVITE_EMAIL_FROM}>`,
            to: process.env.SUPER_ADMIN_EMAIL_ADDRESS!,
            subject: `Organization Profile Updated: ${rows[0].name}`,
            html: `
                <div style="font-family: sans-serif; padding: 20px;">
                    <h2>Organization Profile Change Notification</h2>
                    <p>
                        The organization <strong>${rows[0].name}</strong> (ID: ${orgId}) was just updated 
                        by their Organization Admin, <strong>${user.name}</strong>.
                    </p>
                    <p>Review the changes in the admin panel if necessary.</p>
                </div>
            `
        });
        
        res.status(200).json(rows[0]);

    } catch (err) {
        console.error('Update own org profile error:', err);
        res.status(500).json({ message: 'Failed to update organization profile.' });
    }
};

export const getOwnOrgProfile = async (req: Request, res: Response) => {
    const user = (req as any).user;
    const orgId = user.organization_id;

    if (!orgId) {
        return res.status(403).json({ message: 'Forbidden: User is not associated with an organization.' });
    }
    
    try {
        const { rows } = await pool.query('SELECT * FROM organizations WHERE id = $1', [orgId]);
        if (rows.length === 0) return res.status(404).json({ message: 'Organization not found.' });
        res.json(rows[0]);
    } catch (err) {
        res.status(500).json({ message: 'Failed to fetch organization profile.' });
    }
}