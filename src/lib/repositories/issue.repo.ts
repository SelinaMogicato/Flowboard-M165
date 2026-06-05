// Issues are embedded inside the project document:
//   project.backlog[]              – issues not yet in any sprint
//   project.sprints[i].issues[]   – issues belonging to sprint i
//
// All operations work via the projects collection.
// Virtual fields `projectId` and `sprintId` are added on read so the rest of
// the application can use them the same way as before.

import { ObjectId } from 'mongodb';
import { getDb } from '../db/mongo';
import type { EmbeddedIssue, Priority } from './project.repo';

export type { Priority } from './project.repo';

// Issue as returned to callers: adds virtual location fields
export interface Issue extends EmbeddedIssue {
  projectId: string;
  sprintId: ObjectId | null; // null = in project.backlog
}

// ---------- private helpers ----------

type IssueLocation = {
  projectId: ObjectId;
  sprintId: ObjectId | null;
  issue: EmbeddedIssue;
};

// Find which project (and optionally which sprint) holds a given issue _id.
async function locateIssue(issueId: string): Promise<IssueLocation | null> {
  if (!ObjectId.isValid(issueId)) return null;
  const db = await getDb();
  const oid = new ObjectId(issueId);

  // Check backlog first (positional $ returns the matched element)
  let project = await db.collection('projects').findOne({ 'backlog._id': oid });
  if (project) {
    const issue = project.backlog.find((i: EmbeddedIssue) => i._id.toString() === issueId);
    if (issue) return { projectId: project._id, sprintId: null, issue };
  }

  // Check sprint issues
  project = await db.collection('projects').findOne({ 'sprints.issues._id': oid });
  if (project) {
    for (const sprint of (project.sprints ?? [])) {
      const issue = (sprint.issues ?? []).find((i: EmbeddedIssue) => i._id.toString() === issueId);
      if (issue) return { projectId: project._id, sprintId: sprint._id, issue };
    }
  }

  return null;
}

// Apply a simple query object (subset of MongoDB operators) as an in-process filter.
function matchesFilter(issue: any, filter: any): boolean {
  if (!filter || Object.keys(filter).length === 0) return true;

  for (const [key, condition] of Object.entries(filter)) {
    if (key === '$or') {
      if (!(condition as any[]).some(c => matchesFilter(issue, c))) return false;
      continue;
    }

    const val = issue[key];

    if (condition === null || condition === undefined) {
      if (val !== null && val !== undefined) return false;
    } else if (typeof condition === 'object' && !Array.isArray(condition)) {
      for (const [op, opVal] of Object.entries(condition as any)) {
        if (op === '$regex') {
          const flags = (condition as any).$options ?? '';
          if (!new RegExp(opVal as string, flags).test(val ?? '')) return false;
        } else if (op === '$all') {
          if (!Array.isArray(val) || !(opVal as string[]).every(v => val.includes(v))) return false;
        } else if (op === '$in') {
          if (!(opVal as any[]).some(v => v?.toString() === val?.toString())) return false;
        } else if (op === '$exists') {
          const exists = val !== undefined && val !== null;
          if (opVal !== exists) return false;
        } else if (op === '$options') {
          // consumed by $regex branch above
        }
      }
    } else {
      // Direct equality (compare as strings to handle ObjectId vs string mismatches)
      if (val?.toString() !== (condition as any)?.toString() && val !== condition) return false;
    }
  }
  return true;
}

// ---------- public repo ----------

export const IssueRepo = {
  async findAllByProject(projectId: string, filter: any = {}): Promise<Issue[]> {
    if (!ObjectId.isValid(projectId)) return [];
    const db = await getDb();

    const project = await db.collection('projects').findOne({ _id: new ObjectId(projectId) });
    if (!project) return [];

    const all: Issue[] = [];

    for (const issue of (project.backlog ?? [])) {
      all.push({ ...issue, projectId, sprintId: null });
    }

    for (const sprint of (project.sprints ?? [])) {
      for (const issue of (sprint.issues ?? [])) {
        all.push({ ...issue, projectId, sprintId: sprint._id });
      }
    }

    return all
      .filter(i => matchesFilter(i, filter))
      .sort((a, b) => a.order - b.order);
  },

  // Find a single issue by its _id (searches all projects).
  async findById(issueId: string): Promise<Issue | null> {
    const loc = await locateIssue(issueId);
    if (!loc) return null;
    return {
      ...loc.issue,
      projectId: loc.projectId.toString(),
      sprintId: loc.sprintId ?? null,
    };
  },

  // Create an issue. If sprintId is provided it goes into that sprint; otherwise into backlog.
  async create(data: Omit<Issue, '_id' | 'createdAt' | 'updatedAt'>): Promise<Issue> {
    const db = await getDb();
    const { projectId, sprintId, ...fields } = data;

    const doc: EmbeddedIssue = {
      _id: new ObjectId(),
      ...fields,
      priority: fields.priority ?? 'Medium',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    if (sprintId) {
      // Push into the matching sprint's issues array
      await db.collection('projects').updateOne(
        { _id: new ObjectId(projectId), 'sprints._id': new ObjectId(sprintId.toString()) },
        { $push: { 'sprints.$.issues': doc } as any }
      );
    } else {
      // Push into project backlog
      await db.collection('projects').updateOne(
        { _id: new ObjectId(projectId) },
        { $push: { backlog: doc } as any }
      );
    }

    return { ...doc, projectId, sprintId: sprintId ? new ObjectId(sprintId.toString()) : null };
  },

  // Update fields on an issue (title, priority, labels, listId, order, …).
  async update(issueId: string, updates: Partial<Omit<Issue, '_id' | 'projectId' | 'sprintId' | 'createdAt'>>): Promise<Issue | null> {
    if (!ObjectId.isValid(issueId)) return null;
    const db = await getDb();
    const oid = new ObjectId(issueId);

    const setBacklog: Record<string, any> = { 'backlog.$[i].updatedAt': new Date() };
    const setSprint: Record<string, any> = { 'sprints.$[s].issues.$[i].updatedAt': new Date() };

    const skip = new Set(['_id', 'projectId', 'sprintId', 'createdAt', 'updatedAt']);
    for (const [k, v] of Object.entries(updates)) {
      if (!skip.has(k)) {
        setBacklog[`backlog.$[i].${k}`] = v;
        setSprint[`sprints.$[s].issues.$[i].${k}`] = v;
      }
    }

    // Try backlog first
    const backlogResult = await db.collection('projects').updateOne(
      { 'backlog._id': oid },
      { $set: setBacklog },
      { arrayFilters: [{ 'i._id': oid }] }
    );

    if (backlogResult.matchedCount === 0) {
      // Try sprint issues
      await db.collection('projects').updateOne(
        { 'sprints.issues._id': oid },
        { $set: setSprint },
        { arrayFilters: [{ 's.issues._id': oid }, { 'i._id': oid }] }
      );
    }

    return this.findById(issueId);
  },

  async delete(issueId: string): Promise<boolean> {
    if (!ObjectId.isValid(issueId)) return false;
    const db = await getDb();
    const oid = new ObjectId(issueId);

    // Try backlog
    let result = await db.collection('projects').updateOne(
      { 'backlog._id': oid },
      { $pull: { backlog: { _id: oid } } as any }
    );
    if (result.modifiedCount > 0) return true;

    // Try sprint issues (arrayFilters needed for nested array $pull)
    result = await db.collection('projects').updateOne(
      { 'sprints.issues._id': oid },
      { $pull: { 'sprints.$[s].issues': { _id: oid } } as any },
      { arrayFilters: [{ 's.issues._id': oid }] }
    );
    return result.modifiedCount > 0;
  },

  // Move an issue from its current location (backlog or sprint) into a different sprint.
  async assignToSprint(issueId: string, sprintId: string): Promise<boolean> {
    if (!ObjectId.isValid(issueId) || !ObjectId.isValid(sprintId)) return false;
    const db = await getDb();
    const oid = new ObjectId(issueId);
    const targetOid = new ObjectId(sprintId);

    const loc = await locateIssue(issueId);
    if (!loc) return false;

    const updatedIssue = { ...loc.issue, updatedAt: new Date() };

    if (loc.sprintId === null) {
      // Remove from backlog
      await db.collection('projects').updateOne(
        { _id: loc.projectId },
        { $pull: { backlog: { _id: oid } } as any }
      );
    } else {
      // Remove from current sprint
      await db.collection('projects').updateOne(
        { _id: loc.projectId, 'sprints._id': loc.sprintId },
        { $pull: { 'sprints.$.issues': { _id: oid } } as any }
      );
    }

    // Push into target sprint
    await db.collection('projects').updateOne(
      { _id: loc.projectId, 'sprints._id': targetOid },
      { $push: { 'sprints.$.issues': updatedIssue } as any }
    );

    return true;
  },

  // Move an issue from its current sprint back to the project backlog.
  async removeFromSprint(issueId: string): Promise<boolean> {
    if (!ObjectId.isValid(issueId)) return false;
    const db = await getDb();
    const oid = new ObjectId(issueId);

    const loc = await locateIssue(issueId);
    if (!loc || loc.sprintId === null) return false; // already in backlog

    const updatedIssue = { ...loc.issue, updatedAt: new Date() };

    // Remove from sprint
    await db.collection('projects').updateOne(
      { _id: loc.projectId, 'sprints._id': loc.sprintId },
      { $pull: { 'sprints.$.issues': { _id: oid } } as any }
    );

    // Push into backlog
    await db.collection('projects').updateOne(
      { _id: loc.projectId },
      { $push: { backlog: updatedIssue } as any }
    );

    return true;
  },

  // Return all issues belonging to a specific sprint.
  async findAllBySprint(sprintId: string): Promise<Issue[]> {
    if (!ObjectId.isValid(sprintId)) return [];
    const db = await getDb();
    const oid = new ObjectId(sprintId);

    const project = await db.collection('projects').findOne({ 'sprints._id': oid });
    if (!project) return [];

    const sprint = (project.sprints ?? []).find((s: any) => s._id.toString() === sprintId);
    if (!sprint) return [];

    return (sprint.issues ?? []).map((i: EmbeddedIssue) => ({
      ...i,
      projectId: project._id.toString(),
      sprintId: oid,
    }));
  },

  // Move multiple issues (by id) into a sprint in bulk.
  async bulkAssignToSprint(sprintId: string, issueIds: string[]): Promise<void> {
    if (!ObjectId.isValid(sprintId)) return;
    for (const id of issueIds) {
      if (ObjectId.isValid(id)) {
        await this.assignToSprint(id, sprintId);
      }
    }
  },

  // Move ALL issues of a sprint back to the project backlog (used before deleting a sprint).
  async unassignAllFromSprint(sprintId: string): Promise<boolean> {
    if (!ObjectId.isValid(sprintId)) return false;
    const db = await getDb();
    const oid = new ObjectId(sprintId);

    const project = await db.collection('projects').findOne({ 'sprints._id': oid });
    if (!project) return false;

    const sprint = (project.sprints ?? []).find((s: any) => s._id.toString() === sprintId);
    if (!sprint || !sprint.issues?.length) return true; // nothing to move

    // Push all sprint issues into backlog and clear the sprint's issues array atomically
    await db.collection('projects').updateOne(
      { _id: project._id, 'sprints._id': oid },
      {
        $push: { backlog: { $each: sprint.issues } } as any,
        $set: { 'sprints.$.issues': [] }
      }
    );

    return true;
  },
};
