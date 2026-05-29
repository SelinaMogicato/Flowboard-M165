import 'dotenv/config';

// Top-level dynamic imports follow the same pattern as scripts/create-admin.ts
const { findUserByEmail, createUser } = await import('../src/lib/repositories/user.repo');
const { hashPassword } = await import('../src/lib/auth/password');
const { ProjectRepo } = await import('../src/lib/repositories/project.repo');
const { ProjectMemberRepo } = await import('../src/lib/repositories/project-member.repo');
const { SprintRepo } = await import('../src/lib/repositories/sprint.repo');
const { IssueRepo } = await import('../src/lib/repositories/issue.repo');
const { ImportRepo } = await import('../src/lib/repositories/import.repo');
const { getDb, closeDb } = await import('../src/lib/db/mongo');
const { v4: uuidv4 } = await import('uuid');
const { ObjectId } = await import('mongodb');

const DEMO_EMAIL = 'demo@flowboard.app';
const DEMO_PASSWORD = 'demo1234';
const DEMO_PROJECT_NAME = 'Demo Project';
const DEMO_SPRINT_NAME = 'Demo Sprint 1';

const DEMO_ISSUES = [
  {
    title: 'Set up project structure',
    priority: 'High' as const,
    description: 'Initialize the repo and folder structure for the project.',
  },
  {
    title: 'Design the database schema',
    priority: 'High' as const,
    description: 'Decide on collections and how data should be structured in MongoDB.',
  },
  {
    title: 'Create login page',
    priority: 'Medium' as const,
    description: 'Build the login form with validation and error handling.',
  },
  {
    title: 'Add user registration',
    priority: 'Medium' as const,
    description: 'Allow new users to create accounts with email and password.',
  },
  {
    title: 'Implement Kanban board',
    priority: 'High' as const,
    description: 'Drag-and-drop board with lists and issue cards.',
  },
  {
    title: 'Add sprint planning view',
    priority: 'Medium' as const,
    description: 'A page for managing sprints and assigning issues.',
  },
  {
    title: 'Write unit tests',
    priority: 'Low' as const,
    description: 'Cover the key service functions with basic tests.',
  },
  {
    title: 'Fix navigation bug on mobile',
    priority: 'Low' as const,
    description: 'The sidebar does not close after clicking a link on mobile.',
  },
  {
    title: 'Deploy to staging environment',
    priority: 'Medium' as const,
    description: 'Set up Docker and deploy the app to a staging server.',
  },
  {
    title: 'Write project documentation',
    priority: 'Low' as const,
    description: 'Document the data model and architecture decisions.',
  },
];

async function run() {
  console.log('Running demo data seed...');

  try {
    if (!process.env.MONGODB_URI) {
      throw new Error('MONGODB_URI is not set. Check your .env file.');
    }

    // Step 1: Demo user - skip if already exists
    let user = await findUserByEmail(DEMO_EMAIL);
    if (!user) {
      const passwordHash = await hashPassword(DEMO_PASSWORD);
      user = await createUser({
        email: DEMO_EMAIL,
        name: 'Demo User',
        passwordHash,
      });
      console.log(`Created demo user: ${user.email} (${user._id})`);
    } else {
      console.log(`Demo user already exists: ${user.email}`);
    }

    const userId = user._id!;

    // Step 2: Demo project - find existing or create new
    const db = await getDb();
    let projectDoc = await db.collection('projects').findOne({ name: DEMO_PROJECT_NAME });

    if (!projectDoc) {
      const lists = [
        { id: uuidv4(), title: 'Backlog', order: 0, color: '#6b7280' },
        { id: uuidv4(), title: 'In Progress', order: 1, color: '#6b7280' },
        { id: uuidv4(), title: 'Done', order: 2, color: '#6b7280' },
      ];

      projectDoc = await ProjectRepo.create({
        name: DEMO_PROJECT_NAME,
        description: 'This project was created by the seed script. It shows how demo data is imported into MongoDB.',
        lists,
        ownerId: new ObjectId(userId.toString()),
      });

      // Add owner as project member
      if (projectDoc._id) {
        await ProjectMemberRepo.addMember({
          projectId: new ObjectId(projectDoc._id.toString()),
          userId: new ObjectId(userId.toString()),
          role: 'owner',
          invitedBy: new ObjectId(userId.toString()),
        });
      }

      console.log(`Created demo project: ${projectDoc.name} (${projectDoc._id})`);
    } else {
      console.log(`Demo project already exists: ${projectDoc.name}`);
    }

    const projectId = projectDoc._id!.toString();
    const backlogList = projectDoc.lists?.find((l: any) => l.title === 'Backlog');
    if (!backlogList) {
      throw new Error('No Backlog list found in demo project.');
    }

    // Step 3: Demo sprint - skip if already exists
    const sprints = await SprintRepo.findAllByProject(projectId);
    let sprint = sprints.find(s => s.name === DEMO_SPRINT_NAME);
    if (!sprint) {
      sprint = await SprintRepo.create({
        projectId,
        name: DEMO_SPRINT_NAME,
        goal: 'Ship the first working version with core features.',
        status: 'planned',
        startDate: new Date(),
        endDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      });
      console.log(`Created demo sprint: ${sprint.name}`);
    } else {
      console.log(`Demo sprint already exists: ${sprint.name}`);
    }

    // Step 4: Demo issues - skip issues that already exist in the backlog
    const existingIssues = await IssueRepo.findAllByProject(projectId, { listId: backlogList.id });
    const existingTitles = new Set(existingIssues.map((i: any) => i.title));

    let insertedCount = 0;
    let skippedCount = 0;

    for (const demo of DEMO_ISSUES) {
      if (existingTitles.has(demo.title)) {
        console.log(`  Skipping duplicate: "${demo.title}"`);
        skippedCount++;
        continue;
      }

      const order = existingIssues.length + insertedCount;
      await IssueRepo.create({
        projectId,
        listId: backlogList.id,
        title: demo.title,
        priority: demo.priority,
        order,
        description: demo.description,
        labels: [],
        sprintId: null,
      });

      console.log(`  Inserted: "${demo.title}"`);
      insertedCount++;
    }

    // Step 5: Write import log
    await ImportRepo.createImportLog({
      type: 'seed-demo-data',
      status: insertedCount === 0 ? 'failed' : skippedCount > 0 ? 'partial' : 'success',
      importedBy: new ObjectId(userId.toString()),
      totalRows: DEMO_ISSUES.length,
      insertedRows: insertedCount,
      skippedRows: skippedCount,
      errors: [],
    });

    console.log(`\nDone. Inserted: ${insertedCount}, Skipped: ${skippedCount}`);

  } catch (e) {
    console.error('Seed failed:', e);
    process.exit(1);
  } finally {
    await closeDb();
    process.exit(0);
  }
}

run();
