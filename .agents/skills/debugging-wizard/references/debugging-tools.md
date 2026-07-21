# Debugging Tools

Trimmed to Node.js/TypeScript — Python (pdb), Go (delve), Rust (rust-gdb/lldb),
and Java sections are omitted as not part of this stack.

## Node.js / TypeScript

```bash
# Start with inspector
node --inspect dist/main.js

# Break on first line
node --inspect-brk dist/main.js

# With ts-node (or NestJS's dev script, which typically wraps this)
node --inspect -r ts-node/register src/main.ts
```

```typescript
// In code
debugger; // Breakpoint

// Quick print
console.log({ variable }); // Shows name and value
console.table(arrayOfObjects); // Table format
console.trace('Called from'); // Stack trace
```

## VS Code Debug Config

```json
// .vscode/launch.json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Debug NestJS API",
      "program": "${workspaceFolder}/apps/api/src/main.ts",
      "runtimeArgs": ["-r", "ts-node/register"],
      "cwd": "${workspaceFolder}/apps/api"
    },
    {
      "type": "node",
      "request": "attach",
      "name": "Attach to Next.js (bun run dev --inspect)",
      "port": 9229,
      "cwd": "${workspaceFolder}/apps/web"
    }
  ]
}
```

Adjust paths/scripts to match your actual `apps/api`/`apps/web` dev commands.

## Quick Reference

| Need | Tool |
|------|------|
| Breakpoint in code | `debugger;` |
| Print with name | `console.log({x})` |
| Stack trace | `console.trace()` |
| Inspect object | `console.dir(obj)` |
| Step through | VS Code debugger, or `node --inspect` + Chrome DevTools |
