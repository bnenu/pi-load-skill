# Changelog

All notable changes to this project will be documented in this file.

## [1.2.3] - 2026-04-29

### Changed

- **Bumped minimum pi version to `>=0.70.6`** — aligned with latest pi release.
- **Replaced `@sinclair/typebox` 0.34.x with `typebox` 1.x** — migrated tool parameter schemas and dev dependency to the new `typebox` package name, matching pi's TypeBox 1.x migration introduced in pi 0.69.0. The `Type` API surface used by the extension (`Type.Object`, `Type.String`, `Type.Boolean`, etc.) is compatible and requires no code changes beyond the import path.

## [1.2.2] - 2026-04-17

### Changed

- **Bumped minimum pi version to `>=0.67.0`** — aligned with latest pi release.

## [1.2.1] - 2026-04-07

### Changed

- Added "Made with reespec" note to README.

## [1.2.0] - 2026-04-07

### Fixed

- **Tilde expansion in skill paths** — `/load-skills ~/path` and the `load_skill` tool
  now correctly expand a leading `~` to the user's home directory before resolving the path.
  Previously, `path.resolve("~/skills/xyz")` treated `~` as a literal directory name,
  producing a "Path not found" error on macOS and Linux.

- **`/load-skills` and `/unload-skills` no longer crash pi** — removed erroneous `async`
  keyword from both `getArgumentCompletions` callbacks. The implementations are purely
  synchronous (`readdirSync`, `Array.from`), so marking them `async` unnecessarily wrapped
  their return values in a `Promise`, causing a crash in pi's autocomplete pipeline.

### Changed

- **Persistence model replaced with session-entry storage** — skills are now persisted via
  `pi.appendEntry("pi-load-skill", { skills: [...] })` instead of a temp file. Every
  `/load-skills` and `/unload-skills` operation appends a snapshot entry to the session file.
  On `session_start`, the extension replays `ctx.sessionManager.getBranch()` and restores
  the map from the last snapshot in the current branch.
- **Correct behavior across all session transitions** — skills now survive `/reload`,
  `/resume`, and `/fork` correctly. `/new` starts with an empty skill set. Skills also
  survive pi restarts when the session is resumed.
- **Removed temp-file persistence** — `STORAGE_FILE`, `saveToFile`, `restoreFromFile`,
  `clearFile`, and the `node:os` import are fully removed. No temp files are written or read.
- **Minimum pi version unchanged** — still `>=0.62.0`, but 0.65.x is required for correct
  `/new`, `/resume`, and `/fork` behavior due to the `session_start` reason changes in 0.65.

### Persistence model

| Event                     | Skills in session                          |
|---------------------------|--------------------------------------------|
| `/load-skills`            | snapshot appended to session + reload triggered |
| `/unload-skills`          | snapshot appended to session + reload triggered |
| `/reload`                 | branch replayed → skills restored ✓        |
| `/new`                    | fresh session, no entries → map empty ✓    |
| `/resume`                 | branch replayed → skills restored ✓        |
| `/fork`                   | branch up to fork point replayed ✓         |
| pi restart + resume       | branch replayed → skills restored ✓        |
| pi restart (no resume)    | fresh session → map empty ✓                |

## [1.1.0] - 2026-03-23

### Changed

- **Minimum pi version bumped to `>=0.62.0`** — extension now requires
  `@mariozechner/pi-coding-agent` 0.62.0 or later.
- **Skills are now injected via pi's native system-prompt pipeline** — the previous
  manual `before_agent_start` injection is removed. Pi's `buildSystemPrompt` now handles
  injection, which correctly includes `<name>`, `<description>`, and `<location>` for
  each loaded skill. The `<location>` field is essential: it allows the agent to use the
  `read` tool to load the full skill content on demand.
- **Reload persistence simplified** — the broken `isReloading` flag and dual
  `session_start` handler approach is replaced with a single, correct mechanism:
  `resources_discover(reason="startup")` clears the temp file (fresh start, no stale
  skills); `resources_discover(reason="reload")` restores from the temp file (skills
  survive `/reload` within a session).

### Persistence model

| Event         | Skills in session       |
|---------------|-------------------------|
| `/load-skills`| loaded + reload triggered |
| `/reload`     | persisted ✓             |
| `/quit`       | gone (process exit)     |
| pi restart    | gone (temp file cleared on next startup) |

### Removed

- `isReloading` flag and all associated logic
- Second (duplicate) `session_start` handler
- `before_agent_start` handler (manual skill XML injection)
- `getAllSkillPaths()` helper (no longer needed)

## [1.0.2] - 2026-03-13

### Fixed
- Fixed typo in extensions directory name (`extentions` → `extensions`) that caused the extension code to be excluded from the published npm tarball
- Fixed `pi.extensions` path in package.json to match the corrected directory name
- Added `pi-package` keyword required for discoverability in the pi extensions gallery

## [1.0.1] - 2026-03-13

### Fixed
- Bug fixes and improvements

## [1.0.0] - 2026-03-12

### Added
- Initial release of pi-load-skill extension
- Load skills on-demand from any file path or directory
- Load individual skills or all skills from a directory
- Session-scoped skill loading (skills available only for current session)
- Temporary persistence through reloads (skills restored when reloading, cleared on fresh start)
- Unload skills functionality
- List loaded skills command
- Compatible with pi >= 0.50.0
