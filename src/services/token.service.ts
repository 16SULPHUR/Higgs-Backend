import { Response } from 'express';
import pool from '../lib/db.js';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { randomBytes, randomUUID } from 'crypto'; 

const ACCESS_TOKEN_EXPIRY = '30m';
const REFRESH_TOKEN_EXPIRY_DAYS = 7;


export const generateTokens = async (subjectId: string, subjectType: 'USER' | 'ADMIN', client = pool, familyId?: string) => {
    console.log('generateTokens');
    const newFamilyId = familyId || randomUUID();
    
    const accessTokenPayload = { id: subjectId, type: subjectType.toLowerCase() };
    const accessToken = jwt.sign(accessTokenPayload, process.env.JWT_SECRET!, { expiresIn: ACCESS_TOKEN_EXPIRY });
    
    const refreshToken = randomBytes(40).toString('hex');
    const refreshTokenHash = await bcrypt.hash(refreshToken, 10);
    
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
     
    await client.query(
        'INSERT INTO refresh_tokens (subject_id, subject_type, token_hash, family_id, expires_at) VALUES ($1, $2, $3, $4, $5)',
        [subjectId, subjectType, refreshTokenHash, newFamilyId, expiresAt]
    );
    
    console.log("accessToken, refreshToken, refreshTokenHash");
    console.log(accessToken, refreshToken, refreshTokenHash);
    
    return {
        accessToken,
        refreshToken,
    };
};


export const clearTokens = (res: Response) => {
    res.clearCookie('accessToken', { path: '/' });
    res.clearCookie('refreshToken', { path: '/api/auth/refresh' });
};

export const generateAccessToken = (subjectId: string, subjectType: 'USER' | 'ADMIN'): string => {
    const accessTokenPayload = { id: subjectId, type: subjectType.toLowerCase() };
    const accessToken = jwt.sign(accessTokenPayload, process.env.JWT_SECRET!, { expiresIn: ACCESS_TOKEN_EXPIRY });
    return accessToken;
};