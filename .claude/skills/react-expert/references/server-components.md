# Server Components

Note: this project doesn't use Next.js Server Actions for mutations —
mutations go through `react-hook-form` + generated React Query mutation
hooks on the client. Server Components below are for initial/read-only
server-side rendering only.

## Server vs Client Components

```tsx
// Server Component (default in App Router)
// Can: fetch data server-side, use async/await
// Cannot: use hooks, browser APIs, event handlers
async function ProductList() {
  const products = await getProductsServerSide();
  return (
    <ul>
      {products.map(p => <ProductCard key={p.id} product={p} />)}
    </ul>
  );
}

// Client Component (explicit) — mutations happen here via generated hooks
'use client';
import { useCreateCartItem } from '#src/_generated/api/pfd-components';

function AddToCartButton({ productId }: { productId: string }) {
  const { mutate, isPending } = useCreateCartItem();
  return (
    <button onClick={() => mutate({ productId })} disabled={isPending}>
      Add to Cart
    </button>
  );
}
```

## Streaming with Suspense

```tsx
import { Suspense } from 'react';

async function SlowComponent() {
  const data = await slowFetch();
  return <div>{data}</div>;
}

export default function Page() {
  return (
    <main>
      <h1>Dashboard</h1>
      <FastComponent />

      <Suspense fallback={<Skeleton />}>
        <SlowComponent />
      </Suspense>
    </main>
  );
}
```

## Passing Data Server → Client

```tsx
// Server Component fetches for initial render
async function ProductPage({ id }: { id: string }) {
  const product = await getProductServerSide(id);

  // Pass serializable data down; client component owns any
  // subsequent mutation via a generated hook
  return (
    <div>
      <h1>{product.name}</h1>
      <AddToCartButton productId={product.id} />
    </div>
  );
}
```

## Quick Reference

| Type | Can Use | Cannot Use |
|------|---------|------------|
| Server | async/await, server-side fetch | useState, onClick |
| Client | hooks, events, generated RQ hooks | async component |

| Pattern | Use Case |
|---------|----------|
| Server Component | Initial data for server-rendered pages |
| Client Component | Interactivity, mutations via generated hooks |
| `'use client'` | Mark client boundary |
| Suspense | Streaming, loading states |
