import type { APIRoute } from 'astro';
import { SprintService } from '../../../lib/services/sprint.service';
import { SprintRepo } from '../../../lib/repositories/sprint.repo';
import { ProjectService } from '../../../lib/services/project.service';
import { requireApiUser } from '../../../lib/auth/guards';

export const GET: APIRoute = async (context) => {
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

    return new Response(JSON.stringify(sprint), { 
        status: 200,
        headers: { 'Content-Type': 'application/json' }
    });
  } catch (error: any) {
    if (error.message === 'Project access denied') return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 });
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
};

export const PATCH: APIRoute = async (context) => {
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

    const body = await context.request.json();
    
    // Allow partial updates
    const updates: any = {};
    const allowedFields = ['name', 'goal', 'startDate', 'endDate'];
    
    Object.keys(body).forEach(key => {
        if (allowedFields.includes(key)) {
            updates[key] = body[key];
        }
    });

    if (updates.startDate) updates.startDate = new Date(updates.startDate);
    if (updates.endDate) updates.endDate = new Date(updates.endDate);

    const updatedSprint = await SprintService.updateSprint(sprintId, updates);
    return new Response(JSON.stringify(updatedSprint), { 
        status: 200,
        headers: { 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    if (error.message === 'Project access denied') return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 });
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
};

export const DELETE: APIRoute = async (context) => {
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
        
        await SprintService.deleteSprint(sprintId);
        return new Response(null, { status: 204 });
    } catch (error: any) {
        if (error.message === 'Project access denied') return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 });
        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }
};
