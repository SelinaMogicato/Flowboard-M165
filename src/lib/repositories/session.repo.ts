import { ObjectId } from 'mongodb';
import { getDb } from '../db/mongo';

export interface Session {
  _id?: ObjectId;
  userId: ObjectId;
  tokenHash: string;
  createdAt: Date;
  expiresAt: Date;
  revokedAt?: Date;
  userAgent?: string;
  ip?: string;
}

const COLLECTION = 'sessions';

export async function createSession(session: Omit<Session, '_id'>): Promise<Session> {
  const db = await getDb();
  const result = await db.collection<Session>(COLLECTION).insertOne(session as any);
  return { ...session, _id: result.insertedId };
}

export async function findValidSessionByTokenHash(tokenHash: string): Promise<Session | null> {
  const db = await getDb();
  return db.collection<Session>(COLLECTION).findOne({
    tokenHash,
    expiresAt: { $gt: new Date() },
    revokedAt: { $exists: false },
  });
}

export async function revokeByTokenHash(tokenHash: string): Promise<void> {
  const db = await getDb();
  await db.collection(COLLECTION).updateOne(
    { tokenHash },
    { $set: { revokedAt: new Date() } }
  );
}

export async function ensureSessionIndexes() {
  const db = await getDb();
  await db.collection(COLLECTION).createIndex({ userId: 1 });
  await db.collection(COLLECTION).createIndex({ tokenHash: 1 }, { unique: true });
  await db.collection(COLLECTION).createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
}
