import bcrypt from 'bcryptjs';
import pool from '../../lib/db.js';
import { resend } from '../../lib/resend.js';
// import jwt from 'jsonwebtoken';
// import { v4 as uuidv4 } from 'uuid';
import { Request, Response } from 'express';
// import { randomUUID } from 'crypto';
import { generateTokens } from '../../services/token.service.js';

export const register = async (req: Request, res: Response) => {

    const { name, email, password, phone, location_id } = req.body;


    if (!name || !email || !password || !phone || !location_id) {
        return res.status(400).json({
            message: 'All fields are required: name, email, password, phone, and location_id.'
        });
    }

    try {
        const existingUser = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        if (existingUser.rows.length) {
            return res.status(400).json({ message: 'Email already exists' });
        }

        const locationCheck = await pool.query('SELECT id FROM locations WHERE id = $1', [location_id]);
        if (locationCheck.rowCount === 0) {
            return res.status(400).json({ message: 'Invalid location_id provided. Location does not exist.' });
        }

        const hashed = await bcrypt.hash(password, parseInt(process.env.SALT!));
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000);

        await pool.query(`
            INSERT INTO users (name, email, password, phone, otp, otp_expires_at, role, location_id, is_active, individual_credits)
            VALUES ($1, $2, $3, $4, $5, $6, 'INDIVIDUAL_USER', $7, TRUE, 0)
        `, [name, email, hashed, phone, otp, otpExpiresAt, location_id]);

        await resend.emails.send({
            from: `Higgs <${process.env.EMAIL_FROM}>`,
            to: email,
            subject: 'Verify your email',
            html: `<p>Your OTP is <strong>${otp}</strong>. It expires in 10 minutes.</p>`
        });

        res.status(201).json({ message: 'Registered successfully. Please check your email for the OTP.' });
    } catch (err) {
        console.error('Registration error:', err);
        res.status(500).json({ message: 'Server error during registration' });
    }
};

// export const login = async (req: Request, res: Response) => {
//     const { email, password } = req.body;
//     console.log(req.body)
//     const dbClient = await pool.connect();

//     try {
//         await dbClient.query('BEGIN');

//         const { rows } = await dbClient.query('SELECT * FROM users WHERE email = $1', [email]);
//         const user = rows[0];
//         if (!user) return res.status(404).json({ message: 'User not found' });
//         if (!user.is_verified) return res.status(403).json({ message: 'Email not verified.' });
//         if (!user.password) return res.status(401).json({ message: 'Please log in with your Google account.' });

//         const match = await bcrypt.compare(password, user.password);
//         if (!match) return res.status(401).json({ message: 'Invalid credentials' });


//         const jti = uuidv4();
//         const tokenExpiresIn = '1d';
//         const expirationDate = new Date(Date.now() + 24 * 60 * 60 * 1000);

//         const tokenPayload = {
//             id: user.id,
//             name: user.name,
//             role: user.role,
//             organization_id: user.organization_id,
//             type: 'user',
//             jti: jti
//         };

//         // const payload = {
//         //     adminId: admin.id,
//         //     role: admin.role,
//         //     locationId: admin.location_id,
//         //     type: 'admin',
//         //     jti: jti
//         // };
//         // const token = jwt.sign(payload, process.env.JWT_SECRET!, { expiresIn: tokenExpiresIn });

//         const token = jwt.sign(tokenPayload, process.env.JWT_SECRET!, { expiresIn: tokenExpiresIn });


//         await dbClient.query(
//             `INSERT INTO active_sessions (jti, subject_id, subject_type, expires_at)
//              VALUES ($1, $2, 'USER', $3)`,
//             [jti, user.id, expirationDate]
//         );

//         const userResponse = {
//             id: user.id, name: user.name, email: user.email, phone: user.phone,
//             role: user.role, profile_picture: user.profile_picture, organization_id: user.organization_id
//         };

//         await dbClient.query('COMMIT');
//         res.json({ token, user: userResponse });
//     } catch (err) {
//         await dbClient.query('ROLLBACK');
//         console.error('Login error:', err);
//         res.status(500).json({ message: 'Server error' });
//     } finally {
//         dbClient.release();
//     }
// };

export const login = async (req: Request, res: Response) => {
    const { email, password } = req.body;
    try {
        const { rows } = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        const user = rows[0];

        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.status(401).json({ message: 'Invalid credentials or user not found.' });
        }
        if (!user.is_verified) {
            return res.status(403).json({ message: 'Email not verified.' });
        }
        // No admin approval gating; user can log in once email is verified

        const { accessToken, refreshToken } = await generateTokens(user, 'USER');

        const userResponse = {
            id: user.id,
            name: user.name,
            role: user.role,
            organization_id: user.organization_id,
            profile_picture: user.profile_picture,
        };

        res.status(200).json({ accessToken, refreshToken, user: userResponse });
    } catch (err) {
        console.error("Login error:", err);
        res.status(500).json({ message: 'Server error during login.' });
    }
};




export const verifyOtp = async (req: Request, res: Response) => {
    const { email, otp } = req.body;
    try {
        const { rows } = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        const user = rows[0];
        console.log(otp)
        console.log(user.otp)
        console.log(new Date())
        console.log(user.otp_expires_at)

        if (!user) return res.status(404).json({ message: 'User not found' });
        if (user.is_verified) return res.json({ message: 'Already verified' });
        if (String(user.otp) !== String(otp) || new Date() > new Date(user.otp_expires_at))
            return res.status(400).json({ message: 'Invalid or expired OTP' });
        await pool.query(`
        UPDATE users SET is_verified = true, otp = NULL, otp_expires_at = NULL
        WHERE email = $1
      `, [email]);
        res.json({ message: 'Email verified successfully' });
    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
};

export const getMe = async (req: Request, res: Response) => {
    const user = (req as any).user;
    console.log("user")
    console.log(user)

    try {
        const query = `
            SELECT 
                u.id, 
                u.name, 
                u.email, 
                u.role,
                u.phone,
                u.profile_picture,
                u.individual_credits,
                o.id as organization_id,
                o.name as organization_name,
                o.credits_pool as organization_credits_pool
            FROM users u
            LEFT JOIN organizations o ON u.organization_id = o.id
            WHERE u.id = $1;
        `;
        const { rows } = await pool.query(query, [user.id]);

        if (rows.length === 0) {
            return res.status(404).json({ message: 'User not found.' });
        }

        res.json(rows[0]);

    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
};