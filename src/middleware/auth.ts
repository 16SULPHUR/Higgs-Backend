import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import pool from '../lib/db.js';

interface UserPayload {
    id: string;
    email: string;
    role: string;
    organization_id: string | null;
    type: 'user';
    jti: string;
}

declare global {
    namespace Express {
        interface Request {
            user?: UserPayload;
        }
    }
}

export const authenticate = async (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'Authentication required: No token provided.' });
    }

    const token = authHeader.split(' ')[1];
    
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET!) as UserPayload;

        if (decoded.type !== 'user' || !decoded.jti) {
            return res.status(403).json({ message: 'Forbidden: Invalid token type.' });
        }

        const sessionResult = await pool.query(
            'SELECT id FROM active_sessions WHERE jti = $1 AND subject_id = $2 AND subject_type = \'USER\' AND expires_at > NOW()',
            [decoded.jti, decoded.id]
        );

        if (sessionResult.rowCount === 0) {
            return res.status(401).json({ message: 'Authentication failed: Session is invalid or has been revoked.' });
        }
        
        // --- NEW CHECK ---
        // After verifying the session, check the user's active status in the database.
        const userStatusResult = await pool.query('SELECT is_active FROM users WHERE id = $1', [decoded.id]);
        if (userStatusResult.rowCount === 0 || !userStatusResult.rows[0].is_active) {
            return res.status(403).json({ message: 'Forbidden: Your account is inactive.' });
        }
        // -----------------
        
        req.user = decoded;
        next();

    } catch (err) {
        return res.status(401).json({ message: 'Authentication failed: Invalid token.' });
    }
};

export const authorize = (roles: string[]) => {
    return (req: Request, res: Response, next: NextFunction) => {
        if (!req.user || !roles.includes(req.user.role)) {
            return res.status(403).json({ message: 'Forbidden: You do not have the required permissions.' });
        }
        next();
  };
};