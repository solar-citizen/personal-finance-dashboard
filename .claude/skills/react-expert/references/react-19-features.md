# React 19 Features

Note: `useActionState` and `useFormStatus` are omitted here — they're built
around `<form action={...}>` / Server Actions, which this stack doesn't use
for mutations (forms use `react-hook-form` + generated mutation hooks
instead). `use()`, `useOptimistic`, and ref-as-prop are all still relevant
independent of that choice.

## use() Hook

```tsx
import { use, Suspense } from 'react';

// Read promises in render
function Comments({ commentsPromise }: { commentsPromise: Promise<Comment[]> }) {
  const comments = use(commentsPromise);
  return (
    <ul>
      {comments.map(c => <li key={c.id}>{c.text}</li>)}
    </ul>
  );
}

// Parent creates promise, child reads it
function Post({ postId }: { postId: string }) {
  const commentsPromise = fetchComments(postId);

  return (
    <article>
      <PostContent id={postId} />
      <Suspense fallback={<CommentsSkeleton />}>
        <Comments commentsPromise={commentsPromise} />
      </Suspense>
    </article>
  );
}
```

## useOptimistic

Useful alongside a generated mutation hook to reflect an update immediately
while the request is in flight.

```tsx
'use client';
import { useOptimistic } from 'react';
import { useCreateTodo } from '#src/_generated/api/pfd-components';

function TodoList({ todos }: { todos: Todo[] }) {
  const [optimisticTodos, addOptimisticTodo] = useOptimistic(
    todos,
    (state, newTodo: Todo) => [...state, newTodo]
  );
  const { mutate } = useCreateTodo();

  function addTodo(text: string) {
    addOptimisticTodo({ id: 'temp', text, completed: false });
    mutate({ text });
  }

  return (
    <ul>
      {optimisticTodos.map(todo => (
        <li key={todo.id}>{todo.text}</li>
      ))}
    </ul>
  );
}
```

## ref as Prop (No forwardRef)

```tsx
// React 19: ref is just a prop
function Input({ ref, ...props }: { ref?: React.Ref<HTMLInputElement> }) {
  return <input ref={ref} {...props} />;
}

// No need for forwardRef anymore
function Form() {
  const inputRef = useRef<HTMLInputElement>(null);
  return <Input ref={inputRef} placeholder="Enter text" />;
}
```

## Quick Reference

| Hook | Purpose |
|------|---------|
| `use()` | Read promise/context in render |
| `useOptimistic()` | Optimistic UI updates alongside a mutation hook |

| Pattern | When |
|---------|------|
| `use(promise)` | Suspense data fetching |
| `ref` as prop | Any component forwarding a ref, no `forwardRef` needed |
