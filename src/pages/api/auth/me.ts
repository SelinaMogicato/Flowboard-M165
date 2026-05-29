import type { APIRoute } from 'astro';
import { getSessionFromRequest } from '../../../lib/auth/session';

export const GET: APIRoute = async ({ cookies }) => {
  const result = await getSessionFromRequest(cookies);
  
  if (!result) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  const { user } = result;
  
  return new Response(JSON.stringify({
    user: {
      id: user._id,
      email: user.email,
      name: user.name,
    }
  }), { status: 200 });
};
