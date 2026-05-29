/// <reference path="../.astro/types.d.ts" />
/// <reference types="astro/client" />

declare namespace App {
  interface Locals {
    user: import('./lib/repositories/user.repo').User;
  }
}

interface Window {
  projectId: string;
  issues: any[];
  openCreateIssueModal: (listId: string) => void;
  openEditIssueModal: (issueId: string) => void;
  openEditListModal: (id: string, title: string, color: string) => void;
  deleteList: (listId: string) => void;
  toggleMenu: (e: Event, btn: HTMLElement) => void;
  filterIssues: () => void;
  filterListIssues: () => void;
  toggleIssueDetails: (issueId: string) => void;
  openDeleteIssueDialog: (issueId: string) => void;
  toast: { success: (msg: string) => void; error: (msg: string) => void };
  editSprint: (sprintId: string) => Promise<void>;
  removeFromSprint: (issueId: string) => Promise<void>;
  completeSprint: (sprintId: string) => Promise<void>;
  openCompleteSprintDialog: (sprintId: string) => void;
  openStartSprintDialog: (sprintId: string) => void;
  openDeleteSprintDialog: (sprintId: string) => void;
}
