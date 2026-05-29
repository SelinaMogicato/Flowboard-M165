import 'dotenv/config';
import { getDb, closeDb } from './mongo';

export async function ensureIndexes() {
  const db = await getDb();
  console.log("Ensuring indexes...");

  // Users - unique email so no two accounts share the same address
  await db.collection('users').createIndex({ email: 1 }, { unique: true });

  // Sessions - fast token lookup and automatic TTL expiry
  await db.collection('sessions').createIndex({ tokenHash: 1 }, { unique: true });
  await db.collection('sessions').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });

  // Projects
  await db.collection('projects').createIndex({ createdAt: -1 });

  // Project members - one membership record per user per project
  await db.collection('projectMembers').createIndex(
    { projectId: 1, userId: 1 },
    { unique: true }
  );

  // Issues - board loads issues grouped by list and ordered by position
  await db.collection('issues').createIndex({ projectId: 1, status: 1 });
  await db.collection('issues').createIndex({ createdAt: -1 });
  await db.collection('issues').createIndex({ projectId: 1, listId: 1, order: 1 });
  await db.collection('issues').createIndex({ projectId: 1, sprintId: 1 });

  // Sprints
  await db.collection('sprints').createIndex({ projectId: 1, status: 1 });
  await db.collection('sprints').createIndex({ createdAt: -1 });

  console.log("Indexes created successfully.");
  await closeDb();
}

// Allow running directly via node if needed (e.g. "npm run db:indexes")
// We check if this module is being run directly (es-module equivalent of require.main === module)
// However, since we are in a module system, simpler is to just have a script file import and call it.
// We'll rely on the dedicated script calling this function or this file being executed.

/*
// If executed directly by tsx as entry point
if (import.meta.url === `file://${process.argv[1]}`) {
  ensureIndexes().catch(console.error);
}
*/
