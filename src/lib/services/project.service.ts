// Explanation: This service layer handles the business logic for projects.
// It acts as an intermediary between the API/Page and the Repository.
// It validates input (like ensuring a name exists) before asking the repository to save data.

import { ProjectRepo, type Project, type ProjectList } from '../repositories/project.repo';
import { ProjectMemberRepo } from '../repositories/project-member.repo';
import { ObjectId } from 'mongodb';
import { v4 as uuidv4 } from 'uuid';

const DEFAULT_LISTS = [
  'Backlog',
  'Sprint Planning',
  'In Progress',
  'In Review',
  'Completed'
];

/// Add color constants or types if needed, but string is flexible.
const DEFAULT_COLOR = '#6b7280'; // gray-500 equivalent


const isValidUrl = (url: string) => {
  try {
    new URL(url);
    return true;
  } catch {
    // Allow git@ format
    return /^git@[\w.-]+:[\w./-]+$/.test(url);
  }
};

export const ProjectService = {
  async getAllProjects(includeArchived = false, userId: string) {
    if (!userId) return [];
    return await ProjectRepo.listVisibleProjectsForUser(userId, includeArchived);
  },

  async listDashboardProjects(userId: string) {
    return this.getAllProjects(false, userId);
  },

  async getProjectById(id: string, userId?: string) {
    const project = await ProjectRepo.findById(id);
    if (!project) return null;
    
    if (userId) {
      const hasAccess = await this.userCanAccessProject(id, userId);
      if (!hasAccess) return null;
    }
    return project;
  },

  async userCanAccessProject(projectId: string, userId: string): Promise<boolean> {
    const project = await ProjectRepo.findById(projectId);
    if (!project) return false;
    
    if (project.ownerId?.toString() === userId) return true;
    
    return await ProjectMemberRepo.isProjectMember(projectId, userId);
  },

  async requireProjectAccess(projectId: string, userId: string) {
    const hasAccess = await this.userCanAccessProject(projectId, userId);
    if (!hasAccess) {
      throw new Error('Project access denied');
    }
  },

  async requireProjectOwner(projectId: string, userId: string) {
    const project = await ProjectRepo.findById(projectId);
    if (!project) throw new Error('Project not found');
    
    if (project.ownerId?.toString() !== userId) {
      throw new Error('Project ownership required');
    }
  },

  async createProject(name: string, description?: string, repositoryUrl?: string, userId?: string) {
    if (!name) throw new Error('Project name is required');
    if (!userId) throw new Error('User ID is required to create a project');

    if (repositoryUrl && !isValidUrl(repositoryUrl)) {
      throw new Error('Invalid repository URL');
    }

    const lists: ProjectList[] = DEFAULT_LISTS.map((title, index) => ({
      id: uuidv4(),
      title,
      order: index,
      color: DEFAULT_COLOR
    }));

    const project = await ProjectRepo.create({
      name,
      description,
      repositoryUrl,
      lists,
      ownerId: new ObjectId(userId)
    });

    if (project._id) {
      await ProjectMemberRepo.addMember({
        projectId: project._id,
        userId: new ObjectId(userId),
        role: 'owner',
        invitedBy: new ObjectId(userId)
      });
    }

    return project;
  },

  async addList(projectId: string, title: string, color?: string) {
    if (!title) throw new Error('List title is required');
    const project = await this.getProjectById(projectId);
    if (!project) throw new Error('Project not found');

    const newList: ProjectList = {
      id: uuidv4(),
      title,
      order: project.lists ? project.lists.length : 0,
      color: color || DEFAULT_COLOR
    };

    const lists = project.lists ? [...project.lists, newList] : [newList];
    await ProjectRepo.update(projectId, { lists });
    return newList;
  },

  async updateList(projectId: string, listId: string, title?: string, color?: string) {
    const project = await this.getProjectById(projectId);
    if (!project || !project.lists) throw new Error('Project or list not found');

    const listIndex = project.lists.findIndex(l => l.id === listId);
    if (listIndex === -1) throw new Error('List not found');

    const lists = [...project.lists];
    lists[listIndex] = { 
        ...lists[listIndex], 
        title: title || lists[listIndex].title,
        color: color || lists[listIndex].color 
    };
    return await ProjectRepo.update(projectId, { lists });
  },

  async deleteList(projectId: string, listId: string) {
    const project = await this.getProjectById(projectId);
    if (!project || !project.lists) throw new Error('Project or list not found');

    const lists = project.lists.filter(l => l.id !== listId);
    return await ProjectRepo.update(projectId, { lists });
  },

  async reorderLists(projectId: string, listIds: string[]) {
    const project = await this.getProjectById(projectId);
    if (!project || !project.lists) throw new Error('Project not found');

    // Create a map for quick lookup
    const listMap = new Map(project.lists.map(l => [l.id, l]));
    
    // Reconstruct the lists array based on the provided order
    const newLists: ProjectList[] = [];
    listIds.forEach((id, index) => {
      const list = listMap.get(id);
      if (list) {
        newLists.push({ ...list, order: index });
      }
    });

    // If some lists were missing from the provided IDs, append them at the end?
    // Or assume the UI sends all lists. Let's append missing ones just in case.
    project.lists.forEach(l => {
        if (!listIds.includes(l.id)) {
            newLists.push({ ...l, order: newLists.length });
        }
    });

    return await ProjectRepo.update(projectId, { lists: newLists });
  },

  async updateProject(id: string, data: Partial<Project>) {
    if (data.repositoryUrl && !isValidUrl(data.repositoryUrl)) {
      throw new Error('Invalid repository URL');
    }
    return await ProjectRepo.update(id, data);
  },

  async deleteProject(id: string) {
    return await ProjectRepo.delete(id);
  }
};
