
import { ObjectId } from 'mongodb';
import { getDb } from '../db/mongo';

export type SprintStatus = 'planned' | 'active' | 'completed';

export interface Sprint {
  _id?: ObjectId;
  projectId: string; // Matching other repos where projectId is string
  name: string;
  goal?: string;
  status: SprintStatus;
  startDate?: Date;
  endDate?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const COLLECTION = 'sprints';

export const SprintRepo = {
  async findAllByProject(projectId: string) {
    const db = await getDb();
    return db.collection<Sprint>(COLLECTION)
      .find({ projectId })
      .sort({ createdAt: -1 })
      .toArray();
  },

  async findById(id: string) {
    const db = await getDb();
    if (!ObjectId.isValid(id)) return null;
    return db.collection<Sprint>(COLLECTION).findOne({ _id: new ObjectId(id) });
  },

  async findActiveSprint(projectId: string) {
    const db = await getDb();
    return db.collection<Sprint>(COLLECTION).findOne({ projectId, status: 'active' });
  },

  async create(data: Omit<Sprint, '_id' | 'createdAt' | 'updatedAt'>) {
    const db = await getDb();
    const doc: Sprint = {
      ...data,
      status: data.status || 'planned',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const result = await db.collection<Sprint>(COLLECTION).insertOne(doc as any);
    return { ...doc, _id: result.insertedId };
  },

  async updateStatus(id: string, status: SprintStatus) {
    const db = await getDb();
    if (!ObjectId.isValid(id)) return null;
    
    await db.collection<Sprint>(COLLECTION).updateOne(
      { _id: new ObjectId(id) },
      { 
        $set: { 
          status, 
          updatedAt: new Date() 
        } 
      }
    );
    return this.findById(id);
  },

  async update(id: string, data: Partial<Sprint>) {
      const db = await getDb();
      if (!ObjectId.isValid(id)) return null;

      await db.collection<Sprint>(COLLECTION).updateOne(
          { _id: new ObjectId(id) },
          {
              $set: {
                  ...data,
                  updatedAt: new Date()
              }
          }
      );
      return this.findById(id);
  },

  async delete(id: string) {
    const db = await getDb();
    if (!ObjectId.isValid(id)) return null;
    return db.collection<Sprint>(COLLECTION).deleteOne({ _id: new ObjectId(id) });
  }
};
