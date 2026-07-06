# Deployment & Production

**Unconfirmed:** I don't know your actual deploy target (Vercel vs
self-hosted vs Docker) — the sections below are adjusted for your bun/Turbo
monorepo structure where I could infer it, but verify the platform-specific
parts against your actual setup rather than assuming.

## Monorepo Build Commands (confirmed from project CLAUDE.md)

```bash
# Install deps (from repo root)
bun i

# Build everything
bun turbo build

# Web app only
cd apps/web && bun run dev
```

Do not use plain `npm run build`/`npm ci` for this project — it's a bun +
Turbo monorepo (`apps/api`, `apps/web`), and build ordering matters: web's
`gen:api` codegen step depends on the API's OpenAPI output. If unsure whether
generated types are fresh, run root `bun run codegen` once before building —
see the project's root `CLAUDE.md` for the full sequencing caveat (`turbo.json`
graph dependencies between `apps/web` and `apps/api` aren't guaranteed to
order correctly since the two apps aren't linked via `package.json`
workspace dependency).

## No Local Database in the Web App

Unlike the generic Next.js deployment guidance around Prisma connection
pooling or a `lib/db.ts` singleton, **this project's web app has no direct
database access at all** — all persistence goes through the NestJS API. Don't
add a Prisma client, connection pooling setup, or a `$queryRaw` health check
to the Next.js app; if you need a health check, hit the API's own health
endpoint instead:

```tsx
// app/api/health/route.ts — only if you actually need this; not currently present
export async function GET() {
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/health`);
  return Response.json({ apiHealthy: res.ok });
}
```

(This would be the one legitimate case for a Route Handler in this app — a
thin proxy, not business logic. See `app-router.md`'s note on Route Handlers
not otherwise being used.)

## Environment Variables

```bash
# apps/web/.env (see apps/web/env.example)
NEXT_PUBLIC_API_URL="https://api.example.com"
```

```tsx
// Client Components can only read NEXT_PUBLIC_-prefixed vars
const apiUrl = process.env.NEXT_PUBLIC_API_URL;
```

Since the web app doesn't hold server-only secrets (no DB credentials, no
JWT signing secret — those live in `apps/api`), most of its env vars are
`NEXT_PUBLIC_*` by necessity. Don't assume a server-only secret pattern
(`DATABASE_URL`, `NEXTAUTH_SECRET`) exists here — that config lives in the API
app instead.

## next.config.js — Image Optimization & Headers

These are stack-agnostic Next.js config and still apply as-is:

```js
/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [
      { protocol: 'https', hostname: 'cdn.example.com', pathname: '/images/**' },
    ],
  },
  compress: true,
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'Referrer-Policy', value: 'origin-when-cross-origin' },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
```

## CORS — the thing most likely to bite you in production

Since auth is cookie-based across two separately-deployed apps (`apps/api`,
`apps/web`), production CORS config on the API side needs:
- `credentials: true`
- an **explicit** origin matching the deployed web app's URL — never `'*'`
- the cookie's `sameSite`/`secure` settings need to tolerate cross-subdomain
  requests if API and web are on different subdomains of the same domain, or
  need `sameSite: 'none'` (with `secure: true`) if they're on genuinely
  different domains

If auth works locally but breaks in production, check this before anything
else client-side.

## CI/CD (adjust for actual platform once confirmed)

```yaml
# .github/workflows/deploy.yml — bun/turbo-aware version
name: Deploy
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: oven-sh/setup-bun@v1
      - run: bun i
      - run: bun run codegen
      - run: bun turbo build
        env:
          NEXT_PUBLIC_API_URL: ${{ secrets.NEXT_PUBLIC_API_URL }}
      # deployment step depends on actual target platform — fill in once confirmed
```

## Production Checklist (trimmed to what's relevant here)

- [ ] `bun turbo build` passes with zero type errors
- [ ] `NEXT_PUBLIC_API_URL` set correctly for the target environment
- [ ] CORS on the API allows the deployed web origin with `credentials: true`
- [ ] Cookie `sameSite`/`secure` settings work across the actual prod domain
      topology (same-domain vs cross-domain API/web split)
- [ ] Images optimized via `next/image`
- [ ] Security headers configured

Removed from the generic checklist since they don't apply here: database
connection pooling, `NEXTAUTH_SECRET`, and any local-DB health check — none
of these exist in this app's architecture.
