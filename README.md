# FlowBoard

FlowBoard is a full-stack project management app built with Astro, TypeScript, Tailwind CSS, and MongoDB. It is designed around a kanban-style board with projects, issues, sprints, and team members.

Live deployment:

- https://flowboard-mr71.onrender.com/

Important note about the live demo:

- The app is deployed on Render's free tier.
- Free Render services sleep when idle, so the first request can take a few seconds before the app wakes up.

## What The Project Does

FlowBoard provides:

- User registration and login
- Session-based authentication with cookies
- Project creation and archiving
- Custom board lists per project
- Issue creation, editing, deletion, filtering, and drag/drop movement
- Sprint planning, activation, completion, and issue assignment
- Project member management
- Profile editing and password changes

## Tech Stack

### Frontend

- Astro 5 for pages, layouts, server rendering, and API routes
- TypeScript for type safety across the entire app
- Tailwind CSS 4 via Vite for styling
- Astro components for reusable UI building blocks

### Backend

- Astro server output with `@astrojs/node`
- Node.js runtime in standalone server mode
- API routes inside `src/pages/api/...`
- Custom middleware for protecting authenticated routes

### Database

- MongoDB with the official `mongodb` Node driver
- Direct repository layer instead of an ORM
- Collections for users, sessions, projects, project members, issues, and sprints

### Authentication

- `bcryptjs` for password hashing
- Cookie-based sessions stored in MongoDB
- Session token hashing with Node's `crypto` module

### Infrastructure

- Docker multi-stage build for production
- Docker Compose for local MongoDB
- Render web service deployment
- GitLab CI job to mirror `main` to GitHub

## High-Level Architecture

The project follows a simple layered structure:

1. `src/pages` contains Astro pages and API routes.
2. `src/lib/services` contains business logic.
3. `src/lib/repositories` contains direct MongoDB access.
4. `src/lib/auth` contains session, cookie, password, and guard helpers.
5. `src/lib/db` contains MongoDB connection and index setup.

This keeps rendering, business rules, and persistence separate.

## Project Structure

```text
.
├── src/
│   ├── components/
│   │   ├── issues/              # Issue dialogs and edit UI
│   │   ├── layout/              # Sidebar, topbar, app shell
│   │   ├── sprints/             # Sprint dialogs and controls
│   │   └── ui/                  # Buttons, inputs, modal, toast, card, badge
│   ├── layouts/
│   │   ├── AuthLayout.astro     # Public auth pages
│   │   ├── AppLayout.astro      # Authenticated app pages
│   │   └── Layout.astro         # Generic base layout
│   ├── lib/
│   │   ├── auth/                # Sessions, cookies, guards, password helpers
│   │   ├── config/              # Environment variable handling
│   │   ├── db/                  # Mongo client + index creation
│   │   ├── repositories/        # Mongo collection access
│   │   └── services/            # Business logic
│   ├── pages/
│   │   ├── api/                 # Backend endpoints
│   │   ├── projects/            # Project dashboard, board, issues, sprints, members
│   │   ├── settings/            # Profile settings
│   │   ├── login.astro          # Login screen
│   │   ├── register.astro       # Registration screen
│   │   ├── board.astro          # Redirect to first available project board
│   │   ├── health.ts            # Lightweight health endpoint
│   │   └── index.astro          # Redirect based on session
│   ├── styles/
│   │   └── global.css           # Global styles and theme tokens
│   └── middleware.ts            # Route protection
├── scripts/
│   ├── create-admin.ts          # Create an admin user manually
│   └── debug_create_project.ts  # Debug helper script
├── Dockerfile                   # Production container image
├── docker-compose.yml           # Local MongoDB service
├── astro.config.mjs             # Astro + Node adapter config
├── tailwind.config.cjs          # Tailwind config
├── tsconfig.json                # TypeScript config
└── .gitlab-ci.yml               # GitLab pipeline that mirrors to GitHub
```

## What Is Used Where

### Pages and UI

- `src/pages/login.astro` and `src/pages/register.astro`
  - Public auth pages
  - Submit to `/api/auth/login` and `/api/auth/register`
- `src/pages/projects/index.astro`
  - Main project dashboard
  - Lists active or archived projects
  - Handles project creation and editing UI
- `src/pages/projects/[projectId].astro`
  - Main kanban board for a project
  - Shows project lists and issues
  - Supports issue filters and board interactions
- `src/pages/projects/[projectId]/issues/...`
  - Alternate issue list views and new issue form
- `src/pages/projects/[projectId]/sprints/...`
  - Sprint overview, sprint detail, and sprint actions
- `src/pages/projects/[projectId]/settings/members.astro`
  - Project member management
- `src/pages/settings/profile.astro`
  - User profile updates and password changes

### Layouts

- `src/layouts/AuthLayout.astro`
  - Used by public auth pages
  - Loads auth-specific typography and shared toast UI
- `src/layouts/AppLayout.astro`
  - Used by authenticated pages
  - Verifies session again and wraps the app in the shared shell
- `src/components/layout/AppShell.astro`
  - Combines sidebar, topbar, and main content area

### Middleware and auth

- `src/middleware.ts`
  - Protects `/projects`, `/board`, `/settings`, and `/api/projects`
  - Redirects browser requests to `/login`
  - Returns `401` for protected API requests
- `src/lib/auth/session.ts`
  - Creates and revokes sessions
  - Reads the session cookie
  - Loads the current user from MongoDB
- `src/lib/auth/cookies.ts`
  - Handles session cookie creation/removal
- `src/lib/auth/password.ts`
  - Hashes and verifies passwords using `bcryptjs`
- `src/lib/auth/guards.ts`
  - Reusable API auth helpers

### Services

- `src/lib/services/project.service.ts`
  - Project logic
  - Default board lists
  - Project access checks
  - Project owner checks
- `src/lib/services/issue.service.ts`
  - Issue creation, updates, filtering, deletion, and movement between lists
- `src/lib/services/sprint.service.ts`
  - Sprint creation, activation, completion, overview stats, and issue assignment
- `src/lib/services/project-member.service.ts`
  - Member listing, add/remove by email, owner checks
- `src/lib/services/user.service.ts`
  - Profile updates and password changes

### Repositories and collections

- `src/lib/repositories/user.repo.ts`
  - `users` collection
- `src/lib/repositories/session.repo.ts`
  - `sessions` collection
- `src/lib/repositories/project.repo.ts`
  - `projects` collection
- `src/lib/repositories/project-member.repo.ts`
  - `projectMembers` collection
- `src/lib/repositories/issue.repo.ts`
  - `issues` collection
- `src/lib/repositories/sprint.repo.ts`
  - `sprints` collection

### Database utilities

- `src/lib/db/mongo.ts`
  - Creates a shared MongoDB connection
  - Reuses the client during development to avoid reconnect issues
- `src/lib/db/indexes.ts`
  - Creates useful indexes for projects, issues, and sprints

## Data Model

The main entities are:

- `users`
  - Account record with email, optional display name, and password hash
- `sessions`
  - Session token hash, expiry, device metadata, and revocation state
- `projects`
  - Project metadata, owner, archive state, and board list definitions
- `projectMembers`
  - Membership relation between users and projects with roles
- `issues`
  - Kanban cards with title, description, labels, priority, list position, and optional sprint assignment
- `sprints`
  - Sprint planning records with name, goal, dates, and status

## API Overview

### Auth

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`

### User

- `GET /api/users/me`
- `PATCH /api/users/me`
- `PATCH /api/users/me/password`

### Projects

- `GET /api/projects`
- `POST /api/projects`
- `GET /api/projects/:projectId`
- `PATCH /api/projects/:projectId`
- `DELETE /api/projects/:projectId`

### Project lists

- `POST /api/projects/:projectId/lists`
- `PUT /api/projects/:projectId/lists`
- `PATCH /api/projects/:projectId/lists/:listId`
- `DELETE /api/projects/:projectId/lists/:listId`

### Issues

- `GET /api/projects/:projectId/issues`
- `POST /api/projects/:projectId/issues`
- `PUT /api/projects/:projectId/issues/:issueId`
- `DELETE /api/projects/:projectId/issues/:issueId`
- `GET /api/issues/:issueId`
- `PATCH /api/issues/:issueId`
- `DELETE /api/issues/:issueId`

### Sprints

- `GET /api/projects/:projectId/sprints`
- `POST /api/projects/:projectId/sprints`
- `GET /api/sprints/:sprintId`
- `PATCH /api/sprints/:sprintId`
- `DELETE /api/sprints/:sprintId`
- `POST /api/sprints/:sprintId/activate`
- `POST /api/sprints/:sprintId/complete`
- `PATCH /api/issues/:issueId/sprint`
- `DELETE /api/issues/:issueId/sprint`

### Members

- `GET /api/projects/:projectId/members`
- `POST /api/projects/:projectId/members`
- `DELETE /api/projects/:projectId/members`

### Health

- `GET /health`
  - Fast app-level health check
- `GET /api/health`
  - Health check with MongoDB ping

## Environment Variables

The app reads environment variables from both Astro and Node runtime contexts.

Required for normal app startup:

| Variable | Required | Purpose |
| --- | --- | --- |
| `MONGODB_URI` | Yes | MongoDB connection string |
| `MONGODB_DB` | Yes | MongoDB database name |

Authentication settings:

| Variable | Default | Purpose |
| --- | --- | --- |
| `SESSION_SECRET` | `default_secret_change_me_in_prod` | Secret used by auth-related helpers |
| `SESSION_COOKIE_NAME` | `flowboard_session` | Session cookie name |
| `SESSION_TTL_DAYS` | `14` | Session lifetime in days |
| `PASSWORD_BCRYPT_ROUNDS` | `12` | Password hashing cost |

Optional script variables:

| Variable | Purpose |
| --- | --- |
| `ADMIN_EMAIL` | Email for `npm run auth:create-admin` |
| `ADMIN_PASSWORD` | Password for `npm run auth:create-admin` |

Example `.env`:

```dotenv
MONGODB_URI=mongodb://root:examplepassword@localhost:27017/flowboard?authSource=admin
MONGODB_DB=flowboard
SESSION_COOKIE_NAME=flowboard_session
SESSION_TTL_DAYS=14
PASSWORD_BCRYPT_ROUNDS=12
SESSION_SECRET=replace_this_with_a_long_random_secret
```

## Local Development

### 1. Install dependencies

```bash
npm install
```

### 2. Start MongoDB with Docker Compose

```bash
docker compose up -d
```

This starts:

- MongoDB 7
- Container name: `flowboard-mongo`
- Port mapping: `27017:27017`
- Persistent volume: `flowboard-mongo-data`

### 3. Configure environment variables

Use `.env.example` as a reference and create your local `.env`.

Example local Mongo connection:

```dotenv
MONGODB_URI=mongodb://root:M7r9UsUadPwXYZorpWCG3GY4crtBME5KmM8GHqV46PTwtH2LyYikug3aNgtG9MJQED19bmJDtXQfccbbTJ8R@localhost:27017/flowboard?authSource=admin
MONGODB_DB=flowboard
SESSION_SECRET=replace_this_with_a_long_random_secret
```

### 4. Start the app

```bash
npm run dev
```

Astro will run the app locally, usually at:

- `http://localhost:4321`

## Available Scripts

```bash
npm run dev
npm run build
npm run preview
npm run db:indexes
npm run auth:create-admin
```

What they do:

- `npm run dev` starts the Astro development server
- `npm run build` builds the production server bundle into `dist/`
- `npm run preview` previews the built app locally
- `npm run db:indexes` creates MongoDB indexes defined in `src/lib/db/indexes.ts`
- `npm run auth:create-admin` creates a user using `ADMIN_EMAIL` and `ADMIN_PASSWORD`

## Docker

The project uses a multi-stage Docker build:

1. Build stage
   - Uses `node:20-alpine`
   - Installs dependencies with `npm ci`
   - Runs `npm run build`
2. Runtime stage
   - Uses `node:20-alpine`
   - Installs production-only dependencies with `npm ci --omit=dev`
   - Copies the built `dist/` output
   - Starts the server with `node ./dist/server/entry.mjs`

Default runtime container settings:

- `HOST=0.0.0.0`
- `PORT=10000`
- `EXPOSE 10000`

### Build locally

```bash
docker build -t flowboard:local .
```

### Run locally against your local MongoDB

```bash
docker run --rm -p 10000:10000 \
  --name flowboard-app \
  -e HOST=0.0.0.0 \
  -e PORT=10000 \
  -e MONGODB_URI="mongodb://root:uri_connection_string" \
  -e MONGODB_DB="flowboard" \
  -e SESSION_SECRET="replace_this_with_a_long_random_secret" \
  flowboard:local
```

### Verify container health

```bash
curl http://localhost:10000/health
```

Expected response:

```json
{"status":"ok"}
```

## Render Deployment

This app is configured to run on Render as a Docker-based web service.

### Render setup

Use these settings:

- Service type: Web Service
- Runtime: Docker
- Branch: `main`
- Health check path: `/health`

### Required environment variables on Render

- `MONGODB_URI`
- `MONGODB_DB`
- `SESSION_SECRET`

Recommended:

- `SESSION_COOKIE_NAME=flowboard_session`
- `SESSION_TTL_DAYS=14`
- `PASSWORD_BCRYPT_ROUNDS=12`

### Why `/health` matters on Render

There are two health endpoints:

- `/health` only returns a simple JSON response
- `/api/health` also checks MongoDB connectivity

For Render, `/health` is the safer health check path because it is lightweight and avoids failing just because the database is waking up more slowly than the app container.

### Cold start behavior

Because the app runs on Render's free tier:

- the service can spin down after inactivity
- the next request may take a few seconds
- this is expected and not an application bug

## CI / Repository Mirroring

The GitLab pipeline in `.gitlab-ci.yml` does one thing:

- on commits to `main`, it pushes the branch to GitHub

How it works:

- stage: `mirror`
- configures a bot identity
- adds the GitHub remote dynamically
- pushes `HEAD` to `refs/heads/main`

It requires:

- `GITHUB_TOKEN` in GitLab CI variables

## Notes And Limitations

- There is no ORM; database access is written directly against MongoDB collections.
- Some routes are protected in middleware, while others perform auth checks inside the route itself.
- The board is server-rendered with client-side `fetch()` calls for interactions.
- MongoDB is required for startup; the app throws immediately if `MONGODB_URI` or `MONGODB_DB` is missing.

## Quick Start

```bash
npm install
docker compose up -d
npm run dev
```

Then open:

- `http://localhost:4321`

If you want a pre-created user:

```bash
npm run auth:create-admin
```
