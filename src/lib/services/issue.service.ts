
import { IssueRepo, type Issue, type Priority } from '../repositories/issue.repo';
import { ProjectService } from './project.service';
import { ObjectId } from 'mongodb';

export const IssueService = {
  async getIssuesByProject(projectId: string, filters?: { search?: string | null, priority?: string | null, labels?: string[] }) {
    const query: any = {};
    
    if (filters?.search) {
      query.title = { $regex: filters.search, $options: 'i' };
    }
    
    if (filters?.priority) {
      query.priority = filters.priority;
    }
    
    if (filters?.labels && filters.labels.length > 0) {
      // If we want to filter by ANY of the labels (OR)
      // query.labels = { $in: filters.labels };
      // Or if we want to filter by ALL of the labels (AND)
      query.labels = { $all: filters.labels };
    }

    return await IssueRepo.findAllByProject(projectId, query);
  },

  async createIssue(projectId: string, listId: string, title: string, priority: Priority = 'Medium', details?: { description?: string, labels?: string[], assignee?: string }) {
    if (!title) throw new Error('Title is required');
    
    // Verify project and list exist
    const project = await ProjectService.getProjectById(projectId);
    if (!project) throw new Error('Project not found');
    
    const listExists = project.lists?.some(l => l.id === listId);
    if (!listExists) throw new Error('List not found');

    // Get current count to determine order
    // Note: This is not atomic but fine for this scale
    const issues = await IssueRepo.findAllByProject(projectId, { listId });
    const order = issues.length;

    return await IssueRepo.create({
      projectId,
      listId,
      title,
      priority,
      order,
      description: details?.description || '',
      labels: details?.labels || [],
      assignee: details?.assignee || null,
    });
  },

  async getUnassignedIssues(projectId: string) {
    return await IssueRepo.findAllByProject(projectId, { 
      $or: [{ sprintId: null }, { sprintId: { $exists: false } }] 
    });
  },

  async updateIssue(id: string, updates: Partial<Issue>) {
    // Validation
    if (updates.title !== undefined && !updates.title.trim()) {
      throw new Error('Title is required');
    }

    if (updates.priority && !['Low', 'Medium', 'High'].includes(updates.priority)) {
      throw new Error('Invalid priority');
    }

    // Prevent updating critical fields via generic update if needed
    // But for now allow flexibility
    return await IssueRepo.update(id, updates);
  },

  async unassignAllFromSprint(sprintId: string) {
    if (!sprintId) return;
    return await IssueRepo.unassignAllFromSprint(sprintId);
  },

  async deleteIssue(id: string) {
    return await IssueRepo.delete(id);
  },

  async moveIssue(issueId: string, newListId: string, newIndex: number) {
    const issue = await IssueRepo.findById(issueId);
    if (!issue) throw new Error('Issue not found');

    const projectId = issue.projectId;
    const oldListId = issue.listId;

    // Get all issues in the target list
    let targetListIssues = await IssueRepo.findAllByProject(projectId, { listId: newListId });
    
    // Remove the moved issue if it's already in the target list (reordering within same list)
    targetListIssues = targetListIssues.filter(i => i._id.toString() !== issueId);

    // Insert at new index
    targetListIssues.splice(newIndex, 0, issue as any);

    // Update all affected issues
    const updates = targetListIssues.map((iss, index) => {
        return IssueRepo.update(iss._id.toString(), {
            listId: newListId,
            order: index
        });
    });

    await Promise.all(updates);

    // If moved between lists, we should also reorder the old list to close the gap?
    // It's not strictly necessary for functionality but good for cleanliness.
    if (oldListId !== newListId) {
        let oldListIssues = await IssueRepo.findAllByProject(projectId, { listId: oldListId });
        oldListIssues = oldListIssues.filter(i => i._id.toString() !== issueId);
        
        await Promise.all(oldListIssues.map((iss, index) => 
            IssueRepo.update(iss._id.toString(), { order: index })
        ));
    }

    return { success: true };
  }
};
