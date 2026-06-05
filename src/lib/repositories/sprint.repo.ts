// Sprints are embedded inside the project document (project.sprints[]).
// All operations read/write via the projects collection using $push/$pull/$set with arrayFilters.

import { ObjectId } from 'mongodb';
import { getDb } from '../db/mongo';
import type { EmbeddedSprint, EmbeddedIssue, SprintStatus } from './project.repo';

// Sprint as returned to callers: includes virtual projectId for permission checks
export interface Sprint extends EmbeddedSprint {
  projectId: string;
}

export type { SprintStatus } from './project.repo';

export const SprintRepo = {
  // Return all sprints for a project (without their issue arrays for lighter payloads)
  async findAllByProject(projectId: string): Promise<Sprint[]> {
    const db = await getDb();
    if (!ObjectId.isValid(projectId)) return [];
    const project = await db.collection('projects').findOne(
      { _id: new ObjectId(projectId) },
      { projection: { sprints: 1 } }
    );
    if (!project) return [];
    return (project.sprints ?? []).map((s: EmbeddedSprint) => ({ ...s, projectId }));
  },

  // Find a sprint by its _id, searching across all projects
  async findById(sprintId: string): Promise<Sprint | null> {
    if (!ObjectId.isValid(sprintId)) return null;
    const db = await getDb();
    const oid = new ObjectId(sprintId);

    // positional projection returns the matched sprint in sprints[0]
    const project = await db.collection('projects').findOne(
      { 'sprints._id': oid },
      { projection: { 'sprints.$': 1 } }
    );
    if (!project?.sprints?.[0]) return null;
    return { ...project.sprints[0], projectId: project._id.toString() };
  },

  // Return the single active sprint for a project, or null
  async findActiveSprint(projectId: string): Promise<Sprint | null> {
    if (!ObjectId.isValid(projectId)) return null;
    const db = await getDb();
    const project = await db.collection('projects').findOne(
      { _id: new ObjectId(projectId), 'sprints.status': 'active' },
      { projection: { 'sprints.$': 1 } }
    );
    if (!project?.sprints?.[0]) return null;
    return { ...project.sprints[0], projectId };
  },

  async create(projectId: string, data: Omit<EmbeddedSprint, '_id' | 'issues' | 'createdAt' | 'updatedAt'>): Promise<Sprint> {
    const db = await getDb();
    const sprintDoc: EmbeddedSprint = {
      _id: new ObjectId(),
      ...data,
      status: data.status ?? 'planned',
      issues: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await db.collection('projects').updateOne(
      { _id: new ObjectId(projectId) },
      {
        $push: { sprints: sprintDoc } as any,
        $set: { updatedAt: new Date() }
      }
    );

    return { ...sprintDoc, projectId };
  },

  async update(sprintId: string, data: Partial<Omit<EmbeddedSprint, '_id' | 'issues'>>): Promise<Sprint | null> {
    if (!ObjectId.isValid(sprintId)) return null;
    const db = await getDb();
    const oid = new ObjectId(sprintId);

    // Build $set path for every provided field using arrayFilters
    const setOps: Record<string, any> = { 'sprints.$[s].updatedAt': new Date() };
    const allowed: (keyof typeof data)[] = ['name', 'goal', 'status', 'startDate', 'endDate'];
    for (const key of allowed) {
      if (data[key] !== undefined) {
        setOps[`sprints.$[s].${key}`] = data[key];
      }
    }

    await db.collection('projects').updateOne(
      { 'sprints._id': oid },
      { $set: setOps },
      { arrayFilters: [{ 's._id': oid }] }
    );

    return this.findById(sprintId);
  },

  async updateStatus(sprintId: string, status: SprintStatus): Promise<Sprint | null> {
    return this.update(sprintId, { status });
  },

  // Delete a sprint by _id; the caller must move issues to backlog first
  async delete(sprintId: string): Promise<boolean> {
    if (!ObjectId.isValid(sprintId)) return false;
    const db = await getDb();
    const oid = new ObjectId(sprintId);
    const result = await db.collection('projects').updateOne(
      { 'sprints._id': oid },
      { $pull: { sprints: { _id: oid } } as any }
    );
    return result.modifiedCount > 0;
  }
};
