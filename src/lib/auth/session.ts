import crypto from 'node:crypto';
import type { AstroCookies } from 'astro';
import { ObjectId } from 'mongodb';
import { SESSION_TTL_DAYS } from '../config/env';
import * as SessionRepo from '../repositories/session.repo';
import { setSessionCookie, clearSessionCookie } from './cookies';
import { findUserById, type User } from '../repositories/user.repo';

export async function createSession(cookies: AstroCookies, userId: string | ObjectId, userAgent?: string, ip?: string): Promise<string> {
  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + SESSION_TTL_DAYS);

  await SessionRepo.createSession({
    userId: new ObjectId(userId),
    tokenHash,
    createdAt: new Date(),
    expiresAt,
    userAgent,
    ip,
  });

  setSessionCookie(cookies, token);
  return token;
}

export async function getSessionFromRequest(cookies: AstroCookies): Promise<{ session: SessionRepo.Session, user: User } | null> {
  const token = cookies.get('flowboard_session')?.value;
  
  if (!token) return null;
  
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const session = await SessionRepo.findValidSessionByTokenHash(tokenHash);
  
  if (!session) return null;

  const user = await findUserById(session.userId);
  if (!user) return null;

  return { session, user };
}

export async function revokeSession(cookies: AstroCookies) {
  const token = cookies.get('flowboard_session')?.value;
  if (token) {
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    await SessionRepo.revokeByTokenHash(tokenHash);
  }
  clearSessionCookie(cookies);
}

