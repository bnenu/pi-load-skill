# Design: tilde-expansion

## Approach

Add a single `expandTilde` helper and apply it at the two path entry points before
calling `path.resolve`. No other changes.

## expandTilde helper

```typescript
import os from "node:os";

function expandTilde(p: string): string {
  if (p === "~") return os.homedir();
  if (p.startsWith("~/") || p.startsWith("~\\")) return os.homedir() + p.slice(1);
  return p;
}
```

- `~` alone → home dir (edge case, valid)
- `~/foo` → `/Users/bn/foo`
- `~\foo` → handles Windows backslash (defensive, not a stated requirement)
- `~username` → left as-is (not supported, would need passwd lookup)
- anything else → unchanged

## Call sites

```
load-skills handler (line 213):
  BEFORE: const targetPath = path.resolve(args);
  AFTER:  const targetPath = path.resolve(expandTilde(args));

load_skill tool execute (line 309):
  BEFORE: const targetPath = path.resolve(params.path);
  AFTER:  const targetPath = path.resolve(expandTilde(params.path));
```

`resolveSkillPath` (line 101) is NOT changed — it is always called with an already-resolved
path from one of the two entry points above. `loadSkillsFromDirectory` (line 161) likewise.

## Why not expand in resolveSkillPath?

`resolveSkillPath` is an internal helper called with paths that have already passed through
the entry-point resolution. Expanding there too would be redundant and could mask bugs
where a raw `~` path leaks through an unexpected path. Single point of expansion at the
boundary is cleaner.

## Risks

None significant. `os.homedir()` is synchronous, always available in Node.js, and returns
an absolute path. The only theoretical issue is if `HOME` is unset in a sandboxed
environment — `os.homedir()` would return an empty string. This is an extreme edge case
and the resulting path would fail `fs.existsSync`, giving a clear "Path not found" error.
