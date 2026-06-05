import { SprintRepo, type SprintStatus, type Sprint } from '../repositories/sprint.repo';
import { IssueRepo } from '../repositories/issue.repo';
import { ProjectRepo } from '../repositories/project.repo';

export const SprintService = {
  async getAllSprints(projectId: string) {
    if (!projectId) throw new Error('Project ID required');
    return SprintRepo.findAllByProject(projectId);
  },

  async getSprintById(sprintId: string) {
    if (!sprintId) throw new Error('Sprint ID required');
    return SprintRepo.findById(sprintId);
  },

  async createSprint(projectId: string, data: { name: string; goal?: string; startDate?: string; endDate?: string; issueIds?: string[] }) {
    if (!projectId) throw new Error('Project ID required');
    if (!data.name) throw new Error('Sprint name required');

    const sprint = await SprintRepo.create(projectId, {
      name: data.name,
      goal: data.goal,
      status: 'planned' as SprintStatus,
      startDate: data.startDate ? new Date(data.startDate) : undefined,
      endDate: data.endDate ? new Date(data.endDate) : undefined,
    });

    if (data.issueIds?.length && sprint._id) {
      await IssueRepo.bulkAssignToSprint(sprint._id.toString(), data.issueIds);
    }

    return sprint;
  },

  async activateSprint(sprintId: string) {
    const sprint = await SprintRepo.findById(sprintId);
    if (!sprint) throw new Error('Sprint not found');

    if (sprint.status === 'completed') {
      throw new Error('Cannot activate a completed sprint');
    }

    const activeSprint = await SprintRepo.findActiveSprint(sprint.projectId);
    if (activeSprint && activeSprint._id!.toString() !== sprintId) {
      throw new Error(`Another sprint "${activeSprint.name}" is already active. Please complete it first.`);
    }

    return SprintRepo.updateStatus(sprintId, 'active');
  },

  async completeSprint(sprintId: string) {
    const sprint = await SprintRepo.findById(sprintId);
    if (!sprint) throw new Error('Sprint not found');
    return SprintRepo.updateStatus(sprintId, 'completed');
  },

  async assignIssueToSprint(issueId: string, sprintId: string) {
    const sprint = await SprintRepo.findById(sprintId);
    if (!sprint) throw new Error('Sprint not found');

    if (sprint.status === 'completed') {
      throw new Error('Cannot assign issues to a completed sprint');
    }

    return IssueRepo.assignToSprint(issueId, sprintId);
  },

  async removeIssueFromSprint(issueId: string) {
    return IssueRepo.removeFromSprint(issueId);
  },

  async getSprintOverview(sprintId: string) {
    const sprint = await SprintRepo.findById(sprintId);
    if (!sprint) throw new Error('Sprint not found');

    const issues = await IssueRepo.findAllBySprint(sprintId);
    const project = await ProjectRepo.findById(sprint.projectId);

    const completedListIds = project?.lists
      .filter(l => ['Completed', 'Done'].includes(l.title))
      .map(l => l.id) ?? [];

    const totalIssues = issues.length;
    const completedIssues = issues.filter(i => completedListIds.includes(i.listId)).length;
    const openIssues = totalIssues - completedIssues;
    const progressPercent = totalIssues > 0 ? Math.round((completedIssues / totalIssues) * 100) : 0;

    return {
      sprint,
      stats: { totalIssues, completedIssues, openIssues, progressPercent },
      issues
    };
  },

  async deleteSprint(sprintId: string) {
    if (!sprintId) throw new Error('Sprint ID required');
    // Move sprint issues back to backlog before removing the sprint document
    await IssueRepo.unassignAllFromSprint(sprintId);
    return SprintRepo.delete(sprintId);
  },

  async updateSprint(sprintId: string, data: Partial<Omit<Sprint, '_id' | 'projectId' | 'issues'>>) {
    if (!sprintId) throw new Error('Sprint ID required');
    return SprintRepo.update(sprintId, data);
  }
};
