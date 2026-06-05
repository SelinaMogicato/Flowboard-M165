// Migration: flatten sprints and issues into the project document.
//
// BEFORE (3 collections):
//   projects   { _id, name, lists, … }
//   sprints    { _id, projectId, name, status, … }
//   issues     { _id, projectId, sprintId, listId, title, … }
//
// AFTER (1 collection):
//   projects   { _id, name, lists, sprints: [{ …, issues: [] }], backlog: [] }
//
// The script is idempotent: projects that already have a `backlog` field are skipped.
// Run with:  npx tsx scripts/migrate-embed-sprints-issues.ts

import 'dotenv/config';

const { getDb, closeDb } = await import('../src/lib/db/mongo');
const { ObjectId } = await import('mongodb');

async function run() {
  const db = await getDb();

  // -------------------------------------------------------
  // 1. Load everything we need up-front
  // -------------------------------------------------------
  const allProjects = await db.collection('projects').find({}).toArray();
  const allSprints  = await db.collection('sprints').find({}).toArray();
  const allIssues   = await db.collection('issues').find({}).sort({ order: 1 }).toArray();

  console.log(`Found: ${allProjects.length} projects, ${allSprints.length} sprints, ${allIssues.length} issues`);

  let migratedProjects = 0;
  let skippedProjects  = 0;

  for (const project of allProjects) {
    const projectId = project._id.toString();

    // Skip if already migrated (backlog field already present)
    if (project.backlog !== undefined) {
      console.log(`  SKIP  ${projectId} "${project.name}" (already migrated)`);
      skippedProjects++;
      continue;
    }

    // -------------------------------------------------------
    // 2. Build embedded sprint documents for this project
    //    (strip projectId – it's now implicit; add issues: [])
    // -------------------------------------------------------
    const projectSprints = allSprints
      .filter(s => s.projectId?.toString() === projectId || s.projectId === projectId)
      .map(s => {
        const { projectId: _pid, ...rest } = s;
        return { ...rest, issues: [] };
      });

    // -------------------------------------------------------
    // 3. Distribute issues into sprint.issues[] or backlog[]
    // -------------------------------------------------------
    const backlog: any[] = [];

    const projectIssues = allIssues.filter(
      i => i.projectId?.toString() === projectId || i.projectId === projectId
    );

    for (const issue of projectIssues) {
      // Strip virtual/foreign-key fields – they are now implicit from document location
      const { projectId: _pid, sprintId, ...issueFields } = issue;

      const embedded = { ...issueFields };

      if (sprintId) {
        const sprintIdStr = sprintId.toString();
        const sprint = projectSprints.find(s => s._id.toString() === sprintIdStr);
        if (sprint) {
          sprint.issues.push(embedded);
        } else {
          // Sprint not found for this project – fall back to backlog
          console.warn(`    WARN issue "${issue.title}" references unknown sprint ${sprintIdStr} – putting in backlog`);
          backlog.push(embedded);
        }
      } else {
        backlog.push(embedded);
      }
    }

    // -------------------------------------------------------
    // 4. Write the embedded arrays into the project document
    // -------------------------------------------------------
    await db.collection('projects').updateOne(
      { _id: project._id },
      { $set: { sprints: projectSprints, backlog, updatedAt: new Date() } }
    );

    const issueCount  = projectIssues.length;
    const sprintCount = projectSprints.length;
    console.log(`  DONE  ${projectId} "${project.name}" – ${sprintCount} sprint(s), ${issueCount} issue(s) (${backlog.length} in backlog)`);
    migratedProjects++;
  }

  console.log(`\nMigration complete: ${migratedProjects} migrated, ${skippedProjects} skipped.`);

  // -------------------------------------------------------
  // 5. Verify counts before dropping old collections
  // -------------------------------------------------------
  const embeddedIssueCount = await db.collection('projects').aggregate([
    { $project: {
        sprintIssues: {
          $reduce: { input: '$sprints', initialValue: [], in: { $concatArrays: ['$$value', { $ifNull: ['$$this.issues', []] }] } }
        },
        backlogCount: { $size: { $ifNull: ['$backlog', []] } }
    }},
    { $project: { total: { $add: [{ $size: '$sprintIssues' }, '$backlogCount'] } } },
    { $group: { _id: null, sum: { $sum: '$total' } } }
  ]).toArray();

  const migratedTotal = embeddedIssueCount[0]?.sum ?? 0;
  const originalTotal = allIssues.length;

  if (migratedTotal !== originalTotal) {
    console.error(`\nERROR: issue count mismatch – original: ${originalTotal}, embedded: ${migratedTotal}`);
    console.error('Old collections have NOT been dropped. Fix the mismatch before re-running.');
    await closeDb();
    process.exit(1);
  }

  console.log(`\nIssue count verified: ${migratedTotal} / ${originalTotal} ✓`);

  // -------------------------------------------------------
  // 6. Drop old collections now that data is embedded
  // -------------------------------------------------------
  const collectionNames = (await db.listCollections().toArray()).map(c => c.name);

  if (collectionNames.includes('issues')) {
    await db.collection('issues').drop();
    console.log('Dropped collection: issues');
  }
  if (collectionNames.includes('sprints')) {
    await db.collection('sprints').drop();
    console.log('Dropped collection: sprints');
  }

  console.log('\nAll done. MongoDB now uses the embedded document model.');

  await closeDb();
  process.exit(0);
}

run().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
