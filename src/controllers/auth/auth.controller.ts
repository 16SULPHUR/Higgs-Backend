import { Request, Response } from 'express';
import { OAuth2Client } from 'google-auth-library';
import jwt from 'jsonwebtoken';
import pool from '../../lib/db.js';
import { v4 as uuidv4 } from 'uuid'; 

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

export const googleAuthController = async (req: Request, res: Response) => {
    const { credential } = req.body;
    
    const dbClient = await pool.connect(); 

    try {
        const ticket = await client.verifyIdToken({
            idToken: credential,
            audience: process.env.GOOGLE_CLIENT_ID,
        });

        const payload = ticket.getPayload();
        if (!payload || !payload.sub || !payload.email) {
            return res.status(401).json({ message: 'Invalid Google token payload.' });
        }
        
        await dbClient.query('BEGIN'); 

        let user;
        const userResult = await dbClient.query('SELECT * FROM users WHERE google_id = $1', [payload.sub]);

        if (userResult.rows.length > 0) {
            user = userResult.rows[0];
        } else {
            const emailResult = await dbClient.query('SELECT * FROM users WHERE email = $1', [payload.email]);
            if (emailResult.rows.length > 0) {
                const { rows } = await dbClient.query(
                    'UPDATE users SET google_id = $1 WHERE email = $2 RETURNING *',
                    [payload.sub, payload.email]
                );
                user = rows[0];
            } else {
                
                const { rows } = await dbClient.query(
                    `INSERT INTO users (name, email, google_id, profile_picture, role, is_verified)
                     VALUES ($1, $2, $3, $4, 'INDIVIDUAL_USER', true) RETURNING *`,
                    [payload.name, payload.email, payload.sub, payload.picture]
                );
                user = rows[0];
            }
        }
        
        
        const jti = uuidv4();
        const tokenExpiresIn = '1d';
        const expirationDate = new Date(Date.now() + 24 * 60 * 60 * 1000); 

        const tokenPayload = {
            id: user.id,
            email: user.email,
            role: user.role,
            organization_id: user.organization_id,
            type: 'user', 
            jti: jti 
        };
        const token = jwt.sign(tokenPayload, process.env.JWT_SECRET!, { expiresIn: tokenExpiresIn });

        await dbClient.query(
            `INSERT INTO active_sessions (jti, subject_id, subject_type, expires_at)
             VALUES ($1, $2, 'USER', $3)`,
            [jti, user.id, expirationDate]
        );

        const userResponse = {
            id: user.id, name: user.name, email: user.email, phone: user.phone,
            role: user.role, profile_picture: user.profile_picture, organization_id: user.organization_id
        };
        
        await dbClient.query('COMMIT'); 
        res.json({ token, user: userResponse });

    } catch (err) {
        await dbClient.query('ROLLBACK');
        console.error('Google login error:', err);
        res.status(500).json({ message: 'Authentication failed.' });
    } finally {
        dbClient.release(); 
    }
};