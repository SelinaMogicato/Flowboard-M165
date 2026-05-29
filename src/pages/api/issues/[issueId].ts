
import { IssueRepo } from '../../../lib/repositories/issue.repo';
import { ProjectService } from '../../../lib/services/project.service';
import { requireApiUser } from '../../../lib/auth/guards';
import type { APIRoute } from 'astro';

export const GET: APIRoute = async (context) => {
  const userOrResponse = await requireApiUser(context);
  if (userOrResponse instanceof Response) return userOrResponse;

  const { issueId } = context.params;

  if (!issueId) {
    return new Response(JSON.stringify({ error: 'Issue ID required' }), { status: 400 });
  }

  try {
    const issue = await IssueRepo.findById(issueId);
    if (!issue) {
      return new Response(JSON.stringify({ error: 'Issue not found' }), { status: 404 });
    }

    await ProjectService.requireProjectAccess(issue.projectId.toString(), userOrResponse._id!.toString());

    return new Response(JSON.stringify(issue), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error: any) {
    if (error.message === 'Project access denied') return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 });
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500 });
  }
};

export const PATCH: APIRoute = async (context) => {
  const userOrResponse = await requireApiUser(context);
  if (userOrResponse instanceof Response) return userOrResponse;

  const { issueId } = context.params;

  if (!issueId) {
    return new Response(JSON.stringify({ error: 'Issue ID required' }), { status: 400 });
  }

  try {
    const issue = await IssueRepo.findById(issueId);
    if (!issue) {
      return new Response(JSON.stringify({ error: 'Issue not found' }), { status: 404 });
    }

    await ProjectService.requireProjectPermission(issue.projectId.toString(), userOrResponse._id!.toString(), 'issues.update');

    const body = await context.request.json();
    const { title, description, priority, labels } = body;

    const updates: any = {};
    if (title !== undefined) {
      if (!title.trim()) return new Response(JSON.stringify({ error: 'Title cannot be empty' }), { status: 400 });
      updates.title = title.trim();
    }
    if (description !== undefined) updates.description = description;
    if (priority !== undefined) {
      if (!['Low', 'Medium', 'High'].includes(priority)) {
        return new Response(JSON.stringify({ error: 'Invalid priority' }), { status: 400 });
      }
      updates.priority = priority;
    }
    if (labels !== undefined) {
      if (!Array.isArray(labels)) return new Response(JSON.stringify({ error: 'Labels must be an array' }), { status: 400 });
      updates.labels = labels;
    }

    const updated = await IssueRepo.update(issueId, updates);
    if (!updated) {
      return new Response(JSON.stringify({ error: 'Issue not found or update failed' }), { status: 404 });
    }

    return new Response(JSON.stringify(updated), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error: any) {
    if (error.message === 'Project access denied' || error.message?.startsWith('Permission denied')) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 });
    }
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500 });
  }
};

export const DELETE: APIRoute = async (context) => {
  const userOrResponse = await requireApiUser(context);
  if (userOrResponse instanceof Response) return userOrResponse;

  const { issueId } = context.params;

  if (!issueId) {
    return new Response(JSON.stringify({ error: 'Issue ID required' }), { status: 400 });
  }

  try {
    const issue = await IssueRepo.findById(issueId);
    if (!issue) {
      return new Response(JSON.stringify({ error: 'Issue not found' }), { status: 404 });
    }

    await ProjectService.requireProjectPermission(issue.projectId.toString(), userOrResponse._id!.toString(), 'issues.delete');

    const success = await IssueRepo.delete(issueId);
    if (!success) {
      return new Response(JSON.stringify({ error: 'Issue not found' }), { status: 404 });
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error: any) {
    if (error.message === 'Project access denied' || error.message?.startsWith('Permission denied')) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 });
    }
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500 });
  }
};
