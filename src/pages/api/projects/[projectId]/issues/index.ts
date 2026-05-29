
import type { APIRoute } from 'astro';
import { IssueService } from '../../../../../lib/services/issue.service';
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
    
    const url = new URL(context.request.url);
    const search = url.searchParams.get('search');
    const priority = url.searchParams.get('priority');
    const labels = url.searchParams.get('labels')?.split(',');

    const issues = await IssueService.getIssuesByProject(projectId, { search, priority, labels });
    return new Response(JSON.stringify(issues), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
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
    const body = await context.request.json();
    const issue = await IssueService.createIssue(
      projectId, 
      body.listId, 
      body.title, 
      body.priority, 
      {
        description: body.description,
        labels: body.labels,
        assignee: body.assignee
      }
    );
    return new Response(JSON.stringify(issue), { status: 201 });
  } catch (error: any) {
    if (error.message === 'Project access denied') return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 });
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
};
