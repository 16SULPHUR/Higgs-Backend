import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import pool from '../lib/db.js';

interface AdminPayload {
    adminId: string;
    role: string;
    locationId: string | null;
    type: 'admin';
}

declare global {
    namespace Express {
        interface Request {
            admin?: AdminPayload;
        }
    }
}

export const authorizeAdmin = (allowedRoles: string[]) => {
    return async (req: Request, res: Response, next: NextFunction) => {

        
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ message: 'Authentication required: No token provided.' });
        }
        
        const token = authHeader.split(' ')[1];
        
        
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;

            if (decoded.type !== 'admin' || !decoded.jti) {
                return res.status(403).json({ message: 'Forbidden: Invalid token type or missing JTI.' });
            }

            const sessionResult = await pool.query(
                'SELECT id FROM active_sessions WHERE jti = $1 AND subject_id = $2 AND expires_at > NOW()',
                [decoded.jti, decoded.adminId]
            );

            if (sessionResult.rowCount === 0) {
                return res.status(401).json({ message: 'Authentication failed: Session is invalid or has been revoked.' });
            }

            if (!allowedRoles.includes(decoded.role)) {
                return res.status(403).json({ message: 'Forbidden: You do not have permission.' });
            }
            
            req.admin = decoded as AdminPayload;
            next();

        } catch (err) {
            return res.status(401).json({ message: 'Authentication failed: Invalid token signature.' });
        }
    };
};
