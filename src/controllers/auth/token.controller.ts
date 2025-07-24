import { Request, Response } from 'express';
import pool from '../../lib/db.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { generateAccessToken } from '../../services/token.service.js';

export const refreshTokenController = async (req: Request, res: Response) => {
    const { refreshToken: incomingRefreshToken, expiredAccessToken } = req.body;

    console.log("refreshTokenController called with body:", req.body);

    if (!incomingRefreshToken || !expiredAccessToken) {
        return res.status(401).json({ message: 'Tokens are required.' });
    }

    let decodedExpiredToken;
    try {
        decodedExpiredToken = jwt.verify(expiredAccessToken, process.env.JWT_SECRET!, { ignoreExpiration: true }) as any;
    } catch (e) {
        return res.status(401).json({ message: 'Invalid access token format.' });
    }

    console.log("decodedExpiredToken")
    console.log(decodedExpiredToken)
    const subjectId = decodedExpiredToken.id;
    if (!subjectId) {
        return res.status(401).json({ message: 'Invalid token payload.' });
    }

    const client = await pool.connect();
    try {
        const { rows } = await client.query(
            'SELECT * FROM refresh_tokens WHERE subject_id = $1 AND is_revoked = FALSE AND expires_at > NOW()',
            [subjectId]
        );

        if (rows.length === 0) {
            return res.status(403).json({ message: 'No valid refresh tokens found for this user.' });
        }

        let foundToken = null;
        for (const token of rows) {
            if (await bcrypt.compare(incomingRefreshToken, token.token_hash)) {
                foundToken = token;
                break;
            }
        }

        if (!foundToken) {
            return res.status(403).json({ message: 'Invalid refresh token. Please log in again.' });
        }
        
        // --- THIS IS THE ONLY ADDED LOGIC BLOCK ---
        let userStatusQuery;
        if (foundToken.subject_type === 'USER') {
            userStatusQuery = client.query('SELECT id, is_active, role, organization_id FROM users WHERE id = $1', [foundToken.subject_id]);
        } else if (foundToken.subject_type === 'ADMIN') {
            userStatusQuery = client.query('SELECT id, is_active, role, location_id FROM admins WHERE id = $1', [foundToken.subject_id]);
        } else {
            return res.status(403).json({ message: 'Invalid subject type in token.' });
        }
        
        const statusResult = await userStatusQuery;
        if (statusResult.rowCount === 0 || !statusResult.rows[0].is_active) {
            // If the account is inactive, revoke all their refresh tokens for security
            await client.query('UPDATE refresh_tokens SET is_revoked = TRUE WHERE subject_id = $1', [subjectId]);
            return res.status(403).json({ message: 'Your account is inactive. Please contact support.' });
        }
        const freshUserDetails = statusResult.rows[0];
        // ------------------------------------------

        const newAccessToken = generateAccessToken(freshUserDetails, foundToken.subject_type as any);

        res.status(200).json({
            accessToken: newAccessToken,
        });

    } catch (err) {
        console.error("Refresh token error:", err);
        res.status(500).json({ message: 'Failed to refresh token.' });
    } finally {
        client.release();
    }
};

export const logoutController = async (req: Request, res: Response) => {
    // This function remains unchanged as per your request
    const { refreshToken } = req.body;
    if (refreshToken) {
        const { rows } = await pool.query('SELECT * FROM refresh_tokens WHERE is_revoked = FALSE');
        for (const token of rows) {
            if (await bcrypt.compare(refreshToken, token.token_hash)) {
                await pool.query('UPDATE refresh_tokens SET is_revoked = TRUE WHERE id = $1', [token.id]);
                break;
            }
        }
    }
    res.status(200).json({ message: 'Logged out successfully.' });
};