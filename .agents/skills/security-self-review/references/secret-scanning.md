# Secret Scanning

Trimmed to Gitleaks — the single tool worth running for a solo project.
TruffleHog is redundant with it for this use case, and enterprise CI/CD
integration (GitLab SARIF reports, etc.) is omitted as unnecessary overhead.

## Gitleaks

```bash
# Install
brew install gitleaks

# Scan current directory (run before a commit/push if unsure)
gitleaks detect --source . --verbose

# Scan git history (run once, especially if a secret may have been committed before)
gitleaks detect --source . --log-opts="--all"

# Use baseline to ignore known/accepted findings
gitleaks detect --baseline-path .gitleaks-baseline.json
```

## Optional: pre-commit hook

```yaml
# .pre-commit-config.yaml
repos:
  - repo: https://github.com/gitleaks/gitleaks
    rev: v8.18.0
    hooks:
      - id: gitleaks
```

## Common Secret Patterns (for manual spot-checks)

| Type | Pattern | Example |
|------|---------|---------|
| AWS Access Key | `AKIA[0-9A-Z]{16}` | AKIAIOSFODNN7EXAMPLE |
| GitHub Token | `ghp_[A-Za-z0-9]{36}` | ghp_xxxxxxxxxxxx |
| Private Key | `-----BEGIN.*PRIVATE KEY-----` | RSA/EC keys |
| JWT | `eyJ[A-Za-z0-9_-]*\.eyJ` | Encoded tokens |

## If You Find One

1. **Rotate immediately** — treat it as compromised, don't just delete the line
2. **Remove from git history** if it was ever committed (`gitleaks` finding a hit in history means it's still there even after a later commit removes it)
3. **Move to `.env`** and confirm `.env` is in `.gitignore`

```bash
# Remove from git history (BFG - simpler than filter-branch)
bfg --replace-text secrets.txt repo.git
```
