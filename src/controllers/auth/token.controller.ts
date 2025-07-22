import { Request, Response } from 'express';
import pool from '../../lib/db.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { generateAccessToken } from '../../services/token.service.js';

export const refreshTokenController = async (req: Request, res: Response) => {
    console.log('refreshTokenController');
    const { refreshToken: incomingRefreshToken, expiredAccessToken } = req.body;

    if (!incomingRefreshToken || !expiredAccessToken) {
        return res.status(401).json({ message: 'Tokens are required.' });
    }

    console.log(req.body)
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

    try {
        const { rows } = await pool.query(
            'SELECT * FROM refresh_tokens WHERE subject_id = $1 AND is_revoked = FALSE AND expires_at > NOW()',
            [subjectId]
        );

        console.log("refreshTokenController: Found refresh tokens for subject ID:", rows);

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

        console.log(foundToken)

        if (!foundToken) {
            return res.status(403).json({ message: 'Invalid refresh token. Please log in again.' });
        }

        // --- LOGIC CHANGE ---
        // We no longer revoke any tokens. We just generate a new access token.
        const newAccessToken = generateAccessToken(foundToken.subject_id, foundToken.subject_type as any);


        console.log("refresh tokenController: New access token generated for subject ID:", foundToken.subject_id);
        // Return only the new access token. The refresh token remains the same.
        res.status(200).json({
            accessToken: newAccessToken,
        });

    } catch (err) {
        console.error("Refresh token error:", err);
        res.status(500).json({ message: 'Failed to refresh token.' });
    }
};

export const logoutController = async (req: Request, res: Response) => {
    const { refreshToken } = req.body;
    if (refreshToken) {
        const { rows } = await pool.query('SELECT * FROM refresh_tokens WHERE is_revoked = FALSE');
        for (const token of rows) {
            if (await bcrypt.compare(refreshToken, token.token_hash)) {
                // For a simpler system, on logout we just revoke the specific token used.
                await pool.query('UPDATE refresh_tokens SET is_revoked = TRUE WHERE id = $1', [token.id]);
                break;
            }
        }
    }
    res.status(200).json({ message: 'Logged out successfully.' });
};