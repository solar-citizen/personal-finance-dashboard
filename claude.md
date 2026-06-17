# personal-finance-dashboard

Bun-based monorepo, orchestrated with Turbo:

- `apps/api` — NestJS API
- `apps/web` — Next.js client (uses the React Compiler)
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
- Each app has its own `.env` file (see `env.example` in each app)
- Database is managed via Docker

## Codegen sequencing

- Root `bun run codegen` is a plain shell script: api (`db:generate` → `dtos:generate` → `openapi:generate`) then web (`gen:api`), strictly sequential
- `bun turbo build`/`bun turbo dev` also run each package's own `codegen` task first per `turbo.json`, but `apps/web` and `apps/api` aren't linked via a workspace dependency in `package.json`, so Turbo's `^openapi:generate` graph dependency on web's `gen:api` task may not reliably order against api's output — if unsure, run root `bun run codegen` once before building
