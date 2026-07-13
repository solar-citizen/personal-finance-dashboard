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

Destructuring allows you to unpack values from arrays or properties from objects into distinct variables.

#### Object Destructuring

**Avoid:** Accessing properties one by one.

```javascript
const user = { name: 'Alice', age: 28, role: 'Engineer' };

// Clunky and repetitive
const name = user.name;
const age = user.age;
const role = user.role;
```

**Prefer:** Unpacking properties in a single line.

```javascript
const user = { name: 'Alice', age: 28, role: 'Engineer' };

// Clean and concise
const { name, age, role } = user;
```

#### Array Destructuring

**Avoid:** Using index numbers to assign variables.

```javascript
const coordinates = [40.7128, -74.006];

const lat = coordinates[0];
const lng = coordinates[1];
```

**Prefer:** Unpacking based on position.

```javascript
const coordinates = [40.7128, -74.006];

const [lat, lng] = coordinates;
```

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
