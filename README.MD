### 🛠️ AI Tooling & Environment Setup

This project uses a unified agent configuration layer shared between **Claude Code** and **Google Antigravity CLI**.

To avoid duplicating prompt skills, `.claude/skills` is a symlink pointing to `.agents/skills`.

- **Linux/macOS:** Git handles this symlink natively. If it breaks, re-link it using: `ln -s ../.agents/skills .claude/skills`
- **Windows Users:** Ensure your Git client has `core.symlinks=true` enabled before cloning, or developer mode turned on, otherwise Git will clear the link and replace it with a plain text file.
