# G1F and G1E - API and Aggregation Documentation

**Modul 165 - Selina Mogicato**

---

## Project description

FlowBoard is a team project management app built with Astro, TypeScript, and MongoDB.
This document explains how FlowBoard connects to MongoDB through the backend, how the API routes
use that connection, and how the stats endpoint demonstrates both G1F and G1E.

---

## How FlowBoard connects to MongoDB

The database connection is managed in `src/lib/db/mongo.ts`. It creates one `MongoClient` and reuses
it across requests. This is called a singleton pattern. The reason for this is that creating a new
connection for every request would be slow and wasteful. MongoDB connections are designed to be
reused, not recreated constantly.

The `getDb()` function is the only place in the app where the actual connection happens. Every
repository calls `getDb()` to get the database handle and then runs its queries on that.

The connection string and database name come from environment variables (`MONGODB_URI` and `MONGODB_DB`),
so they are never hardcoded in the source code.

---

## How API routes use MongoDB

FlowBoard follows a three-layer architecture:

```
API route (src/pages/api/...)
  -> Service (src/lib/services/...)
    -> Repository (src/lib/repositories/...)
      -> MongoDB (via getDb())
```

The API route handles the HTTP request, checks authentication, and validates the input.
The service layer handles business logic, like checking permissions or formatting data.
The repository layer runs the actual database queries.

This means the MongoDB driver is only ever called from the repository layer. API routes never
talk to MongoDB directly. This keeps the code clean and makes it easy to find and change
database logic in one place.

---

## What the stats endpoint does

The endpoint is at `GET /api/projects/[projectId]/stats`. Here is what it does step by step:

1. **Authentication check** - `requireApiUser()` reads the session cookie and returns 401 if there is no valid session.
2. **Input validation** - `ObjectId.isValid(projectId)` checks that the projectId from the URL is a valid MongoDB ObjectId format. Returns 400 if not.
3. **Authorization check** - `ProjectService.requireProjectAccess()` checks that the logged-in user is a member or owner of the project. Returns 403 if not.
4. **Aggregation** - `ProjectStatsRepo.getStats(projectId)` runs the aggregation pipeline and returns the result.
5. **Response** - The stats are returned as JSON with a 200 status.

The endpoint is in `src/pages/api/projects/[projectId]/stats.ts`.
The aggregation logic is in `src/lib/repositories/project-stats.repo.ts`.

---

## How the aggregation pipeline works

The stats repository uses a MongoDB Aggregation Pipeline. This is a series of stages that data
passes through inside the database. Nothing gets loaded into application memory until the final
summarized result is returned.

The pipeline looks like this:

```js
db.collection('issues').aggregate([
  { $match: { projectId } },
  {
    $facet: {
      total: [
        { $count: 'count' }
      ],
      byPriority: [
        { $group: { _id: '$priority', count: { $sum: 1 } } },
        { $project: { _id: 0, priority: '$_id', count: 1 } },
        { $sort: { count: -1 } }
      ],
      byList: [
        { $group: { _id: '$listId', count: { $sum: 1 } } },
        { $project: { _id: 0, listId: '$_id', count: 1 } },
        { $sort: { count: -1 } }
      ],
      bySprint: [
        { $group: { _id: '$sprintId', count: { $sum: 1 } } },
        { $project: { _id: 0, sprintId: { $toString: '$_id' }, count: 1 } },
        { $sort: { count: -1 } }
      ],
      byAssignee: [
        { $group: { _id: '$assignee', count: { $sum: 1 } } },
        { $project: { _id: 0, assignee: '$_id', count: 1 } },
        { $sort: { count: -1 } }
      ]
    }
  }
])
```

### Stage by stage

**$match**
This is the first stage. It filters the issues collection so that only documents where `projectId`
matches the requested project continue through the pipeline. Documents from other projects are
dropped immediately. This is important for performance - the later stages only process what they
actually need.

**$facet**
This stage runs multiple sub-pipelines at the same time inside MongoDB. Each sub-pipeline is
independent and produces its own result. The whole `$facet` stage is one database operation,
so there is only one round trip between the app and MongoDB for all of the groupings combined.

**$group**
Each sub-pipeline uses `$group` to group documents by a field value and count how many documents
belong to each group. For example, `$group: { _id: '$priority', count: { $sum: 1 } }` produces
one document per unique priority value with the count of issues that have that priority.

**$project**
After grouping, `$project` reshapes each result document. It removes the `_id` field that
`$group` creates and renames it to the proper field name (for example `priority` instead of `_id`).

**$sort**
Finally, `$sort: { count: -1 }` orders the grouped results by count, highest first.

---

## Why aggregation is better than counting in the app

The alternative to using an aggregation pipeline would be to:

1. Load all issues for the project from MongoDB into the Node.js process
2. Loop over them four times (once per grouping: priority, list, sprint, assignee)
3. Build the count objects manually in JavaScript

This works, but it is wasteful. If a project has 500 issues, you would load 500 full documents
across the network just to count them. Each document includes all fields like title, description,
labels, and timestamps, most of which you do not need for counting.

With the aggregation pipeline, MongoDB does all the work internally. The app only receives the
final summarized numbers. This is less data over the network, less memory used in Node.js, and
the database is optimized for this kind of operation.

The idea is similar to MapReduce, which is an older pattern for distributed data processing:
- **Map**: MongoDB scans the documents and extracts the grouping key from each one
- **Reduce**: MongoDB combines the values for the same key into a count

Aggregation Pipeline replaced MapReduce for most use cases in MongoDB because it is easier to
read, faster to write, and MongoDB's query optimizer can work with it better.

---

## How G1F and G1E are covered

### G1F - Implementing a connection to a NoSQL database

FlowBoard connects to MongoDB through `src/lib/db/mongo.ts` and exposes that connection to the
rest of the app through the `getDb()` function. Repositories use this connection to run typed
queries. API routes call services and repositories to read and write data. The stats endpoint
at `GET /api/projects/[projectId]/stats` returns MongoDB data as JSON, which is a direct
demonstration of a NoSQL database connected through an API.

Relevant files:
- `src/lib/db/mongo.ts` - the connection
- `src/lib/repositories/project-stats.repo.ts` - the repository with the aggregation
- `src/pages/api/projects/[projectId]/stats.ts` - the API endpoint

### G1E - Applying parallel processing in NoSQL databases

The stats repository uses MongoDB Aggregation Pipeline with the `$facet` stage. `$facet` runs
multiple grouping operations in parallel inside MongoDB. This avoids loading raw documents into
application memory and lets MongoDB do the summarization work it is built for. The approach is
the modern equivalent of the MapReduce algorithm: filter first, then group and reduce in parallel,
then return only the summarized output.

Relevant files:
- `src/lib/repositories/project-stats.repo.ts` - the aggregation pipeline with $facet
- `src/pages/api/projects/[projectId]/stats.ts` - the endpoint that calls it
- `src/pages/competencies/api-aggregation.astro` - the explanation page
