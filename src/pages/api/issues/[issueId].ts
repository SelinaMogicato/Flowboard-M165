
import { ObjectId } from 'mongodb';
import { getDb } from '../../../lib/db/mongo';
import { IssueRepo } from '../../../lib/repositories/issue.repo';
import type { APIRoute } from 'astro';

export const GET: APIRoute = async ({ params, request }) => {
  const { issueId } = params;

  if (!issueId) {
    return new Response(JSON.stringify({ error: 'Issue ID required' }), { status: 400 });
  }

  try {
    const issue = await IssueRepo.findById(issueId);
    if (!issue) {
      return new Response(JSON.stringify({ error: 'Issue not found' }), { status: 404 });
    }
    return new Response(JSON.stringify(issue), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500 });
  }
};

export const PATCH: APIRoute = async ({ params, request }) => {
  const { issueId } = params;
  
  // Basic auth check simulation - in real app use middleware/session
  // const user = await getUser(request);
  // if (!user) return new Response('Unauthorized', { status: 401 });

  if (!issueId) {
    return new Response(JSON.stringify({ error: 'Issue ID required' }), { status: 400 });
  }

  try {
    const body = await request.json();
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
  } catch (error) {
    console.error('Update error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500 });
  }
};

export const DELETE: APIRoute = async ({ params, request }) => {
  const { issueId } = params;

  if (!issueId) {
    return new Response(JSON.stringify({ error: 'Issue ID required' }), { status: 400 });
  }

  try {
    const success = await IssueRepo.delete(issueId);
    if (!success) {
      return new Response(JSON.stringify({ error: 'Issue not found' }), { status: 404 });
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Delete error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500 });
  }
};
