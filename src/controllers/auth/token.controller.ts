import { Request, Response } from 'express';
import pool from '../../lib/db.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { generateTokens } from '../../services/token.service.js';

export const refreshTokenController = async (req: Request, res: Response) => {
    const { refreshToken: incomingRefreshToken, expiredAccessToken } = req.body;

    if (!incomingRefreshToken || !expiredAccessToken) {
        return res.status(401).json({ message: 'Tokens are required.' });
    }
    
    console.log(`[AUTH] Refresh token request received. Expired access token: ${expiredAccessToken}, Incoming refresh token: ${incomingRefreshToken}`);
    let decodedExpiredToken;
    try {
        decodedExpiredToken = jwt.verify(expiredAccessToken, process.env.JWT_SECRET!, { ignoreExpiration: true }) as any;
    } catch (e) {
        return res.status(401).json({ message: 'Invalid access token.' });
    }

    const subjectId = decodedExpiredToken.id;
    if (!subjectId) {
        return res.status(401).json({ message: 'Invalid token payload.' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const { rows } = await client.query(
            'SELECT * FROM refresh_tokens WHERE subject_id = $1 AND is_revoked = FALSE AND expires_at > NOW()', 
            [subjectId]
        );
        
        if (rows.length === 0) {
            console.log(`[AUTH] No active refresh tokens found for subject: ${subjectId}`);
            await client.query('ROLLBACK');
            return res.status(403).json({ message: 'No valid refresh tokens found.' });
        }

        let foundToken = null;
        for (const token of rows) {
            const isMatch = await bcrypt.compare(incomingRefreshToken, token.token_hash);
            if (isMatch) {
                foundToken = token;
                break;
            }
        }

        if (!foundToken) {
            console.log(`[AUTH] Presented refresh token does not match any valid tokens for subject: ${subjectId}. Revoking all tokens for this user as a security measure.`);
            await client.query('UPDATE refresh_tokens SET is_revoked = TRUE WHERE subject_id = $1', [subjectId]);
            await client.query('COMMIT');
            return res.status(403).json({ message: 'Invalid refresh token.' });
        }
        
        await client.query('UPDATE refresh_tokens SET is_revoked = TRUE WHERE family_id = $1', [foundToken.family_id]);
        
        const newTokens = await generateTokens(foundToken.subject_id, foundToken.subject_type as any, foundToken.family_id, client);
        
        await client.query('COMMIT');

        res.status(200).json({
            accessToken: newTokens.accessToken,
            refreshToken: newTokens.refreshToken
        });

    } catch(err) {
        await client.query('ROLLBACK');
        console.error("Refresh token error:", err);
        res.status(500).json({ message: 'Failed to refresh token.' });
    } finally {
        client.release();
    }
};

export const logoutController = async (req: Request, res: Response) => {
    const { refreshToken } = req.body;
    
    if (refreshToken) {
        const { rows } = await pool.query('SELECT * FROM refresh_tokens WHERE is_revoked = FALSE');
        for (const token of rows) {
            const isMatch = await bcrypt.compare(refreshToken, token.token_hash);
            if (isMatch) {
                console.log(`[AUTH] Logging out. Revoking token family: ${token.family_id}`);
                await pool.query('UPDATE refresh_tokens SET is_revoked = TRUE WHERE family_id = $1', [token.family_id]);
                break;
            }
        }
    }
    res.status(200).json({ message: 'Logged out successfully.' });
};