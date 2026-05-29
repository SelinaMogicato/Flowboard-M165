
import { ObjectId } from 'mongodb';
import { getDb } from '../db/mongo';

export type Priority = 'Low' | 'Medium' | 'High';

export interface Issue {
  _id?: ObjectId;
  projectId: string; // Stored as string to match project.repo, though ObjectId is better in DB
  listId: string;
  sprintId?: ObjectId | null; // Added for Sprint Management
  title: string;
  description?: string;
  priority: Priority;
  order: number;
  labels?: string[];
  assignee?: string;
  createdAt: Date;
  updatedAt: Date;
}

const COLLECTION = 'issues';

export const IssueRepo = {
  async findAllByProject(projectId: string, filter: any = {}) {
    const db = await getDb();
    const query = { projectId, ...filter };
    return db.collection<Issue>(COLLECTION)
      .find(query)
      .sort({ order: 1 }) // Default sort by order
      .toArray();
  },

  async findById(id: string) {
    const db = await getDb();
    if (!ObjectId.isValid(id)) return null;
    return db.collection<Issue>(COLLECTION).findOne({ _id: new ObjectId(id) });
  },

  async create(data: Omit<Issue, '_id' | 'createdAt' | 'updatedAt'>) {
    const db = await getDb();
    const doc: Issue = {
      ...data,
      priority: data.priority || 'Medium',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const result = await db.collection<Issue>(COLLECTION).insertOne(doc as any);
    return { ...doc, _id: result.insertedId };
  },

  async update(id: string, updates: Partial<Omit<Issue, '_id' | 'createdAt'>>) {
    const db = await getDb();
    if (!ObjectId.isValid(id)) return null;
    
    const result = await db.collection<Issue>(COLLECTION).updateOne(
      { _id: new ObjectId(id) },
      { 
        $set: {
          ...updates,
          updatedAt: new Date(),
        } 
      }
    );
    
    if (result.matchedCount === 0) return null;
    return this.findById(id);
  },

  async delete(id: string) {
    const db = await getDb();
    if (!ObjectId.isValid(id)) return false;
    const result = await db.collection<Issue>(COLLECTION).deleteOne({ _id: new ObjectId(id) });
    return result.deletedCount === 1;
  },

  async assignToSprint(issueId: string, sprintId: string) {
    const db = await getDb();
    if (!ObjectId.isValid(issueId) || !ObjectId.isValid(sprintId)) return null;
    return db.collection<Issue>(COLLECTION).updateOne(
      { _id: new ObjectId(issueId) },
      { $set: { sprintId: new ObjectId(sprintId), updatedAt: new Date() } }
    );
  },

  async removeFromSprint(issueId: string) {
    const db = await getDb();
    if (!ObjectId.isValid(issueId)) return null;
    return db.collection<Issue>(COLLECTION).updateOne(
      { _id: new ObjectId(issueId) },
      { $set: { sprintId: null, updatedAt: new Date() } }
    );
  },

  async findAllBySprint(sprintId: string) {
    const db = await getDb();
    if (!ObjectId.isValid(sprintId)) return [];
    return db.collection<Issue>(COLLECTION)
      .find({ sprintId: new ObjectId(sprintId) })
      .toArray();
  },

  async bulkAssignToSprint(sprintId: string, issueIds: string[]) {
    const db = await getDb();
    if (!ObjectId.isValid(sprintId)) return null;
    const objectIds = issueIds.map(id => ObjectId.isValid(id) ? new ObjectId(id) : null).filter(id => id !== null) as ObjectId[];
    if (objectIds.length === 0) return null;

    return db.collection<Issue>(COLLECTION).updateMany(
      { _id: { $in: objectIds } },
      { $set: { sprintId: new ObjectId(sprintId), updatedAt: new Date() } }
    );
  },

  async unassignAllFromSprint(sprintId: string) {
    const db = await getDb();
    if (!ObjectId.isValid(sprintId)) return null;

    return db.collection<Issue>(COLLECTION).updateMany(
      { sprintId: new ObjectId(sprintId) },
      { $set: { sprintId: null, updatedAt: new Date() } }
    );
  },
};
