import 'dotenv/config';
import { ProjectService } from '../src/lib/services/project.service';
import { ObjectId } from 'mongodb';

// Mock user ID
const userId = new ObjectId().toString();

async function run() {
  try {
    console.log('Attempting to create project...');
    const result = await ProjectService.createProject(
      'Test Project', 
      'Creating project from script', 
      undefined, 
      userId
    );
    console.log('Project created successfully:', result);
  } catch (error) {
    console.error('Error creating project:', error);
  } finally {
    process.exit(0);
  }
}

run();