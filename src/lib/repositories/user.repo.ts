import { ObjectId } from 'mongodb';
import { getDb } from '../db/mongo';

export interface User {
  _id?: ObjectId;
  email: string;
  name?: string;
  passwordHash: string;
  createdAt: Date;
  updatedAt: Date;
}

const COLLECTION = 'users';

export async function findUserByEmail(email: string): Promise<User | null> {
  const db = await getDb();
  return db.collection<User>(COLLECTION).findOne({ email: email.toLowerCase() });
}

export async function createUser(user: Omit<User, '_id' | 'createdAt' | 'updatedAt'>): Promise<User> {
  const db = await getDb();
  const now = new Date();
  const newUser: User = {
    ...user,
    email: user.email.toLowerCase(),
    createdAt: now,
    updatedAt: now,
  };
  
  const result = await db.collection<User>(COLLECTION).insertOne(newUser as any);
  newUser._id = result.insertedId;
  return newUser;
}

export async function findUserById(id: string | ObjectId): Promise<User | null> {
  const db = await getDb();
  let _id: ObjectId;
  try {
    _id = typeof id === 'string' ? new ObjectId(id) : id;
  } catch (e) {
    return null; // Invalid ID format
  }
  return db.collection<User>(COLLECTION).findOne({ _id });
}

export async function updateUserName(id: string | ObjectId, name: string): Promise<boolean> {
  const db = await getDb();
  const _id = typeof id === 'string' ? new ObjectId(id) : id;
  const result = await db.collection<User>(COLLECTION).updateOne(
    { _id },
    { 
      $set: { 
        name,
        updatedAt: new Date()
      } 
    }
  );
  return result.matchedCount > 0;
}

export async function updateUserPassword(id: string | ObjectId, passwordHash: string): Promise<boolean> {
  const db = await getDb();
  const _id = typeof id === 'string' ? new ObjectId(id) : id;
  const result = await db.collection<User>(COLLECTION).updateOne(
    { _id },
    { 
      $set: { 
        passwordHash,
        updatedAt: new Date()
      } 
    }
  );
  return result.matchedCount > 0;
}

export async function ensureUserIndexes() {
  const db = await getDb();
  await db.collection(COLLECTION).createIndex({ email: 1 }, { unique: true });
}
