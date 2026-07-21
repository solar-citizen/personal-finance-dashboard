# Monorepo Rule Cascading Policy

Before introducing code changes, suggesting refactors, or running terminal execution scripts, you must consult and match rules across our layered files:

1. **Global/Monorepo Scope:** Always prioritize the root `CLAUDE.md` to check global environmental constants, build commands, and global constraints.
2. **Context-Specific Scope:**
   - If your current file target or shell execution workspace resides inside `apps/api/`, you must read and adhere to `apps/api/CLAUDE.md`.
   - If your current file target or shell execution workspace resides inside `apps/web/`, you must read and adhere to `apps/web/CLAUDE.md`.
3. **Precedence:** The local applications' `CLAUDE.md` rules always take absolute precedence and act as a total override against conflicting rules established at the root level.
