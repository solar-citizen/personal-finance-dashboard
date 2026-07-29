---
name: wrap-up
description: >-
  ONLY invoke when explicitly requested by the user (e.g. via /wrap-up) or at
  the very end of a multi-step session. Writes a memory entry for completed work and updates MEMORY.md.
license: MIT
metadata:
  author: solar._.citizen
  version: '0.0.2'
  role: specialist
  scope: implementation
  output-format: code
---

Follow the Memory Protocol in CLAUDE.md to close out the work done in this
session:

1. **Locate or Create Memory Folder:**
   - First, run `ls -d memory/*/` or check `memory/MEMORY.md` to review existing folders.
   - **Reuse existing folder if:** The current work is a fix, follow-up, iteration, or direct continuation of a recent item (especially from today or the current session).
   - **Create new folder only if:** The work addresses an entirely new, unrelated feature, refactor, or bug fix.
   - If creating new, use format: `memory/<ddmmyyHHMM>-<kebab-case-name>/` (run `date "+%d%m%y%H%M"` for current time).

2. **Write Numbered File:**
   - Look at existing files in the chosen folder (e.g., `1_...md`) and write the **next sequential number** (e.g., `2_<type>.md`).
   - Bullet points for: What changed, Why/decisions (if relevant), Files touched, Follow-ups.
   - **Do not modify** existing numbered files.

3. **Update MEMORY.md:**
   - Append a new line if it's a new folder, or update the existing line / status word (`Done` / `In Progress` / `To Be Done`) if appending to an existing memory folder—do not rewrite the rest of that line.

4. Show me the new file and the diff to `memory/MEMORY.md` before considering this done.

If nothing meaningful changed in this session, say so instead of writing a placeholder entry.
