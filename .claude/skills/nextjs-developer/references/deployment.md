# Deployment & Production

**Deploy target: self-hosted** (not Vercel). This changes the build output
and process-management approach — use Next's `standalone` output rather than
relying on Vercel's zero-config handling.

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

## Standalone Output (self-hosted)

Add `output: 'standalone'` to the existing config — don't replace it, extend it:

```typescript
// next.config.ts
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactCompiler: true,
  output: 'standalone',
};

export default nextConfig;
```

This produces `.next/standalone/` with a self-contained `server.js` plus a
pruned `node_modules` — no need to ship the full monorepo or run `bun i` on
the target machine.

```bash
# Build (from repo root, or via bun turbo build for the whole monorepo)
cd apps/web && bun run build

# Files to copy to the server:
# - apps/web/.next/standalone/   (includes server.js)
# - apps/web/.next/static/       (must be placed at .next/static relative to server.js)
# - apps/web/public/             (must be placed at ./public relative to server.js)

# Run
node apps/web/.next/standalone/apps/web/server.js
```

Note the standalone output path nesting: in a monorepo, `server.js` ends up
under `.next/standalone/<path-to-app>/server.js`, not directly at
`.next/standalone/server.js` as in a single-app repo — adjust paths in any
deploy script accordingly, and verify the exact nested path against a real
build output rather than assuming.

## Docker (self-hosted, bun-based)

```dockerfile
# Stage 1: deps
FROM oven/bun:1 AS deps
WORKDIR /app
COPY package.json bun.lock ./
COPY apps/web/package.json ./apps/web/
COPY apps/api/package.json ./apps/api/
RUN bun install --frozen-lockfile

# Stage 2: build
FROM oven/bun:1 AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN bun run codegen
RUN bun turbo build --filter=web

# Stage 3: runner
FROM oven/bun:1-slim AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/apps/web/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["bun", "apps/web/server.js"]
```

Verify the exact `COPY` source paths against a real `bun turbo build --filter=web`
output before relying on this Dockerfile — monorepo standalone output nesting
is easy to get subtly wrong, and this is written from the general pattern
rather than a confirmed build log.

## Process Management (non-Docker self-host alternative)

```bash
# If not using Docker — plain Node process behind a reverse proxy (nginx/Caddy)
node apps/web/.next/standalone/apps/web/server.js

# With PM2
pm2 start apps/web/.next/standalone/apps/web/server.js --name web
pm2 startup
pm2 save
```

A reverse proxy (nginx/Caddy) in front handles TLS termination and should be
configured to pass through cookies unmodified — don't let the proxy strip or
rewrite `Set-Cookie` headers, since the httpOnly `token` cookie round-trip
depends on them reaching the browser intact.

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

## next.config.ts

The real config is currently minimal:

```typescript
// next.config.ts
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactCompiler: true,
};

export default nextConfig;
```

Notes:

- **It's `next.config.ts`, not `.js`** — this project is on Next.js 16+,
  where a TypeScript config file is natively supported, and it's already
  written as a typed `NextConfig` with a `default export`. Don't suggest
  converting it to `.js`/`module.exports`.
- **`reactCompiler: true` is a top-level stable option in Next 16**, not
  `experimental.reactCompiler` — that nested-under-`experimental` form is the
  Next 14/15 syntax and would be wrong here. This matches the web
  `CLAUDE.md`'s note that the app uses the React Compiler, which is also why
  `useMemo`/`useCallback`/`React.memo` aren't used elsewhere in the codebase
  (see project conventions).
- **There's no `images.remotePatterns`, `compress`, or `headers()` config
  yet.** If a task needs one of these, add it to the existing object — don't
  regenerate the whole file from a generic template and drop the
  `reactCompiler` option in the process.

If security headers are needed later, they'd be added inside the existing
config object:

```typescript
const nextConfig: NextConfig = {
  reactCompiler: true,
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

## CI/CD (self-hosted — build + push image, deploy separately)

```yaml
# .github/workflows/deploy.yml
name: Deploy
on:
  push:
    branches: [main]
jobs:
  build-and-push:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: oven-sh/setup-bun@v1
      - run: bun i
      - run: bun run codegen
      - run: bun turbo build --filter=web
        env:
          NEXT_PUBLIC_API_URL: ${{ secrets.NEXT_PUBLIC_API_URL }}
      - name: Build and push Docker image
        run: |
          docker build -t your-registry/web:${{ github.sha }} -f apps/web/Dockerfile .
          docker push your-registry/web:${{ github.sha }}
      # actual deploy step (SSH + docker pull/restart, a orchestrator webhook,
      # etc.) depends on the specific host setup — not filled in, since that's
      # infra-specific and unconfirmed beyond "self-hosted"
```

## Production Checklist (trimmed to what's relevant here)

- [ ] `bun turbo build` passes with zero type errors
- [ ] `NEXT_PUBLIC_API_URL` set correctly for the target environment
- [ ] CORS on the API allows the deployed web origin with `credentials: true`
- [ ] Cookie `sameSite`/`secure` settings work across the actual prod domain
      topology (same-domain vs cross-domain API/web split)
- [ ] Images optimized via `next/image`
- [ ] Security headers configured
