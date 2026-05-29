import { ObjectId } from 'mongodb';
import { getDb } from '../db/mongo';

export interface ImportError {
  row: number;
  field: string;
  message: string;
}

export type ImportStatus = 'success' | 'partial' | 'failed';

export interface ImportLog {
  _id?: ObjectId;
  type: string;
  status: ImportStatus;
  importedBy: ObjectId;
  totalRows: number;
  insertedRows: number;
  skippedRows: number;
  errors: ImportError[];
  createdAt: Date;
}

const COLLECTION = 'imports';

export const ImportRepo = {
  async createImportLog(data: Omit<ImportLog, '_id' | 'createdAt'>) {
    const db = await getDb();
    const doc: ImportLog = {
      ...data,
      createdAt: new Date(),
    };
    const result = await db.collection<ImportLog>(COLLECTION).insertOne(doc as any);
    return { ...doc, _id: result.insertedId };
  },

  async findRecentImportLogs(limit = 10) {
    const db = await getDb();
    return db.collection<ImportLog>(COLLECTION)
      .find()
      .sort({ createdAt: -1 })
      .limit(limit)
      .toArray();
  },

  async findByUser(userId: string | ObjectId, limit = 10) {
    const db = await getDb();
    const uId = typeof userId === 'string' ? new ObjectId(userId) : userId;
    return db.collection<ImportLog>(COLLECTION)
      .find({ importedBy: uId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .toArray();
  },
};
