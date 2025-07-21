import { Request, Response } from 'express';
import { OAuth2Client } from 'google-auth-library';
// import jwt from 'jsonwebtoken';
import pool from '../../lib/db.js';
// import { randomUUID } from 'crypto';
import { generateTokens } from '../../services/token.service.js';
// import { v4 as uuidv4 } from 'uuid'; 

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

export const googleAuthController = async (req: Request, res: Response) => {
    const { credential } = req.body;
    const dbClient = await pool.connect();
    try {
        const ticket = await client.verifyIdToken({ idToken: credential, audience: process.env.GOOGLE_CLIENT_ID });
        const payload = ticket.getPayload();
        if (!payload || !payload.sub || !payload.email) {
            return res.status(401).json({ message: 'Invalid Google token.' });
        }
        
        await dbClient.query('BEGIN');
        let user;
        const userResult = await dbClient.query('SELECT * FROM users WHERE google_id = $1', [payload.sub]);
        if (userResult.rows.length > 0) {
            user = userResult.rows[0];
        } else {
            const emailResult = await dbClient.query('SELECT * FROM users WHERE email = $1', [payload.email]);
            if (emailResult.rows.length > 0) {
                const { rows } = await dbClient.query('UPDATE users SET google_id = $1 WHERE email = $2 RETURNING *', [payload.sub, payload.email]);
                user = rows[0];
            } else {
                const { rows } = await dbClient.query(`INSERT INTO users (name, email, google_id, role, is_verified) VALUES ($1, $2, $3, 'INDIVIDUAL_USER', true) RETURNING *`, [payload.name, payload.email, payload.sub]);
                user = rows[0];
            }
        }

        const { accessToken, refreshToken } = await generateTokens(user.id, 'USER', dbClient);

        await dbClient.query('COMMIT');
        
        const userResponse = { 
            id: user.id, 
            name: user.name, 
            role: user.role, 
            organization_id: user.organization_id 
        };
        
        res.status(200).json({
            accessToken,
            refreshToken,
            user: userResponse
        });
    } catch (err) {
        await dbClient.query('ROLLBACK');
        console.error("Google auth error:", err);
        res.status(500).json({ message: 'Google authentication failed.' });
    } finally {
        dbClient.release();
    }
};
