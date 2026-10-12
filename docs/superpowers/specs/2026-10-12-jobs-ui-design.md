# Design Spec: Data Sync & Background Jobs UI

## Overview
A dedicated **Data Sync** page in the Next.js web client (`apps/web/src/app/(main)/data-sync/page.tsx` or similar route) that aggregates bank sync operations (Monobank) and file uploads (PrivatBank XLSX), allows triggering new syncs with options (Fresh vs Full History), displays the last 10 jobs with progress bars, and allows re-triggering failed jobs.

## Features & Requirements
1. **Navigation:** Add "Data Sync" item to the main navigation menu (`MainNav.tsx`).
2. **Data Sync Page:**
   - **Manual Trigger Section:**
     - Button to trigger Monobank sync with options:
       - **Fresh / Recent Sync** (default)
       - **Full History Sync** (`fullHistory: true`)
     - Moved **XLSX Upload** (PrivatBank import modal) button here for centralized data ingestion.
   - **Jobs History Table (Last 10 Jobs):**
     - Columns: Account, Type / Status, Progress bar, Started At, Actions.
     - Auto-polling for active/pending jobs.
     - Option to re-trigger failed jobs.
3. **Backend Support:**
   - Add `GET /api/mono/jobs` endpoint to list the last 10 sync jobs for the user.
   - Ensure DTOs and codegen are updated (`bun run codegen`).

## Architecture & Components
- **Backend:**
  - `MonoBankController`: Add `@Get('jobs')` endpoint to return recent `SyncJob` entries.
  - `MonoBankService`: Implement `getRecentJobs(userId)` querying the Prisma `SyncJob` model.
- **Frontend:**
  - `DataSyncPage` component using generated React Query hooks (`useGetMonoJobs`, `useSyncTransactions`, etc.).
  - Sub-components for job list, trigger modal, and the existing PrivatBank upload section.
