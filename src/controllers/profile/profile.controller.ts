import { Request, Response } from 'express';
import pool from '../../lib/db.js';
import uploadImage from '../../services/uploadImage.js';

export const getProfile = async (req: Request, res: Response) => {
    console.log(req.body)
    try {
        const result = await pool.query(`
            SELECT name, email, phone, profession, new_email, email_change_otp_expires, email_change_requested_at
            FROM users WHERE id = $1
        `, [req.user.id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'user not found' });
        }

        const userData = result.rows[0];
        
        // Add email change status
        const hasPendingEmailChange = userData.new_email && userData.email_change_otp_expires;
        const isEmailChangeExpired = hasPendingEmailChange && new Date() > new Date(userData.email_change_otp_expires);
        
        const profileData = {
            name: userData.name,
            email: userData.email,
            phone: userData.phone,
            profession: userData.profession,
            emailChangeStatus: hasPendingEmailChange ? {
                newEmail: userData.new_email,
                expiresAt: userData.email_change_otp_expires,
                isExpired: isEmailChangeExpired,
                requestedAt: userData.email_change_requested_at
            } : null
        };

        console.log(profileData);
        res.json(profileData);
    }
    catch (err) {
        console.error(`Error fetching user data`, err);
        res.status(500).json({ message: 'Failed to fetch user data' });
    }
}

export const updateUserProfile = async (req: Request, res: Response) => {
    const user = (req as any).user;
    const { name, phone, profession } = req.body;
    const file = req.file;

    console.log(name, phone, file);

    const client = await pool.connect();

    try {
        const fields = [];
        const values = [];
        let i = 1;

        if (name) {
            fields.push(`name = $${i++}`);
            values.push(name);
        }
        if (phone) {
            fields.push(`phone = $${i++}`);
            values.push(phone);
        }
        if (profession !== undefined) {
            fields.push(`profession = $${i++}`);
            values.push(profession);
        }

        if (file) {
            const imageUrl = await uploadImage(file);
            fields.push(`profile_picture = $${i++}`);
            values.push(imageUrl);
        }

        if (fields.length === 0) {
            return res.status(400).json({ message: 'No fields to update were provided.' });
        }

        values.push(user.id);
        const query = `UPDATE users SET ${fields.join(', ')} WHERE id = $${i} RETURNING id, name, email, phone, profession, profile_picture`;

        const { rows, rowCount } = await client.query(query, values);

        if (rowCount === 0) {
            return res.status(404).json({ message: 'User not found.' });
        }

        res.status(200).json(rows[0]);

    } catch (err) {
        console.error('Update profile error:', err);
        res.status(500).json({ message: 'Failed to update profile.' });
    } finally {
        client.release();
    }
};
