import { Request, Response } from 'express';
import pool from '../../lib/db.js';
import bcrypt from 'bcryptjs';
import { generateTokens } from '../../services/token.service.js';

export const refreshTokenController = async (req: Request, res: Response) => {
    const { refreshToken: incomingRefreshToken } = req.body;
    
    if (!incomingRefreshToken) {
        return res.status(401).json({ message: 'Refresh token is required.' });
    }
    
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const { rows } = await client.query('SELECT * FROM refresh_tokens WHERE is_revoked = FALSE AND expires_at > NOW()');
        
        let foundToken = null;
        for (const token of rows) {
            if (await bcrypt.compare(incomingRefreshToken, token.token_hash)) {
                foundToken = token;
                break;
            }
        }

        if (!foundToken) {
            await client.query('ROLLBACK');
            return res.status(403).json({ message: 'Invalid, expired, or revoked refresh token.' });
        }
        
        await client.query('UPDATE refresh_tokens SET is_revoked = TRUE WHERE family_id = $1', [foundToken.family_id]);
        
        const newTokens = await generateTokens(foundToken.subject_id, foundToken.subject_type as any, client);
        
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
            if (await bcrypt.compare(refreshToken, token.token_hash)) {
                await pool.query('UPDATE refresh_tokens SET is_revoked = TRUE WHERE family_id = $1', [token.family_id]);
                break;
            }
        }
    }

    res.status(200).json({ message: 'Logged out successfully.' });
};