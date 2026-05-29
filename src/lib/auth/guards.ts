import type { APIContext } from 'astro';
import { getSessionFromRequest } from './session';
import type { User } from '../repositories/user.repo';

export async function requireUser(context: APIContext): Promise<User | Response> {
  const result = await getSessionFromRequest(context.cookies);
  if (!result) {
    return context.redirect('/login');
  }

  // Add user to locals for convenience if needed later
  context.locals.user = result.user;
  return result.user;
}

export async function requireApiUser(context: APIContext): Promise<User | Response> {
  const result = await getSessionFromRequest(context.cookies);
  if (!result) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  context.locals.user = result.user;
  return result.user;
}

export async function getCurrentUser(context: APIContext): Promise<User | null> {
  const result = await getSessionFromRequest(context.cookies);
  if (!result) return null;
  return result.user;
}

