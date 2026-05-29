import type { APIRoute } from 'astro';
import { ObjectId } from 'mongodb';
import { requireApiUser } from '../../../../lib/auth/guards';
import { ProjectService } from '../../../../lib/services/project.service';
import { ProjectStatsRepo } from '../../../../lib/repositories/project-stats.repo';

export const GET: APIRoute = async (context) => {
  const userOrResponse = await requireApiUser(context);
  if (userOrResponse instanceof Response) return userOrResponse;

  const { projectId } = context.params;
  if (!projectId) {
    return new Response(JSON.stringify({ error: 'Project ID required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  if (!ObjectId.isValid(projectId)) {
    return new Response(JSON.stringify({ error: 'Invalid project ID' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    await ProjectService.requireProjectAccess(projectId, userOrResponse._id.toString());
  } catch {
    return new Response(JSON.stringify({ error: 'Forbidden' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const stats = await ProjectStatsRepo.getStats(projectId);
    return new Response(JSON.stringify(stats), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
