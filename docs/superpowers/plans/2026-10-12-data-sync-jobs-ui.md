# Data Sync & Background Jobs UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a dedicated "Data Sync" page in the Next.js frontend, backed by a new NestJS API endpoint for listing recent background sync jobs, allowing users to trigger fresh or full history Monobank syncs, upload PrivatBank XLSX statements, and track job progress via progress bars.

**Architecture:** Add a `GET /api/mono/jobs` endpoint in the backend to return the last 10 sync jobs for the user. Create a new frontend page at `/data-sync` featuring manual sync triggers, the PrivatBank upload component, and a real-time jobs history table.

**Tech Stack:** NestJS, Prisma, Next.js App Router, TanStack Query (via generated hooks), Tailwind CSS, TypeScript.

## Global Constraints
- TypeScript strict mode enforced.
- camelCase for variables/functions/keys, PascalCase for types/schemas, SCREAMING_SNAKE_CASE only for env vars.
- All datetimes stored/sent as UTC / ISO 8601.
- Never hand-write API fetchers — use OpenAPI codegen (`bun run codegen`) and generated hooks from `apps/web/src/_generated/api/pfd-components.ts`.
- Before deploying Prisma enum changes, apply the schema with `cd apps/api && bun run db:push`; code generation does not update the database.

---

## Task 1: Backend API Endpoint for Listing Sync Jobs

**Files:**
- Modify: `apps/api/src/monobank/monobank.schema.ts`
- Modify: `apps/api/src/monobank/monobank.service.ts`
- Modify: `apps/api/src/monobank/monobank.controller.ts`

**Interfaces:**
- Produces: `SyncJobListItemResponseDto` and endpoint `GET /api/mono/jobs` returning a list of recent sync jobs.

- [x] **Step 1: Add Zod schema for sync job list response**

Modify `apps/api/src/monobank/monobank.schema.ts`:
```typescript
export const SyncJobListItemResponseSchema = z.object({
  id: z.string(),
  accountId: z.string(),
  status: z.enum(SyncJobStatus),
  progress: z.number(),
  total: z.number(),
  newCount: z.number(),
  updatedCount: z.number(),
  errorMessage: z.string().nullable().optional(),
  from: z.iso.datetime().nullable().optional(),
  to: z.iso.datetime().nullable().optional(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export const SyncJobListResponseSchema = z.array(SyncJobListItemResponseSchema);
```

- [x] **Step 2: Add service method to fetch recent sync jobs**

Modify `apps/api/src/monobank/monobank.service.ts`:
```typescript
  async getRecentSyncJobs(userId: string) {
    // Find accounts for this user
    const accounts = await this.prismaService.account.findMany({
      where: { userId },
      select: { id: true },
    });
    const accountIds = accounts.map((a) => a.id);

    if (accountIds.length === 0) {
      return [];
    }

    return await this.prismaService.syncJob.findMany({
      where: { accountId: { in: accountIds } },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });
  }
```

- [x] **Step 3: Add controller endpoint**

Modify `apps/api/src/monobank/monobank.controller.ts`:
```typescript
  @Get('jobs')
  async getRecentSyncJobs(
    @CurrentUser('id') userId: string,
  ): Promise<SyncJobListItemResponseDto[]> {
    return await this.monoBankService.getRecentSyncJobs(userId);
  }
```

- [x] **Step 4: Run codegen to update OpenAPI and frontend SDK**

Run: `bun run codegen`
Expected: Success, generated types/hooks updated.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/monobank/ apps/web/src/_generated/
git commit -m "feat(api): add GET /api/mono/jobs endpoint for recent sync jobs"
```

---

## Task 2: Frontend Data Sync Page & Navigation

**Files:**
- Modify: `apps/web/src/components/MainNav.tsx`
- Create: `apps/web/src/app/(main)/data-sync/page.tsx`

**Interfaces:**
- Consumes: Generated hooks `useGetMonoJobsQuery`, `useSyncTransactionsMutation`, `useGetAccountsQuery`

- [x] **Step 1: Update MainNav to include Data Sync link**

Modify `apps/web/src/components/MainNav.tsx` to add a navigation entry for Data Sync (`/data-sync`).

- [x] **Step 2: Create Data Sync page component**

Create `apps/web/src/app/(main)/data-sync/page.tsx`:
```tsx
'use client';

import React, { useState } from 'react';
import {
  useGetMonoJobsQuery,
  useSyncTransactionsMutation,
  useGetAccountsQuery,
} from '@/components/../_generated/api/pfd-components';
import { PrivatBankUploadModal } from '@/components/privatbank/PrivatBankUploadModal';
import { Button } from '@/components/common/Button';
import { Card } from '@/components/ui/card';

export default function DataSyncPage() {
  const { data: jobs, refetch: refetchJobs } = useGetMonoJobsQuery();
  const { data: accounts } = useGetAccountsQuery();
  const syncMutation = useSyncTransactionsMutation();
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [fullHistory, setFullHistory] = useState<boolean>(false);
  const [isUploadOpen, setIsUploadOpen] = useState<boolean>(false);

  const handleSync = async () => {
    if (!selectedAccountId && accounts && accounts.length > 0) {
      setSelectedAccountId(accounts[0].id);
    }
    const accId = selectedAccountId || accounts?.[0]?.id;
    if (!accId) return;

    await syncMutation.mutateAsync({
      accountId: accId,
      data: { fullHistory },
    });
    refetchJobs();
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Data Sync & Background Jobs</h1>
        <Button onClick={() => setIsUploadOpen(true)}>Upload PrivatBank XLSX</Button>
      </div>

      <Card className="p-6 space-y-4">
        <h2 className="text-lg font-semibold">Trigger Monobank Sync</h2>
        <div className="flex gap-4 items-center">
          <select
            className="border p-2 rounded"
            value={selectedAccountId}
            onChange={(e) => setSelectedAccountId(e.target.value)}
          >
            {accounts?.map((acc) => (
              <option key={acc.id} value={acc.id}>
                {acc.name || acc.iban || acc.id} ({acc.currency})
              </option>
            ))}
          </select>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={fullHistory}
              onChange={(e) => setFullHistory(e.target.checked)}
            />
            Full History Sync
          </label>
          <Button onClick={handleSync} disabled={syncMutation.isPending}>
            {syncMutation.isPending ? 'Starting...' : 'Start Sync'}
          </Button>
        </div>
      </Card>

      <Card className="p-6 space-y-4">
        <h2 className="text-lg font-semibold">Recent Sync Jobs (Last 10)</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b">
                <th className="p-2">Job ID</th>
                <th className="p-2">Status</th>
                <th className="p-2">Progress</th>
                <th className="p-2">New / Updated</th>
                <th className="p-2">Started At</th>
              </tr>
            </thead>
            <tbody>
              {jobs?.map((job) => (
                <tr key={job.id} className="border-b">
                  <td className="p-2 font-mono text-sm">{job.id.slice(0, 8)}...</td>
                  <td className="p-2">
                    <span
                      className={`px-2 py-1 rounded text-xs font-semibold ${
                        job.status === 'completed'
                          ? 'bg-green-100 text-green-800'
                          : job.status === 'failed'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-yellow-100 text-yellow-800'
                      }`}
                    >
                      {job.status}
                    </span>
                  </td>
                  <td className="p-2">
                    <div className="w-full bg-gray-200 rounded h-2.5">
                      <div
                        className="bg-blue-600 h-2.5 rounded"
                        style={{
                          width: `${job.total > 0 ? (job.progress / job.total) * 100 : 0}%`,
                        }}
                      ></div>
                    </div>
                    <span className="text-xs text-gray-500">
                      {job.progress} / {job.total} chunks
                    </span>
                  </td>
                  <td className="p-2">
                    {job.newCount} / {job.updatedCount}
                  </td>
                  <td className="p-2 text-sm text-gray-500">
                    {new Date(job.createdAt).toLocaleString()}
                  </td>
                </tr>
              ))}
              {(!jobs || jobs.length === 0) && (
                <tr>
                  <td colSpan={5} className="p-4 text-center text-gray-500">
                    No sync jobs found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {isUploadOpen && <PrivatBankUploadModal />}
    </div>
  );
}
```

- [ ] **Step 3: Test build & lint**

Run: `bun run lint && bun turbo build`
Expected: PASS without errors.

- [ ] **Step 4: Commit**

```bash
git add apps/web/
git commit -m "feat(web): add Data Sync page with job triggers, progress bars, and XLSX upload"
```
