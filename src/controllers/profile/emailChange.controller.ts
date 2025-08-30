import { Request, Response } from 'express';
import pool from '../../lib/db.js';
import bcrypt from 'bcryptjs';
import { zeptoClient } from '../../lib/zeptiMail.js';
import { validateEmailChangeRequest, validateEmailChangeVerification } from '../../validations/emailChangeValidator.js';

// Generate 6-digit OTP
const generateOTP = (): string => {
    return Math.floor(100000 + Math.random() * 900000).toString();
};

// Request email change
export const requestEmailChange = async (req: Request, res: Response) => {
    const user = (req as any).user;
    const { newEmail, currentPassword } = req.body;

    // Validate input
    const validationErrors = validateEmailChangeRequest({ newEmail, currentPassword });
    if (validationErrors.length > 0) {
        return res.status(400).json({
            message: 'Validation failed',
            errors: validationErrors
        });
    }

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // Get current user data
        const userResult = await client.query(
            'SELECT id, email, password FROM users WHERE id = $1',
            [user.id]
        );

        if (userResult.rowCount === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: 'User not found.' });
        }

        const currentUser = userResult.rows[0];

        // Verify current password
        const isPasswordValid = await bcrypt.compare(currentPassword, currentUser.password);
        if (!isPasswordValid) {
            await client.query('ROLLBACK');
            return res.status(401).json({ message: 'Current password is incorrect.' });
        }

        // Check if new email is same as current
        if (newEmail.toLowerCase() === currentUser.email.toLowerCase()) {
            await client.query('ROLLBACK');
            return res.status(400).json({ message: 'New email must be different from current email.' });
        }

        // Check if new email is already in use
        const existingUserResult = await client.query(
            'SELECT id FROM users WHERE email = $1 AND id != $2',
            [newEmail.toLowerCase(), user.id]
        );

        if (existingUserResult.rowCount > 0) {
            await client.query('ROLLBACK');
            return res.status(409).json({ message: 'This email address is already in use.' });
        }

        // Check rate limiting (max 3 attempts per hour)
        const rateLimitResult = await client.query(
            'SELECT email_change_attempts, email_change_requested_at FROM users WHERE id = $1',
            [user.id]
        );

        const lastAttempt = rateLimitResult.rows[0].email_change_requested_at;
        const attempts = rateLimitResult.rows[0].email_change_attempts || 0;

        if (lastAttempt && attempts >= 3) {
            const timeDiff = Date.now() - new Date(lastAttempt).getTime();
            const oneHour = 60 * 60 * 1000;
            
            if (timeDiff < oneHour) {
                await client.query('ROLLBACK');
                return res.status(429).json({ 
                    message: 'Too many email change attempts. Please wait 1 hour before trying again.' 
                });
            } else {
                // Reset attempts after 1 hour
                await client.query(
                    'UPDATE users SET email_change_attempts = 0 WHERE id = $1',
                    [user.id]
                );
            }
        }

        // Generate OTP and set expiration (10 minutes)
        const otp = generateOTP();
        const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

        // Update user with new email change request
        await client.query(`
            UPDATE users 
            SET new_email = $1, 
                email_change_otp = $2, 
                email_change_otp_expires = $3, 
                email_change_requested_at = NOW(),
                email_change_attempts = email_change_attempts + 1
            WHERE id = $4
        `, [newEmail.toLowerCase(), otp, otpExpires, user.id]);

        // Send OTP email to new address
        await zeptoClient.sendMail({
            from: {
                address: process.env.EMAIL_FROM as string,
                name: "Higgs Workspace",
            },
            to: [
                {
                    email_address: {
                        address: newEmail,
                        name: currentUser.name || 'User',
                    },
                },
            ],
            subject: "Verify Your New Email Address",
            htmlbody: `
                <div style="font-family: sans-serif; padding: 20px; color: #333;">
                    <h2>Email Change Verification</h2>
                    <p>You requested to change your email address to <strong>${newEmail}</strong>.</p>
                    <p>Your verification code is:</p>
                    <div style="border: 2px solid #007bff; padding: 20px; text-align: center; font-size: 24px; font-weight: bold; color: #007bff; margin: 20px 0;">
                        ${otp}
                    </div>
                    <p>This code expires in 10 minutes.</p>
                    <p>If you didn't request this change, please ignore this email and contact support immediately.</p>
                    <p>Best regards,<br>Higgs Workspace Team</p>
                </div>
            `,
        });

        await client.query('COMMIT');

        return res.status(200).json({
            message: 'Verification code sent to your new email address.',
            expiresAt: otpExpires
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Email change request error:', error);
        return res.status(500).json({
            message: 'Failed to process email change request.'
        });
    } finally {
        client.release();
    }
};

// Verify email change with OTP
export const verifyEmailChangeWithOTP = async (req: Request, res: Response) => {
    const user = (req as any).user;
    const { otp } = req.body;

    // Validate OTP
    const validationErrors = validateEmailChangeVerification({ otp });
    if (validationErrors.length > 0) {
        return res.status(400).json({
            message: 'Validation failed',
            errors: validationErrors
        });
    }

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // Get user's email change request
        const userResult = await client.query(`
            SELECT id, email, new_email, email_change_otp, email_change_otp_expires
            FROM users 
            WHERE id = $1
        `, [user.id]);

        if (userResult.rowCount === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: 'User not found.' });
        }

        const currentUser = userResult.rows[0];

        // Check if there's a pending email change
        if (!currentUser.new_email || !currentUser.email_change_otp) {
            await client.query('ROLLBACK');
            return res.status(400).json({ message: 'No pending email change request found.' });
        }

        // Check if OTP is expired
        if (new Date() > new Date(currentUser.email_change_otp_expires)) {
            await client.query('ROLLBACK');
            return res.status(400).json({ message: 'Verification code has expired. Please request a new one.' });
        }

        // Verify OTP
        if (currentUser.email_change_otp !== otp) {
            await client.query('ROLLBACK');
            return res.status(400).json({ message: 'Invalid verification code.' });
        }

        // Update email address
        await client.query(`
            UPDATE users 
            SET email = $1,
                new_email = NULL,
                email_change_otp = NULL,
                email_change_otp_expires = NULL,
                email_change_requested_at = NULL,
                email_change_attempts = 0
            WHERE id = $2
        `, [currentUser.new_email, user.id]);

        // Send confirmation email to old address
        await zeptoClient.sendMail({
            from: {
                address: process.env.EMAIL_FROM as string,
                name: "Higgs Workspace",
            },
            to: [
                {
                    email_address: {
                        address: currentUser.email,
                        name: currentUser.name || 'User',
                    },
                },
            ],
            subject: "Your Email Address Has Been Changed",
            htmlbody: `
                <div style="font-family: sans-serif; padding: 20px; color: #333;">
                    <h2>Email Address Changed</h2>
                    <p>Your email address has been successfully changed from <strong>${currentUser.email}</strong> to <strong>${currentUser.new_email}</strong>.</p>
                    <p>You can now log in using your new email address.</p>
                    <p>If you didn't make this change, please contact support immediately.</p>
                    <p>Best regards,<br>Higgs Workspace Team</p>
                </div>
            `,
        });

        await client.query('COMMIT');

        return res.status(200).json({
            message: 'Email address updated successfully.',
            newEmail: currentUser.new_email
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Email change verification error:', error);
        return res.status(500).json({
            message: 'Failed to verify email change.'
        });
    } finally {
        client.release();
    }
};

// Resend email change OTP
export const resendEmailChangeOTP = async (req: Request, res: Response) => {
    const user = (req as any).user;

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // Get user's pending email change request
        const userResult = await client.query(`
            SELECT id, name, email, new_email, email_change_otp_expires
            FROM users 
            WHERE id = $1 AND new_email IS NOT NULL
        `, [user.id]);

        if (userResult.rowCount === 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ message: 'No pending email change request found.' });
        }

        const currentUser = userResult.rows[0];

        // Check if OTP is expired
        if (new Date() <= new Date(currentUser.email_change_otp_expires)) {
            await client.query('ROLLBACK');
            return res.status(400).json({ message: 'Current verification code is still valid.' });
        }

        // Generate new OTP and set expiration
        const otp = generateOTP();
        const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

        // Update OTP
        await client.query(`
            UPDATE users 
            SET email_change_otp = $1, 
                email_change_otp_expires = $2
            WHERE id = $3
        `, [otp, otpExpires, user.id]);

        // Send new OTP email
        await zeptoClient.sendMail({
            from: {
                address: process.env.EMAIL_FROM as string,
                name: "Higgs Workspace",
            },
            to: [
                {
                    email_address: {
                        address: currentUser.new_email,
                        name: currentUser.name || 'User',
                    },
                },
            ],
            subject: "New Verification Code for Email Change",
            htmlbody: `
                <div style="font-family: sans-serif; padding: 20px; color: #333;">
                    <h2>New Verification Code</h2>
                    <p>You requested a new verification code for changing your email to <strong>${currentUser.new_email}</strong>.</p>
                    <p>Your new verification code is:</p>
                    <div style="border: 2px solid #007bff; padding: 20px; text-align: center; font-size: 24px; font-weight: bold; color: #007bff; margin: 20px 0;">
                        ${otp}
                    </div>
                    <p>This code expires in 10 minutes.</p>
                    <p>If you didn't request this code, please ignore this email.</p>
                    <p>Best regards,<br>Higgs Workspace Team</p>
                </div>
            `,
        });

        await client.query('COMMIT');

        return res.status(200).json({
            message: 'New verification code sent to your new email address.',
            expiresAt: otpExpires
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Resend OTP error:', error);
        return res.status(500).json({
            message: 'Failed to resend verification code.'
        });
    } finally {
        client.release();
    }
};

// Cancel email change request
export const cancelEmailChange = async (req: Request, res: Response) => {
    const user = (req as any).user;

    const client = await pool.connect();

    try {
        // Clear email change request
        const result = await client.query(`
            UPDATE users 
            SET new_email = NULL,
                email_change_otp = NULL,
                email_change_otp_expires = NULL,
                email_change_requested_at = NULL,
                email_change_attempts = 0
            WHERE id = $1 AND new_email IS NOT NULL
            RETURNING id
        `, [user.id]);

        if (result.rowCount === 0) {
            return res.status(400).json({ message: 'No pending email change request found.' });
        }

        return res.status(200).json({
            message: 'Email change request cancelled successfully.'
        });

    } catch (error) {
        console.error('Cancel email change error:', error);
        return res.status(500).json({
            message: 'Failed to cancel email change request.'
        });
    } finally {
        client.release();
    }
};
