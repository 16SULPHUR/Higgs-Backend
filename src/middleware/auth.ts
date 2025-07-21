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
            user?: any;
        }
    }
}

export const authenticate = async (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'Authentication required: No token provided.' });
    }

    const token = authHeader.split(' ')[1];

    console.log("token===================================")
    console.log(token)

    if (!token) {
        return res.status(401).json({ message: 'Authentication required: Access token missing.' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET!) as UserPayload;

        if (decoded.type !== 'user') {
            return res.status(403).json({ message: 'Forbidden: Invalid token type for this route.' });
        }

        const userStatusResult = await pool.query('SELECT role, organization_id, is_active FROM users WHERE id = $1', [decoded.id]);

        if (userStatusResult.rowCount === 0) {
            return res.status(401).json({ message: 'Authentication failed: User not found.' });
        }

        const userDbInfo = userStatusResult.rows[0];

        if (!userDbInfo.is_active) {
            return res.status(403).json({ message: 'Forbidden: Your account is inactive.' });
        }

        req.user = {
            id: decoded.id,
            role: userDbInfo.role,
            organization_id: userDbInfo.organization_id
        };

        next();

    } catch (err) {
        return res.status(401).json({ message: 'Authentication failed: Invalid or expired access token.' });
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