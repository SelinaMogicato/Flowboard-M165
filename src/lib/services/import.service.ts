import { ObjectId } from 'mongodb';
import { IssueRepo, type Priority } from '../repositories/issue.repo';
import { ProjectRepo } from '../repositories/project.repo';
import { SprintRepo } from '../repositories/sprint.repo';
import { ProjectMemberRepo } from '../repositories/project-member.repo';
import { ImportRepo, type ImportError, type ImportStatus } from '../repositories/import.repo';

export interface IssueImportRow {
  projectId: string;
  listId: string;
  title: string;
  priority?: string;
  description?: string;
  labels?: string[];
  assignee?: string;
  sprintId?: string;
}

export interface ImportResult {
  insertedRows: number;
  skippedRows: number;
  errors: ImportError[];
  status: ImportStatus;
  insertedIssues: any[];
}

const VALID_PRIORITIES: Priority[] = ['Low', 'Medium', 'High'];

export const ImportService = {
  async importIssues(
    rows: IssueImportRow[],
    importedBy: ObjectId,
    importType = 'issues'
  ): Promise<ImportResult> {
    const errors: ImportError[] = [];
    const insertedIssues: any[] = [];
    let skippedRows = 0;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 1;
      const rowErrors: ImportError[] = [];

      // Validate projectId format
      if (!row.projectId || !ObjectId.isValid(row.projectId)) {
        rowErrors.push({
          row: rowNum,
          field: 'projectId',
          message: 'projectId is missing or not a valid ObjectId.',
        });
      }

      // Validate title
      if (!row.title || !row.title.trim()) {
        rowErrors.push({
          row: rowNum,
          field: 'title',
          message: 'title is required and must not be empty.',
        });
      }

      // Validate priority — required, must be exactly Low / Medium / High
      if (!row.priority || !row.priority.trim()) {
        rowErrors.push({
          row: rowNum,
          field: 'priority',
          message: 'priority is required. Use Low, Medium or High.',
        });
      } else if (!VALID_PRIORITIES.includes(row.priority as Priority)) {
        rowErrors.push({
          row: rowNum,
          field: 'priority',
          message: `"${row.priority}" is not a valid priority. Use Low, Medium or High.`,
        });
      }

      // Validate sprintId format if provided
      if (row.sprintId && !ObjectId.isValid(row.sprintId)) {
        rowErrors.push({
          row: rowNum,
          field: 'sprintId',
          message: 'sprintId is not a valid ObjectId.',
        });
      }

      // If format validation failed, skip this row entirely
      if (rowErrors.length > 0) {
        errors.push(...rowErrors);
        skippedRows++;
        continue;
      }

      // Check project exists in the database
      const project = await ProjectRepo.findById(row.projectId);
      if (!project) {
        errors.push({
          row: rowNum,
          field: 'projectId',
          message: `Project with id "${row.projectId}" was not found.`,
        });
        skippedRows++;
        continue;
      }

      // Check listId exists inside the project's embedded lists
      const list = project.lists?.find(l => l.id === row.listId);
      if (!list) {
        errors.push({
          row: rowNum,
          field: 'listId',
          message: `List "${row.listId}" does not exist in this project.`,
        });
        skippedRows++;
        continue;
      }

      // Check sprint exists if sprintId is provided
      if (row.sprintId) {
        const sprint = await SprintRepo.findById(row.sprintId);
        if (!sprint) {
          errors.push({
            row: rowNum,
            field: 'sprintId',
            message: `Sprint "${row.sprintId}" was not found.`,
          });
          skippedRows++;
          continue;
        }
      }

      // Check assignee is a member of this project if provided
      if (row.assignee) {
        if (!ObjectId.isValid(row.assignee)) {
          errors.push({
            row: rowNum,
            field: 'assignee',
            message: 'assignee is not a valid user ObjectId.',
          });
          skippedRows++;
          continue;
        }
        const isMember = await ProjectMemberRepo.isProjectMember(row.projectId, row.assignee);
        if (!isMember) {
          errors.push({
            row: rowNum,
            field: 'assignee',
            message: `User "${row.assignee}" is not a member of this project.`,
          });
          skippedRows++;
          continue;
        }
      }

      // Check for duplicate: same title and listId already exists
      const existing = await IssueRepo.findAllByProject(row.projectId, {
        title: row.title.trim(),
        listId: row.listId,
      });
      if (existing.length > 0) {
        errors.push({
          row: rowNum,
          field: 'title',
          message: `An issue with title "${row.title}" already exists in this list. Skipping duplicate.`,
        });
        skippedRows++;
        continue;
      }

      // Determine order position
      const currentIssues = await IssueRepo.findAllByProject(row.projectId, { listId: row.listId });
      const order = currentIssues.length;

      // Insert the issue (priority already validated above — no silent fallback)
      const issue = await IssueRepo.create({
        projectId: row.projectId,
        listId: row.listId,
        title: row.title.trim(),
        priority: row.priority as Priority,
        order,
        description: row.description || '',
        labels: row.labels || [],
        ...(row.assignee ? { assignee: row.assignee } : {}),
        sprintId: row.sprintId ? new ObjectId(row.sprintId) : null,
      });

      insertedIssues.push(issue);
    }

    const insertedRows = insertedIssues.length;
    const status: ImportStatus =
      insertedRows === 0 ? 'failed' :
      skippedRows > 0 ? 'partial' :
      'success';

    await ImportRepo.createImportLog({
      type: importType,
      status,
      importedBy,
      totalRows: rows.length,
      insertedRows,
      skippedRows,
      errors,
    });

    return { insertedRows, skippedRows, errors, status, insertedIssues };
  },
};
