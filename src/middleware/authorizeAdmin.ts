import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

interface AdminPayload {
    id: string;
    role: string;
    location_id: string | null;
    is_active: boolean;
    type: 'admin';
}

declare global {
    namespace Express {
        interface Request {
            admin?: AdminPayload;
        }
    }
}

export const authorizeAdmin = async (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ message: 'Authentication required: No token provided.' });
        }
        
        const token = authHeader.split(' ')[1];
        
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET!) as AdminPayload;

            if (decoded.type !== 'admin') {
                return res.status(403).json({ message: 'Forbidden: Invalid token type.' });
            }
            
            if (!decoded.is_active) {
                return res.status(403).json({ message: 'Forbidden: Your admin account is inactive.' });
            }
            
            req.admin = decoded;
            next();

        } catch (err) {
            return res.status(401).json({ message: 'Authentication failed: Invalid or expired access token.' });
        }
    
};