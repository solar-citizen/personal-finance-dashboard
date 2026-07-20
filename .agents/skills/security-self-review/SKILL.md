---
name: security-self-review
description: Use when reviewing your own code (NestJS/Next.js/Prisma stack) for common vulnerability patterns before shipping — SQL injection, XSS, IDOR, path/command injection, hardcoded secrets. This is a lightweight self-review pass for a solo project, not a formal external audit — no rules-of-engagement, CVSS scoring, or stakeholder reporting. Pairs with fullstack-guardian, which handles security at build time; this skill handles the after-the-fact "did I actually do it" check.
license: MIT
metadata:
  version: "1.1.1-trimmed"
  domain: security
  triggers: security review, vulnerability check, SQL injection, XSS, IDOR, secrets scan, code audit
  role: specialist
  scope: review
  output-format: report
  author: adapted from https://github.com/Jeffallan/security-reviewer by solar._.citizen
  related-skills: fullstack-guardian
---

# Security Self-Review

Lightweight self-review pass for catching common vulnerability patterns in your own code before shipping — scoped to a solo NestJS + Next.js + Prisma + Zod project, not a client engagement.

## When to Use This Skill

- Reviewing a feature you just built for common vulnerability classes
- Checking for hardcoded secrets before a commit/push
- Running JS/TS dependency and static-analysis checks
- A second pass after `fullstack-guardian` has already built the feature with security in mind

## How this differs from a formal audit

No authorization/scope sign-off, no CVSS scoring, no stakeholder report, no penetration testing. You're reviewing your own code, not someone else's system. The output is a short list of findings with a fix, not a formal deliverable.

## Core Workflow

1. **Quick automated pass** — run `bun audit` and, if installed, `gitleaks detect --source .`
2. **Pattern review** — check the code you just wrote against `references/vulnerability-patterns.md`: SQL injection, XSS, IDOR, path traversal, command injection, insecure deserialization, sensitive data exposure
3. **Fix and re-check** — apply the secure version shown in the reference, re-run step 1 if relevant

## Reference Guide

| Topic | Reference | Load When |
|-------|-----------|-----------|
| Vulnerability Patterns | `references/vulnerability-patterns.md` | Reviewing any endpoint/component that touches user input, DB, or auth |
| SAST & Dependency Tools | `references/sast-tools.md` | Running `bun audit` / ESLint security / Semgrep against this repo |
| Secret Scanning | `references/secret-scanning.md` | Checking for hardcoded secrets before a commit |

## Constraints

### MUST DO
- Check that Prisma queries never interpolate raw user input into `$queryRawUnsafe`/raw SQL — use parameterized `$queryRaw` or the query builder instead
- Check authorization (not just authentication) on any endpoint scoped to a specific user's data — a NestJS guard checking "logged in" is not the same as checking "owns this resource"
- Check that Zod schemas actually validate the shape being trusted, not just parsed and ignored
- Give specific file/line locations and a concrete fix, not just "this could be vulnerable"

### MUST NOT DO
- Treat this as a substitute for `fullstack-guardian`'s build-time security checkpoint — this is the after-the-fact check, not the primary safeguard
- Produce a formal CVSS-scored report for a one-person project — a short findings list is enough
- Suggest infrastructure/cloud/pentest tooling (nmap, Vault, cloud security centers) — out of scope for a local Docker Compose project

## Output Format

For each finding:
```
Location: <file:line>
Issue: <what's wrong, one line>
Fix: <concrete code change>
```

No severity scoring, no executive summary — just the list.

## Knowledge Reference

OWASP Top 10, CWE references (for context, not formal reporting), Semgrep, ESLint security plugin, bun audit, gitleaks, Prisma-safe query patterns.
