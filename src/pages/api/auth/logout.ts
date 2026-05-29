import type { APIRoute } from 'astro';
import { revokeSession } from '../../../lib/auth/session';

export const POST: APIRoute = async ({ cookies }) => {
  await revokeSession(cookies);
  return new Response(JSON.stringify({ ok: true }), { status: 200 });
};

