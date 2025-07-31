import { Response } from 'express';
import pool from '../lib/db.js';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { randomBytes, randomUUID } from 'crypto';

const ACCESS_TOKEN_EXPIRY = '30m';
const REFRESH_TOKEN_EXPIRY_DAYS = 7;

interface UserForToken {
    id: string;
    role: string;
    organization_id: string | null;
    is_active: boolean;
}

interface AdminForToken {
    id: string;
    role: string;
    location_id: string | null;
    is_active: boolean;
}

export const generateAccessToken = (subject: UserForToken | AdminForToken, subjectType: 'USER' | 'ADMIN'): string => {


    const payload = {
        id: subject.id,
        role: subject.role,
        is_active: subject.is_active,
        type: subjectType.toLowerCase(),
        ...(subjectType === 'USER' && { organization_id: (subject as UserForToken).organization_id }),
        ...(subjectType === 'ADMIN' && { locationId: (subject as AdminForToken).location_id }),
    };
    return jwt.sign(payload, process.env.JWT_SECRET!, { expiresIn: ACCESS_TOKEN_EXPIRY });
};
 

export const generateTokens = async (subject: UserForToken | AdminForToken, subjectType: 'USER' | 'ADMIN', client = pool, familyId?: string) => {
    const newFamilyId = familyId || randomUUID();
 
    const accessToken = generateAccessToken(subject, subjectType);
 
    const selector = randomBytes(16).toString('hex');
    const verifier = randomBytes(32).toString('hex');
 
    const verifierHash = await bcrypt.hash(verifier, 10);
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
 
    await client.query(
        'INSERT INTO refresh_tokens (subject_id, subject_type, selector, token_hash, family_id, expires_at) VALUES ($1, $2, $3, $4, $5, $6)',
        [subject.id, subjectType, selector, verifierHash, newFamilyId, expiresAt]
    );
 
    const refreshToken = `${selector}:${verifier}`;

    return {
        accessToken,
        refreshToken,
    };
};



export const clearTokens = (res: Response) => {
    res.clearCookie('accessToken', { path: '/' });
    res.clearCookie('refreshToken', { path: '/api/auth/refresh' });
};