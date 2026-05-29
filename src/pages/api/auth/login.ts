import type { APIRoute } from 'astro';
import { findUserByEmail } from '../../../lib/repositories/user.repo';
import { verifyPassword } from '../../../lib/auth/password';
import { createSession } from '../../../lib/auth/session';

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    const { email, password } = await request.json();

    if (!email || !password || !email.includes('@')) {
      return new Response(JSON.stringify({ error: 'Invalid email or password' }), { status: 400 });
    }

    const user = await findUserByEmail(email);
    if (!user) {
      return new Response(JSON.stringify({ error: 'Invalid email or password' }), { status: 401 });
    }

    const isValid = await verifyPassword(password, user.passwordHash);
    if (!isValid) {
      return new Response(JSON.stringify({ error: 'Invalid email or password' }), { status: 401 });
    }

    await createSession(cookies, user._id!.toString(), request.headers.get('user-agent') || undefined, request.headers.get('x-forwarded-for') || undefined);

    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  } catch (error) {
    console.error('Login error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500 });
  }
};

