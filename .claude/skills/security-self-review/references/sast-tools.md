# SAST Tools (JS/TS)

Trimmed to the JavaScript/TypeScript tooling relevant to this stack. Python,
Go, Java, Ruby, and SonarQube-server setups are omitted — not part of this
project.

## JavaScript/TypeScript

```bash
# Dependency vulnerabilities — cheapest check, run this first
bun audit
bun audit --json > bun-audit.json

# ESLint security plugin
bun add -d eslint-plugin-security
npx eslint --ext .js,.ts . --plugin security

# Semgrep — broader pattern-based SAST, works without a server
pip install semgrep  # or: brew install semgrep
semgrep --config=auto .
semgrep --config=p/owasp-top-ten .
```

## Optional: one-time CI check

If you want this to run automatically rather than manually:

```yaml
# .github/workflows/security.yml
name: Security
on: [push, pull_request]
jobs:
  security:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: bun audit --audit-level=high
```

Semgrep/Gitleaks GitHub Actions can be added the same way later if this
starts feeling worth automating — not necessary from day one on a solo
project.

## Quick Reference

| Tool | Purpose | Cost |
|------|---------|------|
| `bun audit` | Known-vulnerable dependencies | Free, built-in |
| `eslint-plugin-security` | Common insecure JS patterns | Free, one-time setup |
| Semgrep | Broader pattern-based SAST | Free tier, no server needed |
