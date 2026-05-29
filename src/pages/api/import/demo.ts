import type { APIRoute } from 'astro';
import { ObjectId } from 'mongodb';
import { requireApiUser } from '../../../lib/auth/guards';
import { ImportService } from '../../../lib/services/import.service';
import { ProjectService } from '../../../lib/services/project.service';
import { ProjectRepo } from '../../../lib/repositories/project.repo';

const DEMO_ISSUES = [
  {
    title: 'Set up project structure',
    priority: 'High',
    description: 'Initialize the repo and folder structure for the project.',
  },
  {
    title: 'Design the database schema',
    priority: 'High',
    description: 'Decide on collections and how data should be structured in MongoDB.',
  },
  {
    title: 'Create login page',
    priority: 'Medium',
    description: 'Build the login form with validation and error handling.',
  },
  {
    title: 'Add user registration',
    priority: 'Medium',
    description: 'Allow new users to create accounts with email and password.',
  },
  {
    title: 'Implement Kanban board',
    priority: 'High',
    description: 'Drag-and-drop board with lists and issue cards.',
  },
  {
    title: 'Add sprint planning view',
    priority: 'Medium',
    description: 'A page for managing sprints and assigning issues.',
  },
  {
    title: 'Write unit tests',
    priority: 'Low',
    description: 'Cover the key service functions with basic tests.',
  },
  {
    title: 'Fix navigation bug on mobile',
    priority: 'Low',
    description: 'The sidebar does not close after clicking a link on mobile.',
  },
  {
    title: 'Deploy to staging environment',
    priority: 'Medium',
    description: 'Set up Docker and deploy the app to a staging server.',
  },
  {
    title: 'Write project documentation',
    priority: 'Low',
    description: 'Document the data model and architecture decisions.',
  },
];

export const POST: APIRoute = async (context) => {
  const user = await requireApiUser(context);
  if (user instanceof Response) return user;

  try {
    const body = await context.request.json().catch(() => ({})) as { projectId?: string };
    let projectId: string = body.projectId || '';

    // If no projectId provided, create a demo project automatically
    if (!projectId) {
      const demoProject = await ProjectService.createProject(
        'Demo Import Project',
        'This project was created automatically by the demo import.',
        undefined,
        user._id!.toString()
      );
      projectId = demoProject._id!.toString();
    }

    // Verify project exists and user has access
    const project = await ProjectRepo.findById(projectId);
    if (!project) {
      return new Response(JSON.stringify({ error: 'Project not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const hasAccess = await ProjectService.userCanAccessProject(projectId, user._id!.toString());
    if (!hasAccess) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Pick the first available list (prefer Backlog, fall back to whatever exists)
    const targetList = project.lists?.find(l => l.title === 'Backlog') || project.lists?.[0];
    if (!targetList) {
      return new Response(JSON.stringify({ error: 'Project has no lists to import into' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Build the import rows
    const rows = DEMO_ISSUES.map(issue => ({
      projectId,
      listId: targetList.id,
      title: issue.title,
      priority: issue.priority,
      description: issue.description,
    }));

    const result = await ImportService.importIssues(
      rows,
      new ObjectId(user._id!.toString()),
      'demo-issues'
    );

    return new Response(
      JSON.stringify({
        insertedRows: result.insertedRows,
        skippedRows: result.skippedRows,
        status: result.status,
        errors: result.errors,
        projectId,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
