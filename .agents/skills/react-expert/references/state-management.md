# State Management

This stack uses three tiers of state — local component state, Context for
auth, and server state via TanStack Query (through generated hooks). No
Zustand or Redux is part of the default toolkit; don't introduce one unless
the project explicitly adopts it.

## Local State (useState)

```tsx
function Counter() {
  const [count, setCount] = useState(0);

  const increment = () => setCount(prev => prev + 1);

  return <button onClick={increment}>{count}</button>;
}
```

## Context — used for auth

```tsx
interface AuthContext {
  user: User | null;
  isAuthenticated: boolean;
  logout: () => void;
}

const AuthContext = createContext<AuthContext | null>(null);

function AuthProvider({ children }: React.PropsWithChildren) {
  // user is typically sourced from a generated "me"/session query hook
  // rather than fetched manually here
  const { data: user } = useGetMe();

  const logout = () => {
    // call the generated logout mutation hook, then clear query cache
  };

  return (
    <AuthContext.Provider value={{ user: user ?? null, isAuthenticated: !!user, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be inside AuthProvider');
  return context;
}
```

Keep Context scoped to genuinely cross-cutting, rarely-changing state like
auth — it's not a general substitute for TanStack Query on server data, and
isn't meant to hold frequently-updating state (that causes re-renders across
every consumer).

## Server State — TanStack Query (via generated hooks)

Never call `useQuery`/`useMutation` with a hand-written `queryFn`/`mutationFn`
against this project's own API — use the generated hooks
(`useGetXxx`, `useCreateXxx`, etc.) from the OpenAPI codegen layer, which
already wire up the query key, fetcher, and Zod-derived types.

```tsx
// Pattern shown for reference — in this project, prefer the generated
// useGetUser / useUpdateUser hooks over writing this by hand.
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

function UserProfile({ userId }: { userId: string }) {
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ['user', userId],
    queryFn: () => fetchUser(userId),
    staleTime: 5 * 60 * 1000,
  });

  const mutation = useMutation({
    mutationFn: updateUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user', userId] });
    },
  });

  if (isLoading) return <Skeleton />;
  if (error) return <Error error={error} />;

  return <UserCard user={data} onUpdate={mutation.mutate} />;
}
```

## Quick Reference

| Solution | Best For |
|----------|----------|
| useState | Local component state |
| Context | Cross-cutting, rarely-changing state (auth) |
| TanStack Query (generated hooks) | All server state / API data |
