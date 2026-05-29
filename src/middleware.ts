import { defineMiddleware } from 'astro:middleware';
import { getSessionFromRequest } from './lib/auth/session';

export const onRequest = defineMiddleware(async (context, next) => {

  // Routes to protect (pages and API)
  const protectedPaths = [
    '/projects',
    '/board', 
    '/settings',
  ];
  const protectedApis = [
    '/api/projects'
  ];

  const pathname = context.url.pathname;

  const isProtectedPage = protectedPaths.some(route => 
    pathname === route || pathname.startsWith(route + '/')
  );
  
  const isProtectedApi = protectedApis.some(route => 
    pathname === route || pathname.startsWith(route + '/')
  );

  if (isProtectedPage || isProtectedApi) {
    const session = await getSessionFromRequest(context.cookies);
    
    if (!session) {
      // API returns 401
      if (isProtectedApi) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      // Pages redirect to login
      return context.redirect('/login');
    }
    
    // Store user for downstream use
    context.locals.user = session.user;
  }

  return next();
});

