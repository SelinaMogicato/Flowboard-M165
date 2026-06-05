import { ObjectId } from 'mongodb';
import { getDb } from '../db/mongo';

export type Priority = 'Low' | 'Medium' | 'High';
export type SprintStatus = 'planned' | 'active' | 'completed';

export interface ProjectList {
  id: string;
  title: string;
  order: number;
  color?: string;
}

// Issue embedded inside a sprint or the project backlog
export interface EmbeddedIssue {
  _id: ObjectId;
  listId: string;
  title: string;
  description?: string;
  priority: Priority;
  order: number;
  labels?: string[];
  assignee?: string;
  createdAt: Date;
  updatedAt: Date;
}

// Sprint embedded inside the project, contains its own issues
export interface EmbeddedSprint {
  _id: ObjectId;
  name: string;
  goal?: string;
  status: SprintStatus;
  startDate?: Date;
  endDate?: Date;
  issues: EmbeddedIssue[];
  createdAt: Date;
  updatedAt: Date;
}

export interface Project {
  _id?: ObjectId;
  name: string;
  description?: string;
  repositoryUrl?: string;
  ownerId: ObjectId;
  lists: ProjectList[];
  sprints?: EmbeddedSprint[];  // embedded sprints – each carries its own issues array
  backlog?: EmbeddedIssue[];   // issues not yet assigned to any sprint
  isArchived?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const COLLECTION = 'projects';

export const ProjectRepo = {
  async listVisibleProjectsForUser(userId: string | ObjectId, includeArchived = false, limit = 50) {
    const db = await getDb();
    const uId = typeof userId === 'string' ? new ObjectId(userId) : userId;

    const memberProjects = await db.collection('projectMembers').find({ userId: uId }).project({ projectId: 1 }).toArray();
    const memberProjectIds = memberProjects.map(mp => mp.projectId);

    const query: any = {
      $or: [
        { ownerId: uId },
        { _id: { $in: memberProjectIds } }
      ]
    };

    if (!includeArchived) {
      query.isArchived = { $ne: true };
    }

    return db.collection<Project>(COLLECTION)
      .find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .toArray();
  },

  async findAll(includeArchived = false, limit = 50, ids?: ObjectId[]) {
    const db = await getDb();
    const query: any = includeArchived ? { isArchived: true } : { isArchived: { $ne: true } };

    if (ids) {
      query._id = { $in: ids };
    }

    return db.collection<Project>(COLLECTION)
      .find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .toArray();
  },

  async findById(id: string) {
    const db = await getDb();
    if (!ObjectId.isValid(id)) return null;
    return db.collection<Project>(COLLECTION).findOne({ _id: new ObjectId(id) });
  },

  async create(data: Omit<Project, '_id' | 'createdAt' | 'updatedAt'>) {
    const db = await getDb();
    const doc: Project = {
      ...data,
      sprints: data.sprints ?? [],
      backlog: data.backlog ?? [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const result = await db.collection<Project>(COLLECTION).insertOne(doc as any);
    return { ...doc, _id: result.insertedId };
  },

  async update(id: string, data: Partial<Project>) {
    const db = await getDb();
    if (!ObjectId.isValid(id)) return null;

    const updateData = { ...data, updatedAt: new Date() };
    delete (updateData as any)._id;

    const result = await db.collection<Project>(COLLECTION).findOneAndUpdate(
      { _id: new ObjectId(id) },
      { $set: updateData },
      { returnDocument: 'after' }
    );
    return result;
  },

  async delete(id: string) {
    const db = await getDb();
    if (!ObjectId.isValid(id)) return false;
    const result = await db.collection(COLLECTION).deleteOne({ _id: new ObjectId(id) });
    return result.deletedCount === 1;
  }
};
