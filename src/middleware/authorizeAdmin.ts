import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import pool from '../lib/db.js';

interface AdminPayload {
    id: string;
    adminId: string;
    role: string;
    locationId: string | null;
    type: 'admin';
    jti: string;
}

declare global {
    namespace Express {
        interface Request {
            admin?: AdminPayload;
        }
    }
}

export const authorizeAdmin = async (req: Request, res: Response, next: NextFunction) => {
    const token = req.cookies.accessToken;

    if (!token) {
        return res.status(401).json({ message: 'Authentication required: Access token missing.' });
    }
    
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET!) as AdminPayload;

        if (decoded.type !== 'admin') {
            return res.status(403).json({ message: 'Forbidden: Invalid token type for this route.' });
        }
        
        const adminStatusResult = await pool.query('SELECT role, location_id, is_active FROM admins WHERE id = $1', [decoded.id]);
        
        if (adminStatusResult.rowCount === 0) {
            return res.status(401).json({ message: 'Authentication failed: Admin not found.' });
        }
        
        const adminDbInfo = adminStatusResult.rows[0];
        
        if (!adminDbInfo.is_active) {
            return res.status(403).json({ message: 'Forbidden: Your admin account is inactive.' });
        }
        
        req.admin = {
            adminId: decoded.id,
            role: adminDbInfo.role,
            locationId: adminDbInfo.location_id
        };
        
        next();

    } catch (err) {
        return res.status(401).json({ message: 'Authentication failed: Invalid or expired access token.' });
    }
};