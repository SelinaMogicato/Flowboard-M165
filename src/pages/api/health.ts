import type { APIRoute } from 'astro';
import { getDb } from '../../lib/db/mongo';

export const GET: APIRoute = async () => {
  try {
    const db = await getDb();
    const result = await db.command({ ping: 1 });
    
    return new Response(JSON.stringify({
      status: 'ok',
      mongo: result.ok === 1
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      status: 'error',
      message: (error as Error).message
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }
};
