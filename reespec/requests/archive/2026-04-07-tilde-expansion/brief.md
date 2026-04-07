# Brief: Tilde expansion in skill paths

## Goal

Fix `/load-skills ~/path` and the `load_skill` tool so that a leading `~` is expanded
to the user's home directory before path resolution, matching the behaviour users expect
from any Unix command-line tool.

## Background

`path.resolve("~/skills/xyz")` in Node.js treats `~` as a literal directory name and
resolves it relative to the current working directory, producing a path like
`/Users/bn/p/pel/pi-load-skill/~/skills/xyz`. This causes the "Path not found" error
users see when they type `/load-skills ~/skills/design`.

Tab completion is unaffected — the terminal expands `~` before passing the prefix to
`getArgumentCompletions`, so completions already work correctly.

## What changes

- Add `import os from "node:os"` to the extension
- Add a `expandTilde(p: string): string` helper that replaces a leading `~` or `~/`
  with `os.homedir()`
- Apply `expandTilde` before the two `path.resolve` call sites:
  - Line 213: `load-skills` command handler
  - Line 309: `load_skill` tool `execute`
- Add a `### Fixed` subsection to the existing `[1.2.0]` CHANGELOG entry (not yet published)

## Non-goals

- Expanding `~username` (other users' home dirs) — not a realistic use case here
- Changing tab completion — it already works
- Any other path handling changes

## Impact

Users can use `~` shorthand in `/load-skills` and the `load_skill` tool on macOS and Linux.
Folded into the unpublished `1.2.0` release — no version bump needed.
