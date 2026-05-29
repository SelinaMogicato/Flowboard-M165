import 'dotenv/config';

const { findUserByEmail, createUser, ensureUserIndexes } = await import('../src/lib/repositories/user.repo');
const { hashPassword } = await import('../src/lib/auth/password');
const { ProjectRepo } = await import('../src/lib/repositories/project.repo');
const { ProjectMemberRepo } = await import('../src/lib/repositories/project-member.repo');
const { getDb, closeDb } = await import('../src/lib/db/mongo');
const { ObjectId } = await import('mongodb');
const { v4: uuidv4 } = await import('uuid');

type Role = 'owner' | 'admin' | 'member' | 'viewer';

const PASSWORD = 'demo1234';
const PROJECT_NAME = 'Access Control Demo Project';

const ROLE_USERS: Array<{ role: Role; email: string; name: string }> = [
  { role: 'owner', email: 'owner.demo@flowboard.app', name: 'Owner Demo' },
  { role: 'admin', email: 'admin.demo@flowboard.app', name: 'Admin Demo' },
  { role: 'member', email: 'member.demo@flowboard.app', name: 'Member Demo' },
  { role: 'viewer', email: 'viewer.demo@flowboard.app', name: 'Viewer Demo' },
];

async function ensureUser(email: string, name: string) {
  const existing = await findUserByEmail(email);
  if (existing) return existing;

  const passwordHash = await hashPassword(PASSWORD);
  return await createUser({
    email,
    name,
    passwordHash,
  });
}

async function run() {
  console.log('Seeding role demo users...');

  try {
    if (!process.env.MONGODB_URI) {
      throw new Error('MONGODB_URI is not set. Check your .env file.');
    }

    await ensureUserIndexes();
    await ProjectMemberRepo.ensureIndexes();

    const ownerCfg = ROLE_USERS.find(u => u.role === 'owner')!;
    const ownerUser = await ensureUser(ownerCfg.email, ownerCfg.name);

    let project = await ProjectRepo.findAll(false, 1_000);
    let demoProject = project.find(p => p.name === PROJECT_NAME) ?? null;

    if (!demoProject) {
      demoProject = await ProjectRepo.create({
        name: PROJECT_NAME,
        description: 'Demo project used to show owner/admin/member/viewer permissions.',
        ownerId: new ObjectId(ownerUser._id!.toString()),
        lists: [
          { id: uuidv4(), title: 'Backlog', order: 0, color: '#6b7280' },
          { id: uuidv4(), title: 'In Progress', order: 1, color: '#6b7280' },
          { id: uuidv4(), title: 'Done', order: 2, color: '#6b7280' },
        ],
      });
      console.log(`Created project: ${demoProject.name} (${demoProject._id})`);
    } else {
      console.log(`Project already exists: ${demoProject.name} (${demoProject._id})`);
    }

    for (const cfg of ROLE_USERS) {
      const user = await ensureUser(cfg.email, cfg.name);
      const existingMember = await ProjectMemberRepo.getMember(demoProject._id!, user._id!);

      if (existingMember) {
        if (existingMember.role !== cfg.role) {
          const db = await getDb();
          await db.collection('projectMembers').updateOne(
            { _id: existingMember._id },
            { $set: { role: cfg.role, updatedAt: new Date() } }
          );
          console.log(`Updated role: ${cfg.email} ${existingMember.role} -> ${cfg.role}`);
        } else {
          console.log(`Membership exists: ${cfg.email} -> ${existingMember.role}`);
        }
        continue;
      }

      await ProjectMemberRepo.addMember({
        projectId: demoProject._id!,
        userId: user._id!,
        role: cfg.role,
        invitedBy: ownerUser._id!,
      });
      console.log(`Assigned role: ${cfg.email} -> ${cfg.role}`);
    }

    console.log('\nDone.');
    console.log(`Project: ${PROJECT_NAME}`);
    console.log(`Password for all demo users: ${PASSWORD}`);
    console.log('Users:');
    for (const cfg of ROLE_USERS) {
      console.log(`- ${cfg.role}: ${cfg.email}`);
    }
  } catch (error) {
    console.error('Seed failed:', error);
    process.exit(1);
  } finally {
    await closeDb();
    process.exit(0);
  }
}

run();
