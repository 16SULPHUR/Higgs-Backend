// import { authenticate } from './auth';
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
        const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;

        
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
        
        
        req.user = decoded as UserPayload;
        next();

    } catch (err) {
        return res.status(401).json({ message: 'Authentication failed: Invalid token.' });
    }
};

export const authorize = (roles: string[]) => {
    return (req: Request, res: Response, next: NextFunction) => {
        const user = (req as any).user;
        console.log(user)
    if (!user || !roles.includes(user.role)) {
      return res.status(403).json({ message: 'Forbidden' });
    }
    next();
  };
};