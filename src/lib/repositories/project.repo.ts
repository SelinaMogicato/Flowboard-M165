// Explanation: This repository is responsible for direct database interactions for Projects.
// It uses the MongoDB driver to find, insert, update, and delete project documents in the 'projects' collection.

import { ObjectId } from 'mongodb';
import { getDb } from '../db/mongo';

export interface ProjectList {
  id: string;
  title: string;
  order: number;
  color?: string;
}

export interface Project {
  _id?: ObjectId;
  name: string;
  description?: string;
  repositoryUrl?: string;
  ownerId: ObjectId; // Added ownerId
  lists: ProjectList[];
  isArchived?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const COLLECTION = 'projects';

export const ProjectRepo = {
  // Find only projects visible to the user: owned OR invited
  async listVisibleProjectsForUser(userId: string | ObjectId, includeArchived = false, limit = 50) {
    const db = await getDb();
    const uId = typeof userId === 'string' ? new ObjectId(userId) : userId;
    
    // 1. Get project IDs where user is a member
    const memberProjects = await db.collection('projectMembers').find({ userId: uId }).project({ projectId: 1 }).toArray();
    const memberProjectIds = memberProjects.map(mp => mp.projectId);

    // 2. Query projects: OR(ownerId == user, _id IN memberProjectIds)
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
    // Legacy findAll, can be kept for backward compatibility or refactored out.
    // For now, let's keep it but advise using listVisibleProjectsForUser for user-scoped queries.
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
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const result = await db.collection<Project>(COLLECTION).insertOne(doc as any);
    return { ...doc, _id: result.insertedId };
  },

  async update(id: string, data: Partial<Project>) {
    const db = await getDb();
    if (!ObjectId.isValid(id)) return null;
    
    const updateData = {
      ...data,
      updatedAt: new Date()
    };
    delete (updateData as any)._id; // prevent updating _id

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
