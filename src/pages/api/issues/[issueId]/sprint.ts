
import type { APIRoute } from 'astro';
import { SprintService } from '../../../../lib/services/sprint.service';
import { IssueRepo } from '../../../../lib/repositories/issue.repo';
import { ProjectService } from '../../../../lib/services/project.service';
import { requireApiUser } from '../../../../lib/auth/guards';

export const PATCH: APIRoute = async (context) => {
  const userOrResponse = await requireApiUser(context);
  if (userOrResponse instanceof Response) return userOrResponse;

  const { issueId } = context.params;
  if (!issueId) return new Response(JSON.stringify({ error: 'Issue ID required' }), { status: 400 });

  try {
    const issue = await IssueRepo.findById(issueId);
    if (!issue) return new Response(JSON.stringify({ error: 'Issue not found' }), { status: 404 });
    await ProjectService.requireProjectPermission(issue.projectId.toString(), userOrResponse._id.toString(), 'issues.update');

    const { sprintId } = await context.request.json();
    if (!sprintId) return new Response(JSON.stringify({ error: 'Sprint ID required' }), { status: 400 });

    const result = await SprintService.assignIssueToSprint(issueId, sprintId);
    return new Response(JSON.stringify({ success: true, result }), { status: 200 });
  } catch (error: any) {
    if (error.message === 'Project access denied' || error.message?.startsWith('Permission denied')) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 });
    }
    return new Response(JSON.stringify({ error: error.message }), { status: 400 });
  }
};

export const DELETE: APIRoute = async (context) => {
  const userOrResponse = await requireApiUser(context);
  if (userOrResponse instanceof Response) return userOrResponse;

  const { issueId } = context.params;
  if (!issueId) return new Response(JSON.stringify({ error: 'Issue ID required' }), { status: 400 });

  try {
    const issue = await IssueRepo.findById(issueId);
    if (!issue) return new Response(JSON.stringify({ error: 'Issue not found' }), { status: 404 });
    await ProjectService.requireProjectPermission(issue.projectId.toString(), userOrResponse._id.toString(), 'issues.update');

    const result = await SprintService.removeIssueFromSprint(issueId);
    return new Response(JSON.stringify({ success: true, result }), { status: 200 });
  } catch (error: any) {
    if (error.message === 'Project access denied' || error.message?.startsWith('Permission denied')) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 });
    }
    return new Response(JSON.stringify({ error: error.message }), { status: 400 });
  }
};
