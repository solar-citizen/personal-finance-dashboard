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

#### Nested destructuring is fine one level deep — worse beyond that

A "regular" destructure pulls fields off one object. Going one level deeper than that — destructuring a nested property's own fields inline, right where you unpack the parent — is fine, especially for small, well-recognized shapes. The cost only shows up when you stack _further_ than that: three or more levels forces the reader to hold an unfamiliar, multi-hop chain in their head before they can even see a variable name.

**Fine — one level deep:**

```typescriptreact
const handlePeriodChange = ({ target: { value } }: React.ChangeEvent<HTMLSelectElement>) => {
  if (isPeriod(value)) {
    setPeriod(value);
  }
};
```

```typescript
const {
  field: { ref, onBlur, onChange, value },
  fieldState,
} = useController<T>({ name, control, rules: deps ? { deps } : undefined });
```

Both of these go one level past the top object (`target` → `value`; `field` → `{ ref, onBlur, onChange, value }`). The shapes are small, and in the `target`/`field` cases, standard enough (DOM events, react-hook-form) that there's no real assembly required to read them — nothing here forces you to reconstruct an unfamiliar structure.

**Worse — two-plus levels deep:**

```javascript
const {
  user: {
    profile: { name, email },
  },
} = data;
```

This goes an extra hop further (`user` → `profile` → `name`/`email`), and unlike the examples above, `data`'s shape isn't a recognizable standard — it's specific to this codebase, so the reader has no shortcut and has to actually parse the nesting to know what they're looking at.

**Prefer, once you're past one level:**

```javascript
const profile = data.user.profile;
const { name, email } = profile;
```

Unpack one level at a time, in the order you actually need the data — this applies the same way in function parameter lists as it does in variable declarations; a signature isn't a special case that makes one extra level of nesting worse than it would be anywhere else.

#### Don't rename during destructuring without a reason

A rename should either resolve a genuine collision or add meaning the bare property name doesn't already have (`status` → `projectStatus`). If neither is true, it's just a longer name for the same thing, and the reader has to do a pointless mental translation back to the original.

**Avoid:**

```typescriptreact
const handleChange = ({ target: { value: targetValue } }: React.ChangeEvent<HTMLInputElement>) => {
  onChange(targetValue === '' ? null : targetValue);
};
```

`targetValue` doesn't disambiguate anything here — nothing else in this three-line handler is called `value`. The nesting itself isn't the problem (see above); the rename is.

**Prefer — either of these, the nesting depth is fine either way:**

```typescriptreact
const handleChange = ({ target: { value } }: React.ChangeEvent<HTMLInputElement>) => {
  onChange(value === '' ? null : value);
};

// or, equally fine:
const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
  const { value } = e.target;
  onChange(value === '' ? null : value);
};
```

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

**Caveat:** this doesn't apply if the fields get immediately regrouped under a matching key nearby — e.g. rebuilding `category: { id, name, icon }` right below `const { id, name, icon } = category`. The surrounding structure re-supplies the context a bare `id` would otherwise lose, and dot access here actively reads worse (`category: { id: category.id, name: category.name, ... }` stutters). The rule is for fields that get scattered across unrelated contexts, not ones reassembled as a matching unit one line away.

#### Watch for collisions with variables already in scope

Even a genuinely single-use, short-lived destructure can be worth skipping if the extracted name is nearly identical to something already visible nearby. The reader has to stop and confirm the two are actually the same thing, which defeats the point of destructuring.

**Avoid:**

```typescript
const adminEmail = process.env.SEED_ADMIN_EMAIL;
// ...
const { email } = await prisma.user.upsert({
  where: { email: adminEmail },
  create: { email: adminEmail /* ... */ },
});

console.log(`Admin created: ${email}`); // same as adminEmail? have to check
```

**Prefer:**

```typescript
const adminEmail = process.env.SEED_ADMIN_EMAIL;
// ...
const adminUser = await prisma.user.upsert({
  where: { email: adminEmail },
  create: { email: adminEmail /* ... */ },
});

console.log(`Admin created: ${adminUser.email}`); // unambiguous: the record's email
```

This also tends to come up when the source is a real domain entity (a DB record, an API resource) rather than a one-shot bag of return values — `adminUser` is a name worth having on its own, not overhead.

**Don't over-apply this in a typed codebase.** There are two different questions a similarly-named pair can raise, and only one of them is worth guarding against:

- _"Which entity does this belong to?"_ — in TypeScript, this is usually answered by the type itself. `{ id }: Account` tells you exactly what `id` is one hover or ctrl+click away. Qualifying it as `account.id` "just in case" doesn't add real information the tooling doesn't already give for free — and "someone could misread this" is true of almost any name, so it's not a real filter.
- _"Are these two values actually the same thing?"_ — this is what the `email`/`adminEmail` case above is really about. No type or hover answers whether a freshly-returned `email` equals the `adminEmail` used to look it up; only reading the logic does. This is the case worth keeping the qualifier for.
  Reserve this rule for the second kind of ambiguity, not the first.

#### Check what happens to the values afterward — not just how long the function is

"Long function → keep the object → use dot access" isn't a safe default on its own. If the extracted fields get reassembled into _new_ object literals later (e.g. passed to a logging call, or bundled into a return value), destructured locals let you use ES6 shorthand — `{ provider, reason }` — while dot access forces you to spell out every key twice: `{ provider: strategy.provider, reason: strategy.reason }`. That's strictly more repetition with no readability gain, the opposite of the intended effect.

**Avoid:**

```typescript
const strategy = this.queryStrategy.analyzeQuery(/* ... */);

this.queryStrategy.logStrategy(
  {
    provider: strategy.provider,
    contextLevel: strategy.contextLevel,
    reason: strategy.reason,
    type: strategy.type,
  },
  dto.message,
);
// ...
selectedModel: { provider: strategy.provider, reason: strategy.reason }
```

**Prefer:**

```typescript
const { contextLevel, provider, reason, type, dateRange } =
  this.queryStrategy.analyzeQuery(/* ... */);

this.queryStrategy.logStrategy({ provider, contextLevel, reason, type }, dto.message);
// ...
selectedModel: {
  (provider, reason);
}
```

Before flattening a destructure into dot access, check whether the fields get reused as shorthand properties downstream — if they do, destructuring wins even in a long function, as long as the names don't collide with anything else in scope (see above).

#### Match the idiom already used nearby for the same field

If another part of the same function already destructures a given field off the same entity type (e.g. `.filter(({ id }) => ...)`), don't flatten a different occurrence of that exact same access a few lines later. Two different styles for the same operation on the same kind of object, close together, costs more than either style would on its own — the reader has to notice the inconsistency before they can trust the two blocks are equivalent.

**Avoid (mixed within one function):**

```typescript
const core = items.filter(({ id }) => {
  if (seenIds.has(id)) return false;
  seenIds.add(id);
  return true;
});

for (const item of items) {
  // same check, different style
  if (seenIds.has(item.id)) {
    continue;
  }
  // ...
}
```

**Prefer:** pick one idiom for "get this entity's id" and use it everywhere in the function, even if one individual occurrence would look marginally better flattened on its own.

#### When the signals genuinely conflict

Sometimes a field really does need dot access even though sibling fields benefit from destructuring — but check carefully, because it's easy to talk yourself into a split that isn't earning its keep. A field only needs to stay qualified when there's a real _value-equivalence_ question (are these two things actually the same?) — not just because the name is short or generic. In a typed codebase, "which entity does this belong to" is usually answered by hovering, so that alone isn't reason enough to flatten.

For example, in a MonoBank sync loop, `iban`/`type` get reused as shorthand in two object literals (`create`/`update`), which is a real reason to destructure them. It might look like `id` should be flattened too, since `accountId: account.id` sits near a differently-named `accountId` key — but that's a "which entity" question, not a value-equivalence one, so it's resolved by the type, not by qualifying it. Once you discount that, there's no remaining reason to split the object apart:

```typescript
for (const { currencyCode, id, iban, type, balance, creditLimit } of accounts) {
  const currency = iso4217ToCurrency[currencyCode];

  await this.prismaService.account.upsert({
    where: { userId_accountId: { userId, accountId: id } },
    create: { accountId: id, iban, type, currency, balance: BigInt(balance) /* ... */ },
    update: { iban, type, currency, balance: BigInt(balance) /* ... */ },
  });
}
```

Full destructure here is simpler and just as clear as a mixed version, once the collision concern is properly scoped down to real value-equivalence cases (see above). Reach for a split only when a specific field has a concrete reason to stay qualified — not preemptively.

#### Rule of thumb

- **Destructure** when it gives the code better vocabulary, or when the object is local and short-lived.
- **Don't destructure** when it only saves characters, especially in larger functions where `object.property` keeps the reader oriented.
- **One level of nesting beyond the top object is fine** (`target: { value }`, `field: { ref, onBlur, value }`) — two-plus levels deep, into an unfamiliar shape, is where it starts costing more than it saves.
- **Don't rename during destructuring without a reason** — a rename should resolve a collision or add real meaning; otherwise it's a longer name for the same thing.
- **Don't name a variable only to destructure it on the next line** — if the wrapper object won't be referenced again as a whole, destructure directly at the source (e.g. straight off an `await` call, or in a callback's param list instead of its body).
- **Keep the qualifier for generic property names** (`id`, `name`, `status`, `icon`) — `category.id` disambiguates itself; a bare `id` doesn't.
- **Watch for collisions with existing variables in scope** — if the destructured name nearly matches something already visible nearby (`email` next to `adminEmail`), keep the qualifier even for a single-use value.
- **Check if the fields get reassembled into new object literals downstream** — if so, keep them destructured so you can use shorthand (`{ provider, reason }`), even in a long function. Dot access forces `key: obj.key` repetition with no benefit.
- **Match the idiom already used nearby for the same field on the same entity type** — don't destructure in one spot and dot-access in another for the identical operation within one function.

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
