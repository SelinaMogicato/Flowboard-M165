# E1 - Backup and Restore Concept

## Project Context

FlowBoard is a project management app that stores its data in MongoDB. The database holds users, sessions, projects, project members, issues, and sprints. During development and testing, data can easily get into a broken state, for example after running import scripts, changing the data model, or adding seed data by mistake. Having a way to get the database back to a known good state is important so development does not get blocked.

## Backup Goal

The goal is to make it possible to take a full snapshot of the MongoDB database at any point in time and restore it later if needed. For this school project, backups are stored locally on the developer machine. The focus is on making the process simple and repeatable so it can actually be used during development.

## Backup Method

Backups are created using `mongodump`, which is part of the official MongoDB Database Tools. It reads the database and writes the data as BSON files into a local folder. The folder structure mirrors the MongoDB collection layout.

The backup script is at `scripts/db-backup.sh`. It reads `MONGODB_URI` and `MONGODB_DB` from environment variables and creates a timestamped folder inside the `backups/` directory. The folder name follows this pattern:

```
backups/flowboard_YYYY-MM-DD_HH-MM-SS/
```

Example:

```
backups/flowboard_2026-05-29_10-30-00/
```

The script fails immediately if either environment variable is missing, so no silent backup of the wrong database can happen.

## What Is Backed Up

The entire MongoDB database defined by `MONGODB_DB`. That includes:

- `users` - registered accounts
- `sessions` - active login sessions
- `projects` - project metadata and board list definitions
- `projectMembers` - membership records with roles
- `issues` - kanban cards with all their fields
- `sprints` - sprint planning records

## Backup Frequency

For this school project, backups are created manually by the developer. The recommended times to take a backup are:

- before running data import scripts
- before making changes to the data model or seed data
- before switching to a different dataset for testing

There is no automated schedule for this project because the app is not in production. In a real production setup, automated backups would be required.

## Restore Process

Restores are done using `mongorestore`, also part of the MongoDB Database Tools. The restore script is at `scripts/db-restore.sh`. It takes the backup folder path as an argument and uses the `--drop` flag to drop the existing collections before writing the restored data. This avoids conflicts between old and new documents.

Example command:

```bash
npm run db:restore -- ./backups/flowboard_2026-05-29_10-30-00
```

The script fails safely if no path is provided, if the path does not exist, or if the environment variables are missing.

## Risks

**Local backups are not enough for production.** If the machine breaks or the disk fails, all backups are lost along with the database. For a real application, backups would need to be stored in a separate location, like cloud storage.

**Backups contain real user data.** The backup files include emails, password hashes, and project content. They should not be committed to version control. The `backups/` folder is listed in `.gitignore` for this reason.

**Restore with `--drop` is destructive.** The command drops all collections before restoring. If you restore the wrong backup by mistake, the current database content is gone. Always double-check the backup path before running a restore.

**No incremental backups.** Every backup is a full copy of the database. For large databases, this takes more time and disk space than incremental approaches. For this school project, full backups are fine because the database is small.

## Production Improvements

If FlowBoard were a real production app, the backup strategy would need to be much more solid:

- **Scheduled backups**: automated backups on a fixed schedule, for example once per day
- **External storage**: upload backup files to an external service like S3 or a managed backup provider
- **Encrypted backups**: encrypt backup files before storing them, because they contain personal user data
- **Retention policy**: keep the last N backups and delete older ones automatically to manage disk usage
- **Regular restore tests**: restore a backup into a separate test database on a regular basis to verify that backups actually work and are not corrupted

## How E1F and E1E Are Covered

**E1F - Applying backup and restore for a NoSQL database**

The scripts `scripts/db-backup.sh` and `scripts/db-restore.sh` demonstrate that a backup can be created and restored. They use `mongodump` and `mongorestore`, the standard MongoDB tools for this purpose. Both scripts are integrated into `package.json` so they can be run with `npm run db:backup` and `npm run db:restore`. The backup creates a timestamped BSON dump of the database, and the restore reads that dump back into MongoDB with `--drop` to replace the existing data.

**E1E - Creating a backup concept for a NoSQL database**

This document is the backup concept. It explains what is backed up, when and how backups are created, where they are stored, how to restore them, what risks exist, and how the approach would need to change for a production environment. The frontend page at `/competencies/backup-restore` also documents the concept as part of the app itself.
