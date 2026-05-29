# B1F and B1E - NoSQL Data Model Documentation

**Modul 165 - Selina Mogicato**

---

## Project description

FlowBoard is a team project management app built with Astro, TypeScript, and MongoDB.
It has a Kanban board, sprint planning, user authentication with cookie sessions,
and project-based collaboration with roles.

The database is a real MongoDB instance, not a demo. Everything described in this
document is the actual data structure that the app runs on.

---

## B1F - Implementing a given NoSQL data model

The FlowBoard data model is implemented using six MongoDB collections.
Each collection has its own repository file in `src/lib/repositories/`.
All database access goes through these repositories.

### Collections overview

#### users

Stores registered users.

Important fields:
- `email` - unique, used for login
- `name` - display name
- `passwordHash` - bcrypt hash, never plain text
- `createdAt`, `updatedAt`

Referenced by: sessions, projectMembers, issues (as assignee)

---

#### sessions

Stores active login sessions.

Important fields:
- `userId` - references users
- `tokenHash` - hashed session token stored in a cookie
- `expiresAt` - TTL field, MongoDB removes expired sessions automatically
- `revokedAt` - set when a user logs out

Sessions are separate from users because they have a completely different lifecycle.
They expire, they get revoked, and they need to be cleaned up without touching user data.

---

#### projects

Stores team projects.

Important fields:
- `name`, `description`
- `ownerId` - references users
- `lists` - embedded array of board list objects (name, id, order)
- `isArchived`
- `createdAt`, `updatedAt`

Board lists are embedded directly inside the project document.
This makes sense because lists are small, only belong to one project,
and are always needed when you open the board.

---

#### projectMembers

Stores which users are part of which project and with what role.

Important fields:
- `projectId` - references projects
- `userId` - references users
- `role` - e.g. owner, member
- `invitedBy` - references users
- `createdAt`

This is a junction collection for the many-to-many relationship between users and projects.
Roles are stored here because they are project-specific.

---

#### issues

Stores the tasks that appear on the Kanban board.

Important fields:
- `projectId` - references projects
- `listId` - references embedded list inside the project
- `sprintId` - optional, references sprints
- `title`, `description`
- `priority`
- `order` - controls position on the board
- `labels` - array of strings
- `assignee` - optional, references users
- `createdAt`, `updatedAt`

Issues are in their own collection because they are the most frequently updated data in the app.
They get created, moved, filtered, searched, and reassigned all the time.
Embedding them inside the project document would make the project document huge and slow.

---

#### sprints

Stores sprints for sprint planning.

Important fields:
- `projectId` - references projects
- `name`, `goal`
- `status` - planned, active, or completed
- `startDate`, `endDate`

Sprints have their own lifecycle and their own status transitions.
Issues can optionally be assigned to a sprint via `sprintId`.
Keeping sprints in a separate collection makes status changes and sprint queries simple.

---

## B1E - Designing a NoSQL data model

### Embedding vs Referencing

The main design question in MongoDB is: should data be embedded inside a document, or kept in a separate collection?

FlowBoard uses both:

**Embedded:**

| Data | Parent | Reason |
|------|--------|--------|
| project.lists | projects | Small, project-specific, always loaded with the project, no independent lifecycle needed |

**Referenced:**

| Field | References | Reason |
|-------|-----------|--------|
| issue.projectId | projects | Issues can grow a lot, need independent querying |
| issue.sprintId | sprints | Sprints have their own lifecycle, optional assignment |
| issue.assignee | users | Users are independent entities shared across projects |
| projectMembers.projectId | projects | Many-to-many junction |
| projectMembers.userId | users | Many-to-many junction |
| session.userId | users | Sessions are temporary, users are permanent |

The general rule I followed: embed data that is small, only belongs to one parent, and is always needed together with the parent. Reference everything else.

---

### Design decisions

**Why lists are embedded in the project document:**

Board lists like "To Do" or "Done" only make sense inside one project. They are small (just a name and an ID). The board always loads the project and its lists together. A separate `boardLists` collection would add an extra query for no real benefit.

**Why issues are not embedded:**

Issues can grow a lot. A project could have hundreds of them. The app needs to filter by priority, assignee, sprint, and label. It needs to sort by order and by creation date. If issues were inside the project document, every filter and sort would mean loading and scanning a huge array inside that document. A separate collection with indexes is the right call.

**Why projectMembers is a junction collection:**

One user can be in many projects. One project can have many users. This is a many-to-many relationship. A junction collection is the standard way to handle this. It also stores the role per membership, which is project-specific and does not belong in the user document.

**Why sprints are separate:**

Sprints have a clear lifecycle: planned -> active -> completed. Issues optionally point to a sprint. If sprints were embedded inside the project document, updating sprint status would mean updating the whole project. Querying the active sprint would be awkward. A separate collection is much cleaner.

**Why sessions are separate:**

Sessions expire. They get revoked. They are temporary by nature. Storing them inside the user document would mean the user document constantly changes as sessions are created and deleted. A separate collection keeps the user document clean and makes session cleanup simple, especially with a TTL index.

---

## Index concept

Indexes tell MongoDB which fields to pre-sort and pre-index so queries can skip scanning entire collections.

FlowBoard defines these indexes in `src/lib/db/indexes.ts`:

| Collection | Fields | Type | Purpose |
|-----------|--------|------|---------|
| users | email | Unique | Fast login lookup, no duplicate accounts |
| sessions | tokenHash | Unique | Fast session validation per request |
| sessions | expiresAt | TTL | Automatic deletion of expired sessions |
| projectMembers | projectId + userId | Compound unique | One membership per user per project |
| issues | projectId + listId + order | Compound | Board column loading, sorted by position |
| issues | projectId + sprintId | Compound | Sprint view loading |
| sprints | projectId + status | Compound | Active sprint lookup per project |

The TTL index on `sessions.expiresAt` is worth highlighting: MongoDB uses it to automatically delete session documents once `expiresAt` is in the past. No cron job or cleanup script needed.

---

## Why MongoDB fits FlowBoard

MongoDB is a reasonable choice for FlowBoard, though SQL would also work.

The main reasons MongoDB fits here:

- Flexible document structure suits the Kanban board. Issues have optional fields like `sprintId` and `assignee`. Labels are a simple array.
- Embedding board lists inside the project document is natural for a document database.
- Most queries in FlowBoard are scoped to one project, which maps well to MongoDB's document model.
- Schema flexibility made development faster. Adding a new field to issues did not require a migration.

To be honest, PostgreSQL with proper foreign keys would also handle this data model well. The data is not deeply nested or particularly document-shaped. I used MongoDB because it is what Modul 165 focuses on, and because the flexible structure works for a project board where the schema might still evolve.

---

## Where to find the implementation

| File | What it contains |
|------|-----------------|
| `src/lib/db/mongo.ts` | MongoDB connection |
| `src/lib/db/indexes.ts` | Index definitions and creation |
| `src/lib/db/schema-docs.ts` | Typed documentation data for the competency page |
| `src/lib/repositories/user.repo.ts` | User collection queries |
| `src/lib/repositories/session.repo.ts` | Session collection queries |
| `src/lib/repositories/project.repo.ts` | Project collection queries |
| `src/lib/repositories/project-member.repo.ts` | ProjectMembers collection queries |
| `src/lib/repositories/issue.repo.ts` | Issues collection queries |
| `src/lib/repositories/sprint.repo.ts` | Sprints collection queries |
| `src/pages/competencies/nosql-model.astro` | Frontend explanation page (this content, rendered as a page) |

---

## Competency summary

**B1F - I can implement a given data model with a NoSQL database.**

The FlowBoard data model is fully implemented in MongoDB. All six collections exist and are used by the running application. Each collection has a repository with typed queries. Indexes are defined and created on startup.

**B1E - I can design a data model for a NoSQL database.**

The data model was designed with conscious decisions about embedding vs referencing. Board lists are embedded because they are small and project-specific. Issues, sprints, members, and sessions are in separate collections because they have independent lifecycles, grow in size, or need independent querying. These decisions are explained in this document and on the in-app page at `/competencies/nosql-model`.
