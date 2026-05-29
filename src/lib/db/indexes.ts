import 'dotenv/config';
import { getDb, closeDb } from './mongo';

export async function ensureIndexes() {
  const db = await getDb();
  console.log("Ensuring indexes...");

  // Projects
  await db.collection('projects').createIndex({ createdAt: -1 });

  // Issues
  await db.collection('issues').createIndex({ projectId: 1, status: 1 });
  await db.collection('issues').createIndex({ createdAt: -1 });

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
