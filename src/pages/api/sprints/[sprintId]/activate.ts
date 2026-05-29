import type { APIRoute } from 'astro';
import { SprintService } from '../../../../lib/services/sprint.service';
import { SprintRepo } from '../../../../lib/repositories/sprint.repo';
import { ProjectService } from '../../../../lib/services/project.service';
import { requireApiUser } from '../../../../lib/auth/guards';

export const POST: APIRoute = async (context) => {
  const userOrResponse = await requireApiUser(context);
  if (userOrResponse instanceof Response) return userOrResponse;

  const { sprintId } = context.params;
  
  if (!sprintId) {
    return new Response(JSON.stringify({ error: 'Sprint ID required' }), { status: 400 });
  }

  try {
    const sprint = await SprintRepo.findById(sprintId);
    if (!sprint) {
      return new Response(JSON.stringify({ error: 'Sprint not found' }), { status: 404 });
    }

    await ProjectService.requireProjectAccess(sprint.projectId.toString(), userOrResponse._id.toString());

    const activatedSprint = await SprintService.activateSprint(sprintId);
    return new Response(JSON.stringify(activatedSprint), { status: 200 });
  } catch (error: any) {
    if (error.message === 'Project access denied') return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 });
    return new Response(JSON.stringify({ error: error.message }), { status: 400 });
  }
};
