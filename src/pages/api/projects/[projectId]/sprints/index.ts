
import type { APIRoute } from 'astro';
import { SprintService } from '../../../../../lib/services/sprint.service';
import { ProjectService } from '../../../../../lib/services/project.service';
import { requireApiUser } from '../../../../../lib/auth/guards';

export const GET: APIRoute = async (context) => {
  const userOrResponse = await requireApiUser(context);
  if (userOrResponse instanceof Response) return userOrResponse;

  const { projectId } = context.params;
  
  if (!projectId) {
    return new Response(JSON.stringify({ error: 'Project ID required' }), { status: 400 });
  }

  try {
    await ProjectService.requireProjectAccess(projectId, userOrResponse._id.toString());
    const sprints = await SprintService.getAllSprints(projectId);
    return new Response(JSON.stringify(sprints), { status: 200 });
  } catch (error: any) {
    if (error.message === 'Project access denied') return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 });
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
};

export const POST: APIRoute = async (context) => {
  const userOrResponse = await requireApiUser(context);
  if (userOrResponse instanceof Response) return userOrResponse;

  const { projectId } = context.params;
  
  if (!projectId) {
    return new Response(JSON.stringify({ error: 'Project ID required' }), { status: 400 });
  }

  try {
    await ProjectService.requireProjectAccess(projectId, userOrResponse._id.toString());
    const data = await context.request.json();
    const sprint = await SprintService.createSprint(projectId, data);
    return new Response(JSON.stringify(sprint), { status: 201 });
  } catch (error: any) {
    if (error.message === 'Project access denied') return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 });
    return new Response(JSON.stringify({ error: error.message }), { status: 400 });
  }
};
