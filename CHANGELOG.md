# Changelog

All notable changes to this project will be documented in this file.

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
