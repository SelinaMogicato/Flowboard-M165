import type { APIRoute } from 'astro';
import { ProjectService } from '../../../lib/services/project.service';
import { requireApiUser } from '../../../lib/auth/guards';

export const GET: APIRoute = async (context) => {
  const userOrResponse = await requireApiUser(context);
  if (userOrResponse instanceof Response) return userOrResponse;

  try {
    const { projectId } = context.params;
    if (!projectId) return new Response(null, { status: 404 });

    const project = await ProjectService.getProjectById(projectId, userOrResponse._id.toString());
    if (!project) {
      return new Response(JSON.stringify({ error: 'Project not found' }), {
        status: 404, // getProjectById returns null if not found OR not accessible
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify(project), {
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

export const PATCH: APIRoute = async (context) => {
  const userOrResponse = await requireApiUser(context);
  if (userOrResponse instanceof Response) return userOrResponse;

  try {
    const { projectId } = context.params;
    if (!projectId) return new Response(null, { status: 404 });

    // Only owner can update project settings
    try {
      await ProjectService.requireProjectOwner(projectId, userOrResponse._id.toString());
    } catch (e) {
      return new Response(JSON.stringify({ error: (e as Error).message }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const body = await context.request.json();
    const result = await ProjectService.updateProject(projectId, body);

    if (!result) {
       return new Response(JSON.stringify({ error: 'Project not found or invalid ID' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    const message = (error as Error).message;
    const status = message.includes('Invalid') ? 400 : 500;

    return new Response(JSON.stringify({ error: message }), {
      status,
      headers: { 'Content-Type': 'application/json' } // Fix status code for validations
    });
  }
};

export const DELETE: APIRoute = async (context) => {
  const userOrResponse = await requireApiUser(context);
  if (userOrResponse instanceof Response) return userOrResponse;

  try {
    const { projectId } = context.params;
    if (!projectId) return new Response(null, { status: 404 });

    // Only owner can delete project
    try {
      await ProjectService.requireProjectOwner(projectId, userOrResponse._id.toString());
    } catch (e) {
      return new Response(JSON.stringify({ error: (e as Error).message }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const success = await ProjectService.deleteProject(projectId);
    if (!success) {
      return new Response(JSON.stringify({ error: 'Project not found or could not be deleted' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(null, { status: 204 });
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
