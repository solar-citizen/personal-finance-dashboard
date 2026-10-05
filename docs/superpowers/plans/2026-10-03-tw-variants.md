# Plan: Tailwind Variants Migration

## Context
Personal Finance Dashboard — Next.js 14 App Router + Tailwind CSS v4.
Branch: `chore/add-tw-variants`
Workspace: `apps/web/src`

## Global Constraints
- Use `tailwind-variants` (`tv()`) for ALL new variant logic — no raw `cn()` ternaries for variants
- All design tokens come from `globals.css` via CSS variables (`bg-primary`, `text-muted-foreground`, etc.) — NO raw hex, NO hardcoded colors
- Keep `cn()` in `lib/utils.ts` — it is still used for className merging at call sites
- Every component keeps its existing public API (same props, same element types)
- No tests exist — skip test steps; verify by TypeScript compilation (`bun run --cwd apps/web build` or `tsc --noEmit`)
- Do NOT use shadcn components — keep the custom component system
- Do NOT spawn subagents — implementer executes directly

## Tasks

### Task 1: Install tailwind-variants
Install `tailwind-variants` as a production dependency in `apps/web`.

```bash
bun add tailwind-variants --cwd apps/web
```

Verify it appears in `apps/web/package.json` under `dependencies`.

---

### Task 2: Create Button component
Create `apps/web/src/components/common/Button.tsx` using `tv()`.

**Variants:**
- `variant`: `primary` | `ghost` | `outline`  (default: `primary`)
- `size`: `sm` | `md` | `lg`  (default: `md`)
- `fullWidth`: `true` | `false`  (default: `false`)

**Slot:** `root` (the button element itself)

**Base classes (always applied):**
```
cursor-pointer inline-flex items-center justify-center whitespace-nowrap
font-medium transition-colors focus-visible:outline-none focus-visible:ring-2
focus-visible:ring-ring focus-visible:ring-offset-2
disabled:pointer-events-none disabled:opacity-50
```

**Variant classes:**
- `primary`: `bg-primary text-primary-foreground hover:bg-primary/90 rounded-md`
- `ghost`: `text-muted-foreground hover:text-destructive`
- `outline`: `border border-input bg-background text-foreground hover:bg-muted rounded-md`

**Size classes:**
- `sm`: `text-xs px-2.5 py-1`
- `md`: `text-sm h-10 px-4 py-2`
- `lg`: `text-base h-12 px-6 py-3`

**fullWidth:** `true` → `w-full`

**TypeScript interface:**
```ts
type ButtonProps = React.ComponentProps<'button'> & {
  variant?: 'primary' | 'ghost' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
};
```

Export as `default function Button`.

---

### Task 3: Rewrite Input + InputWrapper with tv() slots
Rewrite `apps/web/src/components/common/InputWrapper.tsx` and `apps/web/src/components/common/Input.tsx`.

**InputWrapper** becomes a `tv()` recipe with slots:
- `root`: `block relative w-full`
- `label`: `text-sm font-medium leading-none text-foreground mb-2 block`
- `tooltip`: `text-xs text-muted-foreground ml-1`
- `error`: `absolute text-sm text-destructive mt-1 left-0`

No variants needed — the wrapper has no conditional styling.

**Input** becomes a `tv()` recipe with slots:
- `root`: `flex-1 text-left px-3 py-2 text-sm ring-offset-0 w-full focus-visible:ring-0 focus-visible:outline-none rounded-[9px] border-border`

**Variants on Input:**
- `disabled` (boolean):
  - `true`: `bg-[--color-input-disabled] cursor-not-allowed opacity-60`
  - `false`: `bg-input`

Keep the same public API (same props exported from both files). `InputWrapper` still re-exports its `Props` type.

---

### Task 4: Rewrite Card with tv() slots
Rewrite `apps/web/src/components/ui/card.tsx`.

Single `tv()` call with these slots:
- `root`: `bg-card text-card-foreground flex flex-col gap-6 rounded-xl border py-6 shadow-sm`
- `header`: `flex flex-col gap-1.5 px-6`
- `title`: `text-lg font-semibold leading-none tracking-tight`
- `description`: `text-muted-foreground text-sm`
- `content`: `px-6`
- `footer`: `flex items-center px-6`

Each named export (`Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, `CardFooter`) stays — they still accept `className` and spread props. Call the `tv()` recipe inside the module, destructure the slots, and apply them in each component via `slots.root({className})`, etc.

---

### Task 5: Update PeriodSwitcher with tv()
Rewrite `apps/web/src/components/dashboard/PeriodSwitcher.tsx`.

Create a `tv()` recipe for the tab button:
- Slots: `root` (wrapper div), `button`
- `root` base: `flex gap-1 bg-secondary p-1 rounded-lg text-xs`
- `button` base: `px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer`
- Variant `active` (boolean) on `button`:
  - `true`: `bg-primary text-primary-foreground shadow-sm`
  - `false`: `text-muted-foreground hover:text-foreground`

Replace the `cn()` ternary with the `tv()` recipe.

---

### Task 6: Update LanguageSwitcher with tv()
Rewrite `apps/web/src/components/settings/LanguageSwitcher.tsx`.

Create a `tv()` recipe for the language option button:
- `button` base: `px-4 py-2 text-sm font-medium rounded-md border transition-colors cursor-pointer`
- Variant `selected` (boolean):
  - `true`: `bg-primary text-primary-foreground border-primary`
  - `false`: `bg-background text-foreground border-border hover:bg-muted`

Replace both duplicated `cn()` ternaries with the `tv()` recipe. 

---

### Task 7: Update MainNav with tv()
Rewrite `apps/web/src/components/MainNav.tsx`.

Create a `tv()` recipe:
- Slots: `root` (nav), `link`, `logoutButton`
- `root` base: `h-14 bg-background fixed top-0 right-0 left-0 z-10 flex w-full items-center justify-between px-5 py-2.5 shadow-md`
- `link` base: `transition-colors`; variant `active` (boolean):
  - `true`: `text-foreground font-semibold`
  - `false`: `text-muted-foreground hover:text-foreground`
- `logoutButton` base: `text-sm font-medium text-muted-foreground hover:text-destructive transition-colors cursor-pointer`

Replace the `cn()` ternary on the link.

---

### Task 8: Update consumers to use Button component
Update these files to use the new `Button` component instead of raw `<button>` elements with inline class strings:

1. `apps/web/src/components/auth/LoginForm.tsx` — replace the raw submit `<button>` with `<Button type="submit" disabled={isPending} fullWidth>` (variant=primary by default, size=md)
2. `apps/web/src/components/auth/RegisterForm.tsx` — same pattern as LoginForm
3. `apps/web/src/components/ai-chat/ChatBubble.tsx` — replace the raw `<button>` with `<Button variant="primary">` but keep the `fixed bottom-6 right-6 z-50 rounded-full p-4 shadow-lg hover:scale-105` classes via `className` prop (the Button's `className` merges in via `tv()`)
4. `apps/web/src/components/privatbank/PrivatBankUploadModal.tsx`:
   - The "cancel" button → `<Button variant="outline" size="md">` 
   - The "confirm/import" button → `<Button variant="primary" size="md">`, keep the `hover:scale-105` via `className`
   - The close (✕) button stays raw — it's icon-only with absolute positioning, not a standard button

Remove the `{/* FIXME: Consider using shadcn/custom component */}` comments.
