export interface CollectionDoc {
  name: string;
  purpose: string;
  fields: string[];
  references: string;
  strategy: "embedded" | "referenced" | "mixed";
  strategyNote: string;
}

export const mongoCollections: CollectionDoc[] = [
  {
    name: "users",
    purpose: "Stores registered users with their login credentials and profile info.",
    fields: ["email", "name", "passwordHash", "createdAt", "updatedAt"],
    references: "Referenced by sessions (userId), projectMembers (userId), and issues (assignee).",
    strategy: "referenced",
    strategyNote: "User documents are referenced from other collections, never embedded, because users are independent entities shared across many projects.",
  },
  {
    name: "sessions",
    purpose: "Stores active login sessions. Each session is tied to a user and expires automatically.",
    fields: ["userId", "tokenHash", "expiresAt", "revokedAt"],
    references: "userId references users.",
    strategy: "referenced",
    strategyNote: "Sessions are separate because they have a completely different lifecycle than users. They expire, get revoked, and need to be cleaned up independently.",
  },
  {
    name: "projects",
    purpose: "Stores team projects. Board lists are embedded directly inside each project document.",
    fields: ["name", "description", "ownerId", "lists", "isArchived", "createdAt", "updatedAt"],
    references: "ownerId references users. lists is an embedded array of board list objects.",
    strategy: "mixed",
    strategyNote: "Lists are embedded because they only belong to one project, are small, and are always loaded together with the project. Issues are separate because there can be many of them.",
  },
  {
    name: "projectMembers",
    purpose: "Tracks which users are part of which project and what role they have.",
    fields: ["projectId", "userId", "role", "invitedBy", "createdAt"],
    references: "projectId references projects. userId references users.",
    strategy: "referenced",
    strategyNote: "A separate collection is the cleanest way to model the many-to-many relationship between users and projects. Roles are stored here because they are project-specific.",
  },
  {
    name: "issues",
    purpose: "Stores the tasks shown on the Kanban board and sprint backlog.",
    fields: ["projectId", "listId", "sprintId", "title", "description", "priority", "order", "labels", "assignee"],
    references: "projectId references projects. listId references an embedded list inside the project. sprintId optionally references sprints. assignee optionally references users.",
    strategy: "referenced",
    strategyNote: "Issues are in their own collection because there can be a lot of them. They are frequently searched, filtered, sorted, and moved, which would be painful if they were embedded inside a project document.",
  },
  {
    name: "sprints",
    purpose: "Stores sprints for organizing work into time-boxed iterations.",
    fields: ["projectId", "name", "goal", "status", "startDate", "endDate"],
    references: "projectId references projects.",
    strategy: "referenced",
    strategyNote: "Sprints have their own status (planned, active, completed) and their own dates. Issues reference sprints optionally. This all works cleanly because sprints are separate from the project document.",
  },
];

export interface IndexDoc {
  collection: string;
  fields: string;
  type: string;
  reason: string;
}

export const mongoIndexes: IndexDoc[] = [
  {
    collection: "users",
    fields: "email",
    type: "Unique",
    reason: "Prevents duplicate accounts and makes login lookups fast.",
  },
  {
    collection: "sessions",
    fields: "tokenHash",
    type: "Unique",
    reason: "Each session token must be unique. Also speeds up session validation on every request.",
  },
  {
    collection: "sessions",
    fields: "expiresAt",
    type: "TTL",
    reason: "MongoDB automatically deletes expired sessions. No manual cleanup needed.",
  },
  {
    collection: "projectMembers",
    fields: "projectId + userId",
    type: "Compound unique",
    reason: "A user can only have one membership record per project.",
  },
  {
    collection: "issues",
    fields: "projectId + listId + order",
    type: "Compound",
    reason: "The board loads all issues for a project grouped by list, sorted by their position.",
  },
  {
    collection: "issues",
    fields: "projectId + sprintId",
    type: "Compound",
    reason: "The sprint view filters issues by project and sprint ID.",
  },
  {
    collection: "sprints",
    fields: "projectId + status",
    type: "Compound",
    reason: "Sprint lists always filter by project, and often also by status (e.g. only active sprints).",
  },
];
