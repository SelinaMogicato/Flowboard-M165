import { IssueRepo, type Issue, type Priority } from '../repositories/issue.repo';
import { ProjectService } from './project.service';

export const IssueService = {
  async getIssuesByProject(projectId: string, filters?: { search?: string | null; priority?: string | null; labels?: string[] }) {
    const query: any = {};

    if (filters?.search) {
      query.title = { $regex: filters.search, $options: 'i' };
    }

    if (filters?.priority) {
      query.priority = filters.priority;
    }

    if (filters?.labels && filters.labels.length > 0) {
      query.labels = { $all: filters.labels };
    }

    return IssueRepo.findAllByProject(projectId, query);
  },

  async createIssue(
    projectId: string,
    listId: string,
    title: string,
    priority: Priority = 'Medium',
    details?: { description?: string; labels?: string[]; assignee?: string }
  ) {
    if (!title) throw new Error('Title is required');

    const project = await ProjectService.getProjectById(projectId);
    if (!project) throw new Error('Project not found');

    const listExists = project.lists?.some(l => l.id === listId);
    if (!listExists) throw new Error('List not found');

    // Determine order within the target list across all issues (backlog + sprints)
    const allIssues = await IssueRepo.findAllByProject(projectId, { listId });
    const order = allIssues.length;

    return IssueRepo.create({
      projectId,
      sprintId: null,
      listId,
      title,
      priority,
      order,
      description: details?.description ?? '',
      labels: details?.labels ?? [],
      assignee: details?.assignee ?? undefined,
    });
  },

  async getUnassignedIssues(projectId: string) {
    // Return only backlog issues (sprintId === null)
    return IssueRepo.findAllByProject(projectId, {
      $or: [{ sprintId: null }, { sprintId: { $exists: false } }]
    });
  },

  async updateIssue(id: string, updates: Partial<Issue>) {
    if (updates.title !== undefined && !updates.title.trim()) {
      throw new Error('Title is required');
    }

    if (updates.priority && !['Low', 'Medium', 'High'].includes(updates.priority)) {
      throw new Error('Invalid priority');
    }

    return IssueRepo.update(id, updates);
  },

  async unassignAllFromSprint(sprintId: string) {
    if (!sprintId) return;
    return IssueRepo.unassignAllFromSprint(sprintId);
  },

  async deleteIssue(id: string) {
    return IssueRepo.delete(id);
  },

  async moveIssue(issueId: string, newListId: string, newIndex: number) {
    const issue = await IssueRepo.findById(issueId);
    if (!issue) throw new Error('Issue not found');

    const projectId = issue.projectId;
    const oldListId = issue.listId;

    // Get all issues in the target list (across backlog + sprints)
    let targetListIssues = await IssueRepo.findAllByProject(projectId, { listId: newListId });
    targetListIssues = targetListIssues.filter(i => i._id.toString() !== issueId);

    // Insert at new index
    targetListIssues.splice(newIndex, 0, issue as any);

    await Promise.all(
      targetListIssues.map((iss, index) =>
        IssueRepo.update(iss._id.toString(), { listId: newListId, order: index })
      )
    );

    // Reorder old list to close gap when moving between lists
    if (oldListId !== newListId) {
      let oldListIssues = await IssueRepo.findAllByProject(projectId, { listId: oldListId });
      oldListIssues = oldListIssues.filter(i => i._id.toString() !== issueId);

      await Promise.all(
        oldListIssues.map((iss, index) =>
          IssueRepo.update(iss._id.toString(), { order: index })
        )
      );
    }

    return { success: true };
  }
};
