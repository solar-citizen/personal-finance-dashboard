# Using `the-fool` — Example Prompts

Practical examples for invoking the `the-fool` skill in Claude Code against the
`personal-finance-dashboard` project (NestJS + Next.js + PostgreSQL + Prisma
engineless + Zod). Copy any of these as a starting point, or use them as a
template for your own.

---

Run /the-fool `prompt...`

---

## Example 1 — Architecture decision, letting Claude choose the mode

**Prompt:**

> I'm thinking about splitting the exchange-rate service into its own NestJS
> microservice instead of keeping it as a module in the monolith. Play the
> fool on this.

**What happens:**

1. Claude restates your position as a steelmanned thesis: _"Extracting the
   exchange-rate service would let it scale/deploy independently and isolate
   its external API dependency from the rest of the app."_
2. It calls `AskUserQuestion` with category options: _Question assumptions /
   Build counter-arguments / Find weaknesses / You choose_.
3. Picking **"You choose"** loads `mode-selection-guide.md`. "Architecture
   decision" maps to **Pre-mortem Analysis** as the primary recommendation,
   with Dialectic Synthesis as a possible follow-up.
4. Pre-mortem: imagines it's 6 months out and the split failed — e.g. _"the
   exchange-rate service now needs its own auth, deploy pipeline, and
   monitoring, none of which existed for a single-module concern, and you
   spend more time on ops than the feature itself."_
5. Output: 3-5 ranked failure narratives, early warning signs, mitigations,
   then a synthesis (likely: don't extract yet, extract when a concrete
   scaling trigger actually appears).

---

## Example 2 — Naming the mode directly

**Prompt:**

> Red team my current auth setup — cookie-based JWT with httpOnly cookies, no
> refresh token rotation yet.

Naming "red team" explicitly skips mode selection. Goes straight to
`red-team-adversarial.md`: builds adversary personas (disgruntled insider,
external attacker via XSS-into-cookie-theft, session-fixation angles), ranks
attack vectors, proposes defenses (rotation, short TTL, revocation list).

---

## Example 3 — Testing a claim before committing further

**Prompt:**

> I read that Prisma's engineless mode has no meaningful performance cost vs
> the old query engine. Test the evidence on that before I commit further.

Triggers **Evidence Audit**: extracts the claim, designs a falsification
criterion (e.g. "if p95 query latency increases >10% in a benchmark, the
claim is false"), grades the evidence you actually have (likely C/D if it's
just a blog post rather than a benchmark you ran yourself), and suggests a
concrete test — benchmarking your own queries pre/post instead of trusting
the marketing claim.

---

## Example 4 — Vague/exploratory, no mode named

**Prompt:**

> I want to add a budgeting feature but I'm not sure the schema is right yet.
> Challenge my thinking.

No mode named and the context is vague, so per the mode-selection guide's
edge case rule ("vague context → default to Socratic Questioning"), it
surfaces assumption-probing questions like _"When you say 'budget,' do you
mean a fixed monthly cap per category, or a rolling average? Does that
change your schema?"_ — designed to expose assumptions before you commit to
a schema.

---

## When to reach for this vs. not

- **Good fit:** architecture/schema decisions, technology choices, anything
  where getting it wrong is expensive to unwind later — especially useful
  right now since the pet project's explicit goal is to deepen NestJS/Next.js
  knowledge, and being forced through a pre-mortem or red-team pass on a
  design choice is a good way to learn _why_ a pattern matters, not just
  _that_ it exists.
- **Skip it for:** routine feature implementation, small bug fixes, anything
  where you already know the answer and just need it built. The skill only
  activates on trigger phrases (or explicit invocation), so it won't fire
  uninvited on everyday work.
