# Additional Style Guiding

## `any`

- Default is no `any`, no `as any`
- Acceptable `any`: values at the actual wire boundary — `req.json()` results and the parsed Gemini API response. These are external, loosely-typed JSON APIs we don't control
- Not acceptable: `any` on anything we construct and fully control ourselves — give it a real `type`
- Not acceptable: `as any` used to silence a type error rather than fix the underlying type. If you're reaching for `as any` outside the very specific cases, that's a sign the translation function's types are wrong, not that the cast is fine

## Destructuring, Rest and Spread operators

Prefer to use destructure, rest and spread operators when possible

Below are practical **Before (Avoid)** and **After (Prefer)** examples for each.

---

### 1. Destructuring (Extracting Values)

Destructuring unpacks values from arrays or properties from objects into distinct variables. It's a tool for improving readability — not a default habit. Use it when it adds vocabulary to the code; skip it when it only saves keystrokes.

**The core question:** does removing the object make this easier to understand, or does it just make it shorter? If it's the latter, keep the object reference.

#### Avoid destructuring when it strips useful context

In longer functions, `object.property` keeps the reader anchored to where a value came from. A bare variable name forces them to scroll back up to remember.

**Avoid:**

```javascript
const { id, status, owner, createdAt, updatedAt } = project;

// ...many lines later...
saveAuditLog(owner);

// ...many more lines...
if (status === 'archived') {
  archive(project);
}
```

**Prefer:**

```javascript
if (project.status === 'archived') {
  archive(project);
}

saveAuditLog(project.owner);
```

Repeating `project.` a few extra times costs almost nothing. Losing track of where `status` came from costs more.

#### Avoid nested destructuring that forces you to grasp the whole shape upfront

**Avoid:**

```javascript
const {
  user: {
    profile: { name, email },
  },
} = data;
```

**Prefer:**

```javascript
const profile = data.user.profile;
const { name, email } = profile;
```

Unpack one level at a time, in the order you actually need the data.

#### Prefer destructuring when the object is short-lived and local

If the object only exists for a few lines (event handlers, array callbacks, single-use API responses), destructuring removes noise without costing context — there's nothing to forget.

```javascript
const { currentTarget } = event;

const { data } = response;

posts.map(({ id, title }) => <Post key={id} title={title} />);
```

#### Prefer destructuring when it improves the vocabulary

If unpacking (and optionally renaming) a value turns it into a meaningful standalone name, it's worth it — this is the one case where introducing a new variable pays for itself.

```javascript
const { status: projectStatus } = project;
```

But if you're just going to reuse the object's own name (`project.status` → `status`), you likely haven't gained anything — `project.status` already reads naturally and needs no new name to remember.

#### Don't introduce a variable just to immediately destructure it

The "keep the object around" guidance only applies when the object itself is worth keeping — a cohesive domain concept you might reference again as a whole. A function's return value is often just a bag of unrelated results bundled for convenience, not a domain entity. If you're going to destructure it on the very next line and never touch the wrapper again, naming it first adds a variable with zero payoff.

**Avoid:**

```typescript
const conversationData = await this.prepareConversation(userId, dto);
const { conversationId, messages, context, selectedModel, isLockedToGemini } = conversationData;
```

**Prefer:**

```typescript
const { conversationId, messages, context, selectedModel, isLockedToGemini } =
  await this.prepareConversation(userId, dto);
```

Ask: will I ever reference the whole object again, by name, as one concept? If not — if its fields are just separate concerns that happen to travel together — destructure it where it's created instead of stashing it in an intermediate variable first.

This applies to function/callback params too, not just `await` results:

**Avoid:**

```typescriptreact
expenses.map((expense) => {
  const { category, amount, currency } = expense;
  // `expense` itself is never used again
  ...
});
```

**Prefer:**

```typescriptreact
expenses.map(({ category, amount, currency }) => {
  ...
});
```

#### Keep the qualifier for generic property names

Some property names (`id`, `name`, `status`, `icon`, `type`) are ambiguous on their own — the reader can't tell which entity they belong to without scrolling to find the destructure, especially when more than one object in scope could plausibly have a property with that name. For these, `parent.property` is clearer than destructuring, even in an otherwise-short-lived scope.

**Avoid:**

```typescriptreact
const { id, name, icon } = category;
// later: key={id} — id of what?
```

**Prefer:**

```typescriptreact
// no need to unpack category at all — reference it directly
<li key={category.id}>
  <span>{category.icon}</span>
  <div>{category.name}</div>
</li>
```

This is the nested-destructuring problem in disguise: don't unpack a sub-object's generic fields just because you're already inside a destructured parent.

#### Rule of thumb

- **Destructure** when it gives the code better vocabulary, or when the object is local and short-lived.
- **Don't destructure** when it only saves characters, especially in larger functions where `object.property` keeps the reader oriented.
- **Don't nest-destructure** — unpack incrementally, matching how you actually think about the data.
- **Don't name a variable only to destructure it on the next line** — if the wrapper object won't be referenced again as a whole, destructure directly at the source (e.g. straight off an `await` call, or in a callback's param list instead of its body).
- **Keep the qualifier for generic property names** (`id`, `name`, `status`, `icon`) — `category.id` disambiguates itself; a bare `id` doesn't.

---

### 2. The Spread Operator (`...`)

The spread operator expands an iterable (like an array or object) into individual elements. It is incredibly useful for copying or merging data without mutating the original source.

#### Merging Objects

**Avoid:** Using `Object.assign()` or mutating an existing object.

```javascript
const user = { name: 'Bob', age: 30 };
const preferences = { theme: 'dark', notifications: true };

// Verbose and slightly harder to read
const userProfile = Object.assign({}, user, preferences);
```

**Prefer:** Spreading properties into a new object literal.

```javascript
const user = { name: 'Bob', age: 30 };
const preferences = { theme: 'dark', notifications: true };

// Highly readable
const userProfile = { ...user, ...preferences };
```

#### Merging and Copying Arrays

**Avoid:** Using `.concat()` or `.slice()` for basic array operations.

```javascript
const teamA = ['Alice', 'Bob'];
const teamB = ['Charlie', 'Dave'];

// Merging
const wholeTeam = teamA.concat(teamB);

// Copying
const teamACopy = teamA.slice();
```

**Prefer:** Spreading elements into a new array.

```javascript
const teamA = ['Alice', 'Bob'];
const teamB = ['Charlie', 'Dave'];

// Merging
const wholeTeam = [...teamA, ...teamB];

// Copying
const teamACopy = [...teamA];
```

---

### 3. The Rest Operator (`...`)

While it looks exactly like the spread operator, the rest operator does the exact opposite: it collects multiple elements and condenses them into a single array or object.

#### Function Parameters

**Avoid:** Using the bulky, array-like `arguments` object when a function accepts an indefinite number of arguments.

```javascript
function sumAll() {
  let total = 0;
  for (let i = 0; i < arguments.length; i++) {
    total += arguments[i];
  }
  return total;
}
```

**Prefer:** Using the rest operator to gather arguments into a true array, which allows you to use modern array methods like `.reduce()`.

```javascript
function sumAll(...numbers) {
  return numbers.reduce((total, num) => total + num, 0);
}
```

#### Omit Properties from an Object

You can combine destructuring and the rest operator to easily remove a specific property from an object while keeping the rest intact.

**Avoid:** Using `delete`, which mutates the original object and is bad for performance.

```javascript
const user = { id: 1, name: 'Eve', password: 'supersecret' };

const safeUser = Object.assign({}, user);
delete safeUser.password; // Mutates the copied object
```

**Prefer:** Destructuring the property you want to discard and using the rest operator to gather the remaining properties into a new object.

```javascript
const user = { id: 1, name: 'Eve', password: 'supersecret' };

// Extracts 'password', and puts everything else into 'safeUser'
const { password, ...safeUser } = user;
```
