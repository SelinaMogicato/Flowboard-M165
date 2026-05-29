# D1 Access Control Concept

Modul 165 - Competencies D1F and D1E

---

## Why access control is needed

FlowBoard is a team project management tool. Multiple users can be members of the same project and work on it together. Not everyone should be able to do everything, though. A person who was added to a project just to look at the board should not be able to delete the project or remove other members. Without access control, any logged-in user could do anything in any project they have access to, which would be a problem.

The goal is to have a simple, consistent way to decide what each user is allowed to do in a given project.

---

## Roles

There are four roles in FlowBoard. Each project membership has exactly one role.

| Role   | Description |
|--------|-------------|
| owner  | The person who created the project. Has full access including deleting the project and managing members. |
| admin  | Can manage project content, members, lists, issues, and sprints. Cannot delete the whole project. |
| member | Can read the project and work with issues. This is the default role for newly added users. |
| viewer | Read-only access. Can see the project and its issues but cannot make any changes. |

---

## Permissions

Each role maps to a set of permissions. The mapping is defined in `src/lib/auth/permissions.ts`.

| Permission      | Description |
|-----------------|-------------|
| project.read    | Can view the project and its content |
| project.update  | Can change the project name, description, and settings |
| project.delete  | Can permanently delete the project |
| members.manage  | Can add and remove project members |
| lists.manage    | Can create, update, and delete board lists |
| issues.create   | Can create new issues |
| issues.update   | Can edit existing issues |
| issues.delete   | Can delete issues |
| sprints.manage  | Can create, update, activate, complete, and delete sprints |

---

## Permission matrix

| Permission      | Owner | Admin | Member | Viewer |
|-----------------|-------|-------|--------|--------|
| project.read    | yes   | yes   | yes    | yes    |
| project.update  | yes   | yes   | no     | no     |
| project.delete  | yes   | no    | no     | no     |
| members.manage  | yes   | yes   | no     | no     |
| lists.manage    | yes   | yes   | no     | no     |
| issues.create   | yes   | yes   | yes    | no     |
| issues.update   | yes   | yes   | yes    | no     |
| issues.delete   | yes   | yes   | no     | no     |
| sprints.manage  | yes   | yes   | no     | no     |

---

## Where roles are stored

Roles are stored in the `projectMembers` collection in MongoDB. Each document in that collection represents one user-project relationship and looks roughly like this:

```json
{
  "projectId": "ObjectId",
  "userId": "ObjectId",
  "role": "member",
  "invitedBy": "ObjectId",
  "createdAt": "Date",
  "updatedAt": "Date"
}
```

The collection has a unique compound index on `{ projectId, userId }`. This is important because it guarantees that a user can only hold one role per project at a time. Without this index, it would be possible to insert two membership records for the same user and project, which would make the permission checks unreliable.

The index is defined in `src/lib/db/indexes.ts` and is also set up in the repository via `ProjectMemberRepo.ensureIndexes()`.

---

## How permissions are checked

The permission check flow works like this:

1. A request arrives at an API route.
2. `requireApiUser()` checks that the request has a valid session. If not, it returns 401.
3. The route calls `ProjectService.requireProjectPermission(projectId, userId, permission)`.
4. That function fetches the user's membership record from `projectMembers` using `ProjectMemberRepo.getMember()`.
5. If the user has no membership record, it throws "Project access denied".
6. Otherwise, it calls `requirePermission(member.role, permission)` from `src/lib/auth/permissions.ts`.
7. `requirePermission()` checks the role-to-permission map. If the role does not have the required permission, it throws "Permission denied: `<permission>`".
8. The API route catches that error and returns a 403 response.

The `hasPermission(role, permission)` function is also exported and can be used in places where you want to check without throwing, for example in frontend templates to decide whether to show a button.

---

## How D1F is covered

D1F requires implementing predefined access permissions in a NoSQL database.

In FlowBoard, the permissions are predefined in `src/lib/auth/permissions.ts`. The role-to-permission mapping is a fixed constant that does not change at runtime. The roles are stored in the `projectMembers` collection in MongoDB. Before every important action (updating a project, deleting an issue, managing a sprint, etc.), the app checks whether the user's role allows that action. If not, the request is rejected with a 403 error.

Relevant files:
- `src/lib/auth/permissions.ts` - role and permission definitions
- `src/lib/services/project.service.ts` - `requireProjectPermission()` helper
- `src/lib/services/project-member.service.ts` - member management with permission checks
- `src/pages/api/projects/[projectId].ts` - project update and delete routes
- `src/pages/api/issues/[issueId].ts` - issue update and delete routes
- `src/pages/api/sprints/[sprintId].ts` - sprint update and delete routes
- `src/pages/api/sprints/[sprintId]/activate.ts` - sprint activation
- `src/pages/api/sprints/[sprintId]/complete.ts` - sprint completion
- `src/pages/api/projects/[projectId]/lists/` - list management routes
- `src/lib/db/indexes.ts` - unique index on projectMembers

---

## How D1E is covered

D1E requires designing an access control concept for a NoSQL database.

The design decisions made for FlowBoard are:

- **Roles are project-specific** because a user's role can differ between projects. Attaching the role to the membership record rather than the user makes this possible.
- **Roles live in `projectMembers`**, not in `users`, because the users collection is for identity data. Permissions belong to the relationship between a user and a project.
- **Sessions are separate from permissions** because they answer different questions. Sessions handle authentication. Permissions handle authorization. Mixing them would make both harder to maintain.
- **Only owners can delete projects** to protect against accidental or unauthorized deletion.
- **The viewer role exists** to give read-only access to specific users without making them a full participant in the project.
- **The unique index on `{ projectId, userId }`** enforces that each user has at most one role per project, which is a database-level constraint that supports the access control design.

Relevant files:
- `src/pages/competencies/access-control.astro` - explanation and matrix in the app
- `documentation/d1-access-control-concept.md` - this file
- `src/lib/db/indexes.ts` - unique membership index
