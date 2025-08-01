import { Request, Response } from 'express';
import pool from '../../lib/db.js';
import bcrypt from 'bcryptjs'; 
import { generateAccessToken } from '../../services/token.service.js';
 

export const refreshTokenController = async (req: Request, res: Response) => {
    let checkpoint = Date.now();
    console.log(`[0ms] --- Refresh Token Start ---`);

    const { refreshToken: incomingRefreshToken } = req.body;

    if (!incomingRefreshToken) {
        return res.status(401).json({ message: 'Refresh token is required.' });
    }

    const tokenParts = incomingRefreshToken.split(':');
    if (tokenParts.length !== 2) {
        return res.status(401).json({ message: 'Invalid refresh token format.' });
    }
    const [selector, verifier] = tokenParts;

    const client = await pool.connect();
    try {
        const { rows } = await client.query(
            'SELECT * FROM refresh_tokens WHERE selector = $1 AND is_revoked = FALSE',
            [selector]
        );
        console.log(`[${Date.now() - checkpoint}ms] Fetched token from DB`);
        checkpoint = Date.now();

        if (rows.length === 0) {
            return res.status(403).json({ message: 'Refresh token not found or revoked.' });
        }

        const foundToken = rows[0];

        const isMatch = await bcrypt.compare(verifier, foundToken.token_hash);
        console.log(`[${Date.now() - checkpoint}ms] Bcrypt comparison finished`);
        checkpoint = Date.now();

        if (!isMatch) {
            await client.query('UPDATE refresh_tokens SET is_revoked = TRUE WHERE family_id = $1', [foundToken.family_id]);
            return res.status(403).json({ message: 'Invalid refresh token. Please log in again.' });
        }
        
        if (new Date() > new Date(foundToken.expires_at)) {
            return res.status(403).json({ message: 'Refresh token has expired.' });
        }

        let userStatusQuery;
        if (foundToken.subject_type === 'USER') {
            userStatusQuery = client.query('SELECT id, is_active, role, organization_id FROM users WHERE id = $1', [foundToken.subject_id]);
        } else if (foundToken.subject_type === 'ADMIN') {
            userStatusQuery = client.query('SELECT id, is_active, role, location_id FROM admins WHERE id = $1', [foundToken.subject_id]);
        } else {
            return res.status(403).json({ message: 'Invalid subject type in token.' });
        }

        const statusResult = await userStatusQuery;
        console.log(`[${Date.now() - checkpoint}ms] Fetched user/admin details`);
        checkpoint = Date.now();
        
        if (statusResult.rowCount === 0 || !statusResult.rows[0].is_active) {
            await client.query('UPDATE refresh_tokens SET is_revoked = TRUE WHERE subject_id = $1', [foundToken.subject_id]);
            return res.status(403).json({ message: 'Your account is inactive. Please contact support.' });
        }
        const freshUserDetails = statusResult.rows[0];

        const newAccessToken = generateAccessToken(freshUserDetails, foundToken.subject_type as any);

        console.log("newAccessToken")
        console.log(newAccessToken)
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