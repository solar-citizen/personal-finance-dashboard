# Copilot AI Agent Instructions for personal-finance-dashboard

## Structure & Technologies

- This is a Bun-based monorepo for full-stack app, using:
  - **NestJS** (API, in `apps/api`)
  - **Next.js** (client/frontend, in `apps/web`)
  - **Prisma** (ORM, in `apps/api/prisma`)
  - **Turbo** for task orchestration
  - **Bun** as the package manager (see `bun.lock`)
- All apps and packages are in `apps/*` (see `package.json` -> `workspaces`).

## Key Workflows

- **Install dependencies:** `bun i` (root)
- **Start dev environment:** `bun turbo dev` (starts API and web-app)
- **Start DB (Docker):** `docker compose up -d`
- **Stop DB (Docker):** `docker compose down`
- **Build all:** `bun turbo build`
- **Lint:** `bun run lint` (uses ESLint)
- **Format:** `bun run format`
- **API dev:** `cd apps/api && bun run dev`
- **Frontend dev:** `cd apps/web && bun run dev`

## Project Conventions

- **TypeScript strict mode** is enforced (see `tsconfig.json`).
- **API:** Follows NestJS module structure. Use `apps/api/prisma/schema/` for DB schema.
- **Frontend:** Uses shadcn/ui and custom hooks/components (see `apps/web/src/components/`).
- **OpenAPI:** Use `bun run codegen` to generate API types from OpenAPI, based on Prisma DTO's.
- **Env files:** Each app expects its own `.env` (see `env.example`).
- **Database:** Managed via Docker.

## General Project Guidelines:

- See `eslint.config.mjs` or similar configs for full rules

- Respect ESLint and tsconfig settings

## Next.js Guidelines:

- Always use default exports for components and pages:

function FooPage() {...}

wrong:

export {FooPage}

correct:

export default FooPage

- Shadcn components (in components/ui folder) must not be edited directly (structure and styles) and are able to use named exports

- Always prefer putting loaders in a parent component instead of passing `isLoading` props down

- Always use explicit strings when adding texts to React Components, for example:

wrong:

<>
FooBar
</>

correct:

<>
{'FooBar'}
</>

- When creating pages, all included components should be extracted to a separate file

- There's no need to have memoization, using useMemo, useCallback, React.memo for optimization, as React Compiler is use in the project

- Avoid using extra `div`s. Use fragments (`<>...</>`) when possible. Flatten multiple nested elements when possible

- Prohibit redundant re-declarations of callbacks if they repeat the same signature as the prop:

type FooProps = {
onChange: (value: string) => void
}

wrong:

function Foo({onChange}:FooProps) {
const handleClick = useCallback(
(option: string) => () => {
onChange(option)
},[onChange])

return <button onClick={handleClick}>...</button>
}

correct:

function Foo({onChange}:FooProps) {
return <button onClick={onChange}>...</button>
}

- Prohibit defining `children` in prop types. Instead, use React.PropsWithChildren:

wrong:

type Props = {
children: React.ReactNode
}

correct:

type Props = React.PropsWithChildren<{
// other props
}>

- Prefer using strings with brackets for JSX text:

wrong:

<button type="button" />

correct:

<button type={'button'} />

## NestJS Guidelines:

- Never add `exports` or `imports` to modules, unless necessary
