import { ObjectId } from 'mongodb';
import { getDb } from '../db/mongo';

export interface ProjectMember {
  _id?: ObjectId;
  projectId: ObjectId;
  userId: ObjectId;
  role: "owner" | "member";
  invitedBy?: ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const COLLECTION = 'projectMembers';

export const ProjectMemberRepo = {
  async ensureIndexes() {
    const db = await getDb();
    await db.collection(COLLECTION).createIndex({ projectId: 1, userId: 1 }, { unique: true });
    await db.collection(COLLECTION).createIndex({ projectId: 1 });
    await db.collection(COLLECTION).createIndex({ userId: 1 });
  },

  async addMember(member: Omit<ProjectMember, '_id' | 'createdAt' | 'updatedAt'>) {
    const db = await getDb();
    const now = new Date();
    const newMember = {
      ...member,
      createdAt: now,
      updatedAt: now
    };
    return await db.collection<ProjectMember>(COLLECTION).insertOne(newMember as any);
  },

  async removeMember(projectId: string | ObjectId, userId: string | ObjectId) {
    const db = await getDb();
    const pId = typeof projectId === 'string' ? new ObjectId(projectId) : projectId;
    const uId = typeof userId === 'string' ? new ObjectId(userId) : userId;
    
    return await db.collection<ProjectMember>(COLLECTION).deleteOne({
      projectId: pId,
      userId: uId
    });
  },

  async getMembers(projectId: string | ObjectId) {
    const db = await getDb();
    const pId = typeof projectId === 'string' ? new ObjectId(projectId) : projectId;

    return await db.collection<ProjectMember>(COLLECTION).aggregate([
      { $match: { projectId: pId } },
      {
        $lookup: {
          from: 'users',
          localField: 'userId',
          foreignField: '_id',
          as: 'user'
        }
      },
      { $unwind: '$user' },
      {
        $project: {
          _id: 1,
          projectId: 1,
          userId: 1,
          role: 1,
          createdAt: 1,
          user: {
            _id: '$user._id',
            name: '$user.name',
            email: '$user.email'
          }
        }
      }
    ]).toArray();
  },

  async getMember(projectId: string | ObjectId, userId: string | ObjectId) {
    const db = await getDb();
    const pId = typeof projectId === 'string' ? new ObjectId(projectId) : projectId;
    const uId = typeof userId === 'string' ? new ObjectId(userId) : userId;
    
    return await db.collection<ProjectMember>(COLLECTION).findOne({
      projectId: pId,
      userId: uId
    });
  },

  async isProjectOwner(projectId: string | ObjectId, userId: string | ObjectId): Promise<boolean> {
    const member = await this.getMember(projectId, userId);
    return member?.role === 'owner';
  },

  async isProjectMember(projectId: string | ObjectId, userId: string | ObjectId): Promise<boolean> {
    const member = await this.getMember(projectId, userId);
    return !!member;
  },

  async getProjectIdsForUser(userId: string | ObjectId): Promise<ObjectId[]> {
    const db = await getDb();
    const uId = typeof userId === 'string' ? new ObjectId(userId) : userId;
    const members = await db.collection<ProjectMember>(COLLECTION).find({ userId: uId }).toArray();
    return members.map(m => m.projectId);
  }
};
