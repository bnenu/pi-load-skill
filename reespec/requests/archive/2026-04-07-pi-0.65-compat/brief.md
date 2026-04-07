# Brief: pi-load-skill 0.65 compatibility upgrade

## Goal

Fix `pi-load-skill` for `@mariozechner/pi-coding-agent` 0.65.x by replacing the broken
temp-file persistence mechanism with session-native `appendEntry()` persistence, and
correctly handling the new `session_start` reasons introduced in 0.65.

## Background

The 0.62 compat work (see archived request) intended to remove the temp-file mechanism
but did not — `STORAGE_FILE`, `saveToFile`, `restoreFromFile`, and `clearFile` are still
in the codebase. In 0.65, `/new`, `/resume`, and `/fork` now fire `session_start` with
reasons `"new"`, `"resume"`, `"fork"`, each followed by `resources_discover { reason: "startup" }`.
Our handler clears the map and temp file on every `"startup"` reason, so skills loaded
before a `/new`, `/resume`, or `/fork` are silently wiped.

## What changes

- **Delete** the temp-file persistence mechanism (`STORAGE_FILE`, `saveToFile`,
  `restoreFromFile`, `clearFile`) entirely
- **Change** `/load-skills` and `/unload-skills` handlers to call
  `pi.appendEntry("pi-load-skill", { skills: [...] })` with a full snapshot of the
  current map after each mutation
- **Change** `session_start` handler to clear the map then replay `ctx.sessionManager.getBranch()`
  — find the last `pi-load-skill` custom entry in the branch and restore the map from
  its snapshot. Works for all reasons: `"startup"`, `"reload"`, `"new"`, `"resume"`, `"fork"`
- **Keep** `resources_discover` handler unchanged — it already reads from the in-memory map
- **Bump** version to `1.2.0`
- **Update** CHANGELOG and README to reflect new persistence behavior

## Persistence model (post-upgrade)

| Event         | Skills in session |
|---------------|-------------------|
| /load-skills  | snapshot appended to session + reload triggered |
| /unload-skills | snapshot appended to session + reload triggered |
| /reload       | branch replayed → skills restored ✅ |
| /new          | no prior entries in new branch → map empty ✅ |
| /resume       | branch replayed → skills restored ✅ |
| /fork         | branch up to fork point replayed → correct skills ✅ |
| pi restart + resume | branch replayed → skills restored ✅ |
| pi restart (no resume) | fresh session, no entries → map empty ✅ |

## Snapshot model

A single custom entry type `pi-load-skill` stores the full skill list at the time of
each load/unload operation. On replay, only the **last** such entry in the current branch
path matters. This avoids needing a separate "unload" entry type and keeps replay trivial.

## Non-goals

- Any new features beyond the compatibility fix
- Changes to the `/load-skills`, `/unload-skills`, `/list-loaded-skills` command interface
- Changes to the `load_skill` tool interface

## Impact

Users on pi >=0.65.0 get correct skill persistence across all session transitions.
Skills now also survive `pi` restarts when the session is resumed — a free improvement
over previous behavior. Version bumped to `1.2.0`.
