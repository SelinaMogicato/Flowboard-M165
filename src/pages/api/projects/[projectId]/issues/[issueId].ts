import type { APIRoute } from 'astro';
import { IssueService } from '../../../../../lib/services/issue.service';
import { IssueRepo } from '../../../../../lib/repositories/issue.repo';
import { ProjectService } from '../../../../../lib/services/project.service';
import { requireApiUser } from '../../../../../lib/auth/guards';

export const PUT: APIRoute = async (context) => {
  const userOrResponse = await requireApiUser(context);
  if (userOrResponse instanceof Response) return userOrResponse;

  const { projectId, issueId } = context.params;
  
  if (!projectId || !issueId) {
    return new Response(JSON.stringify({ error: 'Project ID and Issue ID required' }), { status: 400 });
  }

  try {
    await ProjectService.requireProjectAccess(projectId, userOrResponse._id.toString());
    const body = await context.request.json();

    // Check if this is a move operation
    if (body.listId !== undefined || body.order !== undefined) {
      const currentIssue = await IssueRepo.findById(issueId);
      if (!currentIssue) {
        return new Response(JSON.stringify({ error: 'Issue not found' }), { status: 404 });
      }

      if (currentIssue.projectId.toString() !== projectId) {
        return new Response(JSON.stringify({ error: 'Issue does not belong to this project' }), { status: 400 });
      }

      // Determine new list and order
      const newListId = body.listId !== undefined ? body.listId : currentIssue.listId;
      
      if (body.order !== undefined) {
         // Explicit move with order
         await IssueService.moveIssue(issueId, newListId, body.order);
      } else if (body.listId !== undefined && body.listId !== currentIssue.listId) {
         // Moved to new list without explicit order -> append to end
         const issuesInNewList = await IssueRepo.findAllByProject(projectId, { listId: newListId });
         await IssueService.moveIssue(issueId, newListId, issuesInNewList.length);
      } else {
         // Order undefined and listId same (or undefined)? Nothing to move?
      }

      // Handle other fields update if present
      const otherUpdates: any = {};
      const excludedKeys = ['listId', 'order', '_id', 'projectId', 'createdAt', 'updatedAt'];
      Object.keys(body).forEach(key => {
          if (!excludedKeys.includes(key)) {
              otherUpdates[key] = body[key];
          }
      });
      
      if (Object.keys(otherUpdates).length > 0) {
          await IssueService.updateIssue(issueId, otherUpdates);
      }

    } else {
      // Standard update (no move)
      await IssueService.updateIssue(issueId, body);
    }

    const updatedIssue = await IssueRepo.findById(issueId);
    return new Response(JSON.stringify(updatedIssue), {
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

  const { projectId, issueId } = context.params;
  if (!projectId || !issueId) {
    return new Response(JSON.stringify({ error: 'Project ID and Issue ID required' }), { status: 400 });
  }

  try {
    await ProjectService.requireProjectAccess(projectId, userOrResponse._id.toString());
    await IssueService.deleteIssue(issueId);
    return new Response(null, { status: 204 });
  } catch (error: any) {
    if (error.message === 'Project access denied') return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 });
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
