import 'dotenv/config';

const { createUser, findUserByEmail, ensureUserIndexes } = await import('../src/lib/repositories/user.repo');
const { hashPassword } = await import('../src/lib/auth/password');
const { closeDb } = await import('../src/lib/db/mongo');


const EMAIL = process.env.ADMIN_EMAIL || 'admin@flowboard.app';
const PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

async function run() {
  console.log('Creating admin user...');
  
  try {
    if (!process.env.MONGODB_URI) {
      throw new Error('MONGODB_URI not set');
    }

    // Ensure indexes
    await ensureUserIndexes();

    const existing = await findUserByEmail(EMAIL);
    if (existing) {
      console.log(`User ${EMAIL} already exists`);
      return;
    }

    const passwordHash = await hashPassword(PASSWORD);
    
    const user = await createUser({
      email: EMAIL,
      passwordHash,
      name: 'Admin User',
    });

    console.log(`Created user: ${user.email} (${user._id})`);
  } catch (e) {
    console.error(e);
    process.exit(1);
  } finally {
    await closeDb();
    process.exit(0);
  }
}

run();
