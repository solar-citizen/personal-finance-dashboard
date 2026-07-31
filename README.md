# Personal Finance Dashboard

A modern, full-stack personal finance dashboard designed for tracking accounts, transactions, multi-currency assets, budgets, and financial insights with AI-powered analytics.

---

## Features

- **Dashboard & Analytics:** Comprehensive financial overview with real-time charts, category breakdowns, cash flow tracking, and custom date filtering built with Recharts.
- **Account Management:** Track bank accounts (including Monobank integration support), balances, types, and automated sync jobs.
- **Transactions & Categories:** View, filter, and categorize financial transactions with automated MCC (Merchant Category Code) analysis.
- **Multi-Currency Support:** Seamless handling of multiple currencies (UAH, USD, EUR) with exchange rates management and historical backfilling.
- **AI Financial Assistant:** Interactive chat assistant powered by Google Gemini and Ollama with semantic search over financial history and context-aware insights.
- **Secure Authentication:** JWT-based authentication using httpOnly cookies with secure dual extraction fallback.

---

## Tech Stack

### Backend (`apps/api`)

- **Framework:** NestJS (Modular Feature-based Architecture)
- **Database & ORM:** PostgreSQL with Prisma ORM & native pgvector extension support
- **Validation:** Zod schemas & `nestjs-zod` global validation pipe
- **AI / LLM:** `@google/generative-ai` & Ollama integration
- **Documentation & Codegen:** Swagger OpenAPI generation and automated TypeScript DTO/client SDK generation

### Frontend (`apps/web`)

- **Framework:** Next.js (App Router, React Compiler enabled)
- **UI & Styling:** Tailwind CSS v4, shadcn/ui components, Lucide icons, and Recharts for data visualizations
- **State & Data Fetching:** TanStack React Query with fully generated API client SDK and hooks
- **Form Management:** React Hook Form with Zod resolvers

### Monorepo & Tooling

- **Orchestration:** Bun Workspaces & Turbo
- **Linting & Formatting:** ESLint & Prettier

### AI Tooling & Environment Setup

This project uses a unified agent configuration layer shared between **Claude Code** and **Google Antigravity CLI**.

To avoid duplicating prompt skills, `.claude/skills` is a symlink pointing to `.agents/skills`.

- **Linux/macOS:** Git handles this symlink natively. If it breaks, re-link it using: `ln -s ../.agents/skills .claude/skills`
- **Windows Users:** Ensure your Git client has `core.symlinks=true` enabled before cloning, or developer mode turned on, otherwise Git will clear the link and replace it with a plain text file.

---

## Project Architecture

```
personal-finance-dashboard/
├── apps/
│   ├── api/          # NestJS backend API
│   └── web/          # Next.js frontend client
├── packages/
│   └── shared/       # Shared types & utilities
├── _generated/       # OpenAPI specifications & shared Zod schemas
├── docker-compose.yml# PostgreSQL database setup
└── turbo.json        # Monorepo build and dev orchestration
```

---

## Getting Started

### Prerequisites

- **Bun** (v1.3+)
- **Docker & Docker Compose** (for PostgreSQL database)
- **Node.js** (v20+ recommended)

### 1. Clone & Install Dependencies

```bash
git clone https://github.com/solar-citizen/personal-finance-dashboard.git
cd personal-finance-dashboard
bun i
```

### 2. Environment Setup

Each application requires its own environment file. Copy or create `.env` files in both `apps/api` and `apps/web`.

Example `apps/api/.env`:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/personal_finance?schema=public"
JWT_SECRET="YOUR_JWT_SECRET_HERE"
PORT=4000
```

Example `apps/web/.env`:

```env
NEXT_PUBLIC_API_URL="http://localhost:4000"
```

### 3. Start the Database

Start PostgreSQL via Docker Compose:

```bash
docker compose up -d
```

### 4. Run Database Migrations and Seeding

Push the Prisma schema and seed initial data:

```bash
cd apps/api
bun run db:push
bun run db:seed
cd ../..
```

### 5. Run API and Web App in Development

Run all monorepo services concurrently using Turbo:

```bash
bun turbo dev
```

Or run them individually:

- **API only:** `bun run dev:api` (runs on `http://localhost:4000`)
- **Web only:** `bun run dev:web` (runs on `http://localhost:3000`)

---

## Build & Scripts

- **Build all packages:** `bun turbo build`
- **Run lint checks:** `bun run lint`
- **Run code formatting:** `bun run format`
- **Generate API Client SDK:** `bun run codegen`

---

## License

GPL-3.0-only
