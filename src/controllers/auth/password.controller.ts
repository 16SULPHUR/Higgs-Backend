import { Request, Response } from 'express';
import pool from '../../lib/db.js';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto'; 
import { zeptoClient } from '../../lib/zeptiMail.js';

export const forgotPassword = async (req: Request, res: Response) => {
    const { email } = req.body;
    if (!email) {
        return res.status(400).json({ message: 'Email address is required.' });
    }

    try {
        const userResult = await pool.query('SELECT id, name FROM users WHERE email = $1', [email]);
        if (userResult.rowCount === 0) {
            return res.status(404).json({ message: 'No account with that email address exists.' });
        }
        const user = userResult.rows[0];

        const resetToken = randomBytes(6).toString('hex').toUpperCase();
        const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

        await pool.query(
            'UPDATE users SET reset_password_token = $1, reset_password_expires_at = $2 WHERE email = $3',
            [resetToken, expiresAt, email]
        );

        await zeptoClient.sendMail({
            from: {
                address: process.env.EMAIL_FROM as string,
                name: "Higgs Workspace Security",
            },
            to: [
                {
                    email_address: {
                        address: email,
                        name: user.name, 
                    },
                },
            ],
            subject: "Your Password Reset Code for Higgs Workspace",
            htmlbody: `
    <div style="font-family: sans-serif; padding: 20px;">
      <h2>Hi ${user.name},</h2>
      <p>You requested a password reset. Please use the following code to set a new password. This code is valid for 15 minutes.</p>
      <h3 style="text-align: center; letter-spacing: 3px; background-color: #f2f2f2; padding: 10px;">${resetToken}</h3>
      <p>If you did not request this, please ignore this email.</p>
    </div>
  `,
        });

        res.status(200).json({ message: 'A password reset code has been sent to your email address.' });

    } catch (err) {
        console.error('Forgot password error:', err);
        res.status(500).json({ message: 'Error processing forgot password request.' });
    }
};

export const resetPassword = async (req: Request, res: Response) => {
    const { email, token, newPassword } = req.body;

    if (!email || !token || !newPassword) {
        return res.status(400).json({ message: 'Email, token, and new password are required.' });
    }
    if (newPassword.length < 6) {
        return res.status(400).json({ message: 'Password must be at least 6 characters long.' });
    }

    try {
        const userResult = await pool.query(
            'SELECT * FROM users WHERE email = $1 AND reset_password_token = $2 AND reset_password_expires_at > NOW()',
            [email, token.toUpperCase()]
        );

        if (userResult.rowCount === 0) {
            return res.status(400).json({ message: 'Password reset token is invalid or has expired.' });
        }

        const hashedPassword = await bcrypt.hash(newPassword, parseInt(process.env.SALT!));

        await pool.query(
            'UPDATE users SET password = $1, reset_password_token = NULL, reset_password_expires_at = NULL WHERE email = $2',
            [hashedPassword, email]
        );

        res.status(200).json({ message: 'Password has been reset successfully. You can now log in.' });

    } catch (err) {
        console.error('Reset password error:', err);
        res.status(500).json({ message: 'Error resetting password.' });
    }
};