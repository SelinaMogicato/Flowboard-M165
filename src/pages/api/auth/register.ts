import type { APIRoute } from 'astro';
import { findUserByEmail, createUser } from '../../../lib/repositories/user.repo';
import { hashPassword } from '../../../lib/auth/password';
import { createSession } from '../../../lib/auth/session';

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    const { email, password, name } = await request.json();

    if (!email || !password || !email.includes('@')) {
      return new Response(JSON.stringify({ error: 'Invalid email or password' }), { status: 400 });
    }

    if (password.length < 6) {
      return new Response(JSON.stringify({ error: 'Password must be at least 6 characters' }), { status: 400 });
    }

    const existingUser = await findUserByEmail(email);
    if (existingUser) {
      return new Response(JSON.stringify({ error: 'User already exists' }), { status: 400 });
    }

    const passwordHash = await hashPassword(password);
    const user = await createUser({
      email,
      passwordHash,
      name,
    });

    await createSession(cookies, user._id!.toString(), request.headers.get('user-agent') || undefined, request.headers.get('x-forwarded-for') || undefined);

    return new Response(JSON.stringify({ ok: true }), { status: 201 });
  } catch (error) {
    console.error('Register error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500 });
  }
};
