import type { APIRoute } from 'astro';
import { ObjectId } from 'mongodb';
import { requireApiUser } from '../../../lib/auth/guards';
import { ImportService } from '../../../lib/services/import.service';
import { ImportRepo, type ImportError } from '../../../lib/repositories/import.repo';
import { ProjectRepo } from '../../../lib/repositories/project.repo';
import { ProjectService } from '../../../lib/services/project.service';

const VALID_PRIORITIES = ['Low', 'Medium', 'High'];

function parseJson(text: string): { items: unknown[]; error?: string } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (e: any) {
    return {
      items: [],
      error: `Invalid JSON: ${e?.message ?? 'parse error'}. Make sure the file is valid JSON.`,
    };
  }
  if (!Array.isArray(parsed)) {
    return {
      items: [],
      error: 'The JSON file must be an array starting with [ and ending with ]. Got: ' + typeof parsed,
    };
  }
  if (parsed.length === 0) {
    return { items: [], error: 'The JSON array is empty — add at least one issue object.' };
  }
  return { items: parsed };
}

export const POST: APIRoute = async (context) => {
  const user = await requireApiUser(context);
  if (user instanceof Response) return user;

  const json = (body: object, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

  try {
    let formData: FormData;
    try {
      formData = await context.request.formData();
    } catch {
      return json({ error: 'Could not read the uploaded data. Make sure you are submitting a multipart form.' }, 400);
    }

    const projectId = (formData.get('projectId') as string || '').trim();
    const file = formData.get('file') as File | null;

    if (!projectId) {
      return json({ error: 'No project selected. Pick a project before uploading.' }, 400);
    }
    if (!file || file.size === 0) {
      return json({ error: 'No file uploaded, or the file is empty.' }, 400);
    }

    const ext = file.name.split('.').pop()?.toLowerCase();
    if (ext !== 'json') {
      return json({
        error: `Wrong file type: ".${ext ?? '?'}". Only .json files are accepted.`,
      }, 400);
    }

    if (file.size > 1 * 1024 * 1024) {
      return json({ error: `File too large (${(file.size / 1024).toFixed(0)} KB). Maximum is 1 MB.` }, 400);
    }

    const project = await ProjectRepo.findById(projectId);
    if (!project) {
      return json({ error: 'Project not found. It may have been deleted.' }, 404);
    }

    try {
      await ProjectService.requireProjectPermission(projectId, user._id!.toString(), 'issues.create');
    } catch {
      return json({ error: 'You do not have permission to import issues into this project.' }, 403);
    }

    if (!project.lists || project.lists.length === 0) {
      return json({ error: 'This project has no board lists. Add a list first.' }, 400);
    }

    const text = await file.text();
    const { items, error: parseError } = parseJson(text);
    if (parseError) {
      return json({ error: parseError }, 400);
    }

    // Build list name → id map (case-insensitive)
    const listMap = new Map<string, string>();
    const listNames = project.lists.map(l => l.title);
    for (const list of project.lists) {
      listMap.set(list.title.toLowerCase().trim(), list.id);
    }

    // Validate and build import rows — no silent fallbacks
    const errors: ImportError[] = [];
    const importRows: Array<{
      projectId: string;
      listId: string;
      title: string;
      priority: string;
      description: string;
      labels: string[];
    }> = [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const itemNum = i + 1;
      const rowErrors: ImportError[] = [];

      if (typeof item !== 'object' || item === null || Array.isArray(item)) {
        errors.push({
          row: itemNum,
          field: 'item',
          message: `Item ${itemNum} is not an object. Each entry must be a JSON object with title, list, and priority.`,
        });
        continue;
      }

      const obj = item as Record<string, unknown>;

      // title — required
      const title = typeof obj.title === 'string' ? obj.title.trim() : '';
      if (!title) {
        rowErrors.push({
          row: itemNum,
          field: 'title',
          message: 'title is required and must not be empty.',
        });
      }

      // list — required, must match a board list name
      const listRaw = typeof obj.list === 'string' ? obj.list.trim() : '';
      let listId = '';
      if (!listRaw) {
        rowErrors.push({
          row: itemNum,
          field: 'list',
          message: `list is required. Available lists: ${listNames.join(', ')}`,
        });
      } else {
        const found = listMap.get(listRaw.toLowerCase());
        if (!found) {
          rowErrors.push({
            row: itemNum,
            field: 'list',
            message: `List "${listRaw}" does not exist. Available lists: ${listNames.join(', ')}`,
          });
        } else {
          listId = found;
        }
      }

      // priority — required, must be Low / Medium / High
      const priority = typeof obj.priority === 'string' ? obj.priority.trim() : '';
      if (!priority) {
        rowErrors.push({
          row: itemNum,
          field: 'priority',
          message: 'priority is required. Use Low, Medium or High.',
        });
      } else if (!VALID_PRIORITIES.includes(priority)) {
        rowErrors.push({
          row: itemNum,
          field: 'priority',
          message: `"${priority}" is not valid. Use Low, Medium or High.`,
        });
      }

      if (rowErrors.length > 0) {
        errors.push(...rowErrors);
        continue;
      }

      // labels — optional, accept array or semicolon string
      let labels: string[] = [];
      if (Array.isArray(obj.labels)) {
        labels = (obj.labels as unknown[]).map(l => String(l).trim()).filter(Boolean);
      } else if (typeof obj.labels === 'string' && obj.labels.trim()) {
        labels = obj.labels.split(';').map(l => l.trim()).filter(Boolean);
      }

      importRows.push({
        projectId,
        listId,
        title,
        priority,
        description: typeof obj.description === 'string' ? obj.description.trim() : '',
        labels,
      });
    }

    // If every single item had errors, stop here — no DB writes
    if (importRows.length === 0) {
      await ImportRepo.createImportLog({
        type: 'json-import',
        status: 'failed',
        importedBy: new ObjectId(user._id!.toString()),
        totalRows: items.length,
        insertedRows: 0,
        skippedRows: items.length,
        errors,
      });
      return json({
        insertedRows: 0,
        skippedRows: items.length,
        status: 'failed',
        errors,
      });
    }

    const result = await ImportService.importIssues(
      importRows,
      new ObjectId(user._id!.toString()),
      'json-import'
    );

    // Merge pre-validation errors with service-level errors
    const allErrors = [...errors, ...result.errors];
    const totalSkipped = (items.length - importRows.length) + result.skippedRows;

    return json({
      insertedRows: result.insertedRows,
      skippedRows: totalSkipped,
      status: result.status,
      errors: allErrors,
    });

  } catch (error: any) {
    console.error('[import/json] Unexpected error:', error);
    return json({ error: `Server error: ${error?.message ?? 'unknown'}. Check the server logs.` }, 500);
  }
};
