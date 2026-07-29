# personal-finance-dashboard

## Monorepo structure

It is bun-based monorepo, orchestrated with Turbo:

- `apps/api` — NestJS API
- `apps/web` — Next.js client (uses the React Compiler), consumes apps/api via OpenAPI codegen
  (generated types/hooks/fetchers — see apps/web/CLAUDE.md before writing
  any API-related frontend code)
- `apps/api/prisma/schema/` — Prisma schema files

## Commands

- Install deps: `bun i` (run from root)
- Start dev (API + web): `bun turbo dev`
- API only: `cd apps/api && bun run dev`
- Web only: `cd apps/web && bun run dev`
- Build all: `bun turbo build`
- Lint: `bun run lint`
- Format: `bun run format`
- Start DB: `docker compose up -d`
- Stop DB: `docker compose down`
- Generate API types from OpenAPI (based on Prisma DTOs): `bun run codegen`

## Conventions

- TypeScript strict mode is enforced — respect `tsconfig.json` and the ESLint config (`eslint.config.mjs`)
- Use types, don't use interfaces
- Each app has its own `.env` file (see `env.example` in each app)
- Database is managed via Docker
- Code style conventions can be explored using eslint config files: root `eslint.config.base.mjs`, `apps/api/eslint.config.mjs` and `apps/web/eslint.config.mjs`

### Naming Conventions

- **camelCase** for all variables, constants, function names, and object keys — including zod schemas etc.
  - Correct: `usdToUah`, `eurToUah`, `exchangeRates`
  - Wrong: `USD_UAH`, `EUR_UAH`, `EXCHANGE_RATES`
- **PascalCase** for classes, types, enums, and Zod schemas
  - ✅ `ExchangeRatesSchema`, `CurrencyPair`
- **SCREAMING_SNAKE_CASE** — used only to name env variables, not for constants, not for object keys, not for schema field names

## API types & data fetching — generated layer, don't bypass it

This project generates a full client SDK from the NestJS API via OpenAPI codegen.
Never hand-write something that already exists in the generated layer.

Pipeline: NestJS controller endpoint (e.g. `@Get('exchange-rates')` returning a
DTO backed by a Zod schema) → OpenAPI spec → codegen produces, in order:

1. Zod schemas, re-exported from the `#pfd-schemas` barrel
   (apps/api/src/\_generated/zod/pfd-schemas.ts)
2. `fetchGetXxx` functions built on `pfdFetch`
3. `getXxxQuery` query-key/queryFn builders
4. `useGetXxx` / `useCreateXxx` react-query hooks in `apps/web/src/\_generated/api/pfd-components.ts`

Rules:

- Never define a manual TS type for API request/response data.
  Check `#pfd-schemas` for an existing Zod schema first and derive the type with
  `z.infer<typeof SomeSchema>`. Only write a new Zod schema if none exists, and
  put it in the relevant NestJS module's \*.schema.ts file — not in the frontend.
- Never call `apiFetch` or `pfdFetch` manually inside a component, hook, or custom
  useQuery/useMutation. Before writing any fetch logic, search
  `apps/web/src/\_generated/api/pfd-components.ts` for an existing generated hook
  matching the endpoint and method. If it exists, use it as-is — don't reimplement it.
- `apiFetch` (correct location: `apps/web/src/lib/api-client.ts`) is a low-level primitive
  only used internally to build `pfdFetch`. It should essentially never appear in
  component/page code.
- If the hook you need doesn't exist, the NestJS endpoint is missing or codegen
  hasn't been re-run — run `bun run dtos:generate` (or `bun run codegen`) after
  adding/changing endpoints. Don't hand-roll a substitute.

## Codegen sequencing

- Root `bun run codegen` is a plain shell script: api (`db:generate` → `dtos:generate` → `openapi:generate`) then web (`gen:api`), strictly sequential
- `bun turbo build`/`bun turbo dev` also run each package's own `codegen` task first per `turbo.json`, but `apps/web` and `apps/api` aren't linked via a workspace dependency in `package.json`, so Turbo's `^openapi:generate` graph dependency on web's `gen:api` task may not reliably order against api's output — if unsure, run root `bun run codegen` once before building

### OpenAPI codegen — `TData = undefined` means a broken response schema

**Symptom:** a generated hook has `TData = undefined` instead of a real DTO type.  
**Cause:** the controller returns an anonymous object shape instead of a named DTO class.  
**Rule:** every controller return type must be a named DTO class — no inline `Promise<{ key: Dto[] }>`.

```typescript
// ❌ codegen goes blind — anonymous wrapper
async getAccounts(...): Promise<{ accounts: MonoBankAccountResponseDto[] }>

// ✅ codegen works — named class
async getAccounts(...): Promise<GetMonoBankAccountResponseDto>
```

**Fix sequence:**

1. Add a wrapper Zod schema in the module's `*.schema.ts`
2. `bun run dtos:generate` → DTO class appears in `_generated/zod/pfd-dtos.ts`
3. Update the controller return type to use the new DTO
4. `bun run codegen`

Never work around `TData = undefined` on the frontend.

## Memory Protocol

This project keeps a local decision/work log in `/memory`. It is the source of
truth for past specs, decisions, and progress — not chat history, not "the
model probably remembers."

### Reading: route, don't vacuum

Before starting any non-trivial task:

1. Open `/memory/MEMORY.md` — the **index only**.
2. Scan entries for anything related to the current task (by title/description).
3. Open **only** the specific file(s) linked from the matching entries.
   Do not open every file in a matching folder, and do not open unrelated
   folders "just in case."
4. Nothing relevant found → proceed without opening anything else.

Never read `/memory` folder-by-folder or file-by-file speculatively.
`MEMORY.md` is the router; everything else is fetched on demand.

### Folder & file convention

- One folder per feature/fix:
  `memory/<ddmmyyHHMM>-<kebab-case-name>/`
  e.g. `memory/2708261400-add-dashboard-page/`
- Files inside are numbered in creation order and are **append-only** —
  never edit or delete a past numbered file:
  `1_<type>.md`, `2_<type>.md`, `3_<type>.md`, ...
  Typical `<type>` values: `audit`, `spec`, `implementation_prompt`,
  `additional_changes`, `architecture_decisions`, `bugfix`
- `todo.md` (unnumbered) inside a folder = open follow-ups for that feature.

### Writing: after finishing a unit of work

When you finish a task, a fix, or a meaningful chunk of a larger task —
**not after every message** — write ONE new numbered file into the relevant
folder (create the folder if this is the first entry for this feature).
Keep it short: bullets, not prose.

```md
# <Title>

## What changed

- ...

## Why / decisions

- only include this section if a real tradeoff was made — omit otherwise

## Files touched

- path/to/file.ts

## Follow-ups

- ... (or "None")
```

Then append one line to `/memory/MEMORY.md`:

```
- [<Title>: <Status>](<folder>/<file>) — <one-sentence description>
```

`<Status>` is one of `Done`, `In Progress`, `To Be Done`. If this continues an
existing feature, add a new line for the new file — never rewrite an old
line to change history.

### Hard rules

- Never open every file under `/memory` speculatively — route through
  `MEMORY.md` first.
- Never rewrite a past numbered file to "correct" it — write a new one.
  The trail is the point.
- Skip the write for trivial Q&A that changed nothing in the repo.
- If asked to `/wrap-up`, treat that as an explicit instruction to write the
  entry now, following the format above.
