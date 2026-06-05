import 'dotenv/config';
import { getDb, closeDb } from './mongo';

export async function ensureIndexes() {
  const db = await getDb();
  console.log('Ensuring indexes...');

  // Users – unique email
  await db.collection('users').createIndex({ email: 1 }, { unique: true });

  // Sessions – fast token lookup + automatic TTL expiry
  await db.collection('sessions').createIndex({ tokenHash: 1 }, { unique: true });
  await db.collection('sessions').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });

  // Projects – sort by newest first; index embedded sprint/issue _ids for $elemMatch queries
  await db.collection('projects').createIndex({ createdAt: -1 });
  await db.collection('projects').createIndex({ 'sprints._id': 1 });
  await db.collection('projects').createIndex({ 'sprints.issues._id': 1 });
  await db.collection('projects').createIndex({ 'backlog._id': 1 });

  // Project members – one membership record per user per project
  await db.collection('projectMembers').createIndex(
    { projectId: 1, userId: 1 },
    { unique: true }
  );

  console.log('Indexes created successfully.');
  await closeDb();
}
