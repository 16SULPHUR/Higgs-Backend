import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken'; 

interface UserPayload {
    id: string;
    role: string;
    organization_id: string | null;
    is_active: boolean;
    type: 'user';
}

declare global {
    namespace Express {
        interface Request {
            user?: any;
        }
    }
}

export const authenticate = (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'Authentication required: No token provided.' });
    }

    const token = authHeader.split(' ')[1];

    console.log("token===================================")
    console.log(token)

    if (!token) {
        return res.status(401).json({ message: 'Access token required.' });
    }
    
    try {
        const decoded:any = jwt.verify(token, process.env.JWT_SECRET!) as UserPayload;

        console.log(decoded)
        console.log(new Date(decoded?.exp * 1000).toLocaleTimeString())

        if (decoded.type !== 'user') {
            return res.status(403).json({ message: 'Forbidden: Invalid token type.' });
        }
        
        if (!decoded.is_active) {
            return res.status(403).json({ message: 'Forbidden: Your account is inactive.' });
        }
        
        req.user = decoded;
        next();

    } catch (err) {
        return res.status(401).json({ message: 'Invalid or expired access token.' });
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