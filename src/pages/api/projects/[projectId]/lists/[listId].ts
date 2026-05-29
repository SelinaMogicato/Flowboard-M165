import type { APIRoute } from 'astro';
import { ProjectService } from '../../../../../lib/services/project.service';
import { requireApiUser } from '../../../../../lib/auth/guards';

export const PATCH: APIRoute = async (context) => {
  const userOrResponse = await requireApiUser(context);
  if (userOrResponse instanceof Response) return userOrResponse;

  try {
    const { projectId, listId } = context.params;
    if (!projectId || !listId) return new Response(null, { status: 404 });

    await ProjectService.requireProjectAccess(projectId, userOrResponse._id.toString());

    const body = await context.request.json();
    const { title, color } = body;

    await ProjectService.updateList(projectId, listId, title, color);
    
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error: any) {
    if (error.message === 'Project access denied') return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 });
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

export const DELETE: APIRoute = async (context) => {
  const userOrResponse = await requireApiUser(context);
  if (userOrResponse instanceof Response) return userOrResponse;

  try {
    const { projectId, listId } = context.params;
    if (!projectId || !listId) return new Response(null, { status: 404 });

    await ProjectService.requireProjectAccess(projectId, userOrResponse._id.toString());

    await ProjectService.deleteList(projectId, listId);
    
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error: any) {
    if (error.message === 'Project access denied') return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 });
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
