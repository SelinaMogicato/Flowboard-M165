import type { AstroCookies } from 'astro';
import { SESSION_COOKIE_NAME, SESSION_TTL_DAYS } from '../config/env';

export function setSessionCookie(cookies: AstroCookies, token: string) {
  const expires = new Date();
  expires.setDate(expires.getDate() + SESSION_TTL_DAYS);

  cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: import.meta.env.PROD,
    sameSite: 'lax',
    path: '/',
    expires,
  });
}

export function clearSessionCookie(cookies: AstroCookies) {
  cookies.delete(SESSION_COOKIE_NAME, {
    path: '/',
  });
}
