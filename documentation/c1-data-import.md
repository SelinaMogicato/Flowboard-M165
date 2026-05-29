# C1F and C1E - Data Import Documentation

**Modul 165 - Selina Mogicato**

---

## Project description

FlowBoard is a team project management app built with Astro, TypeScript, and MongoDB.
This document explains how data is imported into MongoDB in FlowBoard and how import problems are handled.

---

## What data is imported

The demo import inserts 10 issues into the `issues` collection in MongoDB. These issues represent typical tasks you would find on a Kanban board for a software development project.

Each imported issue contains:
- `projectId` - the target project
- `listId` - which board list to put the issue in (for example the Backlog)
- `title` - the issue name
- `priority` - Low, Medium or High
- `description` - a short explanation of the task

The import can also create:
- A demo user if none exists
- A demo project with three lists (Backlog, In Progress, Done)
- A demo sprint

---

## How the import works

There are two ways to run an import:

### 1. Terminal seed script

Run from the project root:

```bash
npm run db:seed
```

This runs `scripts/seed-demo-data.ts` using `tsx`. The script:
1. Checks if a demo user already exists (creates one if not)
2. Checks if a demo project called "Demo Project" already exists (creates one if not)
3. Adds the demo user as owner of the project (via projectMembers)
4. Checks if "Demo Sprint 1" exists (creates one if not)
5. Loops through the 10 demo issues and inserts those that do not already exist
6. Writes an import log document to the `imports` collection

Running the script multiple times is safe. It skips anything that already exists.

### 2. API endpoint

The endpoint at `POST /api/import/demo` can be called from inside the app.

Request body (optional):
```json
{
  "projectId": "64f000000000000000000001"
}
```

If `projectId` is not given, the endpoint creates a new "Demo Import Project" automatically.

The endpoint:
1. Validates the session (requires login)
2. Finds or creates the target project
3. Validates user access to the project
4. Calls `ImportService.importIssues()` with the demo issue data
5. Returns JSON with the result

Response:
```json
{
  "insertedRows": 8,
  "skippedRows": 2,
  "status": "partial",
  "errors": [...],
  "projectId": "64f000000000000000000001"
}
```

---

## Validation rules

The import service in `src/lib/services/import.service.ts` validates every row before inserting it.

| Field | Rule |
|-------|------|
| projectId | Must be a valid MongoDB ObjectId |
| projectId | Project must exist in the database |
| listId | Must match an embedded list in the project |
| title | Required, must not be empty |
| priority | Must be Low, Medium or High |
| sprintId | Optional, but if given must be a valid ObjectId and the sprint must exist |
| assignee | Optional, but if given must be a valid ObjectId and a member of the project |
| title + listId | Combination must not already exist (no duplicate issues) |

If any check fails for a row, the row is skipped and the error is recorded. The import continues with the next row.

---

## Examples of import problems

### Invalid ObjectId

Problem:
```json
{ "projectId": "not-a-valid-id" }
```
Error: `projectId is missing or not a valid ObjectId.`
Solution: The service calls `ObjectId.isValid()` first. The row is skipped immediately.

---

### Missing title

Problem:
```json
{ "title": "" }
```
Error: `title is required and must not be empty.`
Solution: Title is checked before any database call. Empty strings and whitespace-only titles are rejected.

---

### Wrong priority

Problem:
```json
{ "priority": "Urgent" }
```
Error: `Priority must be Low, Medium or High. Got: "Urgent".`
Solution: The service checks the priority against the allowed list `['Low', 'Medium', 'High']`.

---

### listId not in project

Problem:
```json
{ "listId": "some-id-that-does-not-exist" }
```
Error: `List "some-id-that-does-not-exist" does not exist in this project.`
Solution: The service checks `project.lists.find(l => l.id === listId)`. If no match, the row is skipped.

---

### Sprint not found

Problem:
```json
{ "sprintId": "64f000000000000000000999" }
```
Error: `Sprint "64f000000000000000000999" was not found.`
Solution: The service calls `SprintRepo.findById()`. If null, the row is skipped.

---

### Duplicate issue

Problem: An issue with the same title and listId already exists.
Error: `An issue with title "Set up project structure" already exists in this list. Skipping duplicate.`
Solution: The service queries `IssueRepo.findAllByProject()` with title and listId as filters. If any match is found, the row is skipped.

---

### Assignee not a project member

Problem:
```json
{ "assignee": "64f000000000000000000005" }
```
Error: `User "64f000000000000000000005" is not a member of this project.`
Solution: The service calls `ProjectMemberRepo.isProjectMember()`. If false, the row is skipped.

---

## How problems are solved in general

The design principle is: never stop the whole import because of one bad row.

The service:
1. Validates format first (no database call needed)
2. Validates against the database second
3. If anything fails: records the error, skips the row, continues
4. At the end: writes an import log with the complete summary

This means partial imports work. If 8 out of 10 rows are valid, 8 issues are inserted and 2 are recorded as errors.

---

## Import log collection

Every import run writes a document to the `imports` collection.

Structure:
```json
{
  "_id": ObjectId,
  "type": "demo-issues",
  "status": "partial",
  "importedBy": ObjectId,
  "totalRows": 10,
  "insertedRows": 8,
  "skippedRows": 2,
  "errors": [
    {
      "row": 3,
      "field": "priority",
      "message": "Priority must be Low, Medium or High."
    }
  ],
  "createdAt": ISODate
}
```

Status values:
- `success` - all rows were inserted
- `partial` - some rows were inserted, some were skipped
- `failed` - no rows were inserted

The import log makes the import traceable. You can look up what happened during any import run, how many rows were processed, and exactly which rows had problems.

---

## Architecture

| File | Purpose |
|------|---------|
| `scripts/seed-demo-data.ts` | CLI script to seed demo data |
| `src/pages/api/import/demo.ts` | Protected API endpoint for in-app import |
| `src/lib/services/import.service.ts` | Validation logic and import orchestration |
| `src/lib/repositories/import.repo.ts` | CRUD for the imports collection |
| `src/pages/competencies/data-import.astro` | Frontend explanation page |

---

## C1F and C1E proof

**C1F - I can import data into a NoSQL database.**

FlowBoard imports demo issues into the MongoDB `issues` collection. This is done via a terminal seed script (`npm run db:seed`) and via an API endpoint (`POST /api/import/demo`). Both methods use the existing MongoDB connection and the `IssueRepo.create()` function. The imported data is visible in the app immediately after the import.

**C1E - I can recognise problems during the import of data into a NoSQL database and show solutions.**

The `ImportService.importIssues()` function validates every row individually before inserting it. It checks for invalid ObjectIds, missing titles, wrong priority values, missing list IDs, missing sprints, non-member assignees, and duplicate issues. Each problem is recorded with a row number, field name, and error message. The import does not stop on the first error. After all rows are processed, a complete summary is saved to the `imports` collection as an import log.
