
import type { APIRoute } from 'astro';
import { SprintService } from '../../../../lib/services/sprint.service';

export const PATCH: APIRoute = async ({ params, request }) => {
  const { issueId } = params;
  if (!issueId) return new Response(JSON.stringify({ error: 'Issue ID required' }), { status: 400 });

  try {
    const { sprintId } = await request.json();
    if (!sprintId) return new Response(JSON.stringify({ error: 'Sprint ID required' }), { status: 400 });

    const result = await SprintService.assignIssueToSprint(issueId, sprintId);
    return new Response(JSON.stringify({ success: true, result }), { status: 200 });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 400 });
  }
};

export const DELETE: APIRoute = async ({ params }) => {
  const { issueId } = params;
  if (!issueId) return new Response(JSON.stringify({ error: 'Issue ID required' }), { status: 400 });

  try {
    const result = await SprintService.removeIssueFromSprint(issueId);
    return new Response(JSON.stringify({ success: true, result }), { status: 200 });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 400 });
  }
};
