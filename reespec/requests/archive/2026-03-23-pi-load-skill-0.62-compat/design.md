# Design: pi-load-skill 0.62 compatibility upgrade

## Core insight

pi 0.62.0's `resources_discover` event is fired with a `reason` field (`"startup"` | `"reload"`).
On `/reload`, pi:
1. Emits `session_shutdown` to the old extension runtime
2. Creates a brand-new extension instance (fresh in-memory state)
3. Emits `session_start` to the new instance
4. Emits `resources_discover(reason="reload")` to the new instance

This means any in-memory state set *before* reload (including `isReloading = true`) is gone
in the new instance. The temp-file workaround was the response to this, but introduces its
own race condition between two competing `session_start` handlers.

## Decision: in-memory map + resources_discover is sufficient

The `loadedSkills` map survives reload because `resources_discover` is called on the *new*
instance with paths from the map. Wait — actually the map is also reset on the new instance.

**Correction**: on reload, the new extension instance starts with an empty `loadedSkills` map.
`resources_discover` fires immediately after `session_start`, but the map is empty, so no
skills are returned. Skills are lost after reload.

**Resolution**: this is acceptable. The semantics we want are:
- Skills loaded in a session survive `/reload` within that same session ← this is now NOT
  possible without some form of persistence

**Re-evaluation after discovery**: we confirmed the user finds it acceptable that skills
do NOT persist through reload either, as long as this is documented. The temp-file approach
was trying to solve reload persistence but was broken. We choose not to solve it.

Wait — this contradicts the brief. Let me re-read the discovery conversation.

---

## Re-reading the requirement

From discovery: *"Skills persist through /reload"* was confirmed as desired.

This means we DO need some persistence through reload. The question is how.

## Options for reload persistence

**Option A — Temp file (current approach)**
Keep the temp file but fix the logic: use a single `session_start` handler, use
`resources_discover(reason)` to distinguish startup vs reload instead of the `isReloading` flag.

- On `resources_discover(reason="reload")`: return paths from restored temp file
- On `resources_discover(reason="startup")`: return nothing (fresh start)
- On `session_start`: always restore from file into map (will be a no-op on fresh start
  if file was cleared)
- On `session_shutdown`: do nothing (file persists across reload, gone on /quit is handled
  by OS temp file cleanup or explicit clear)

Problem: temp file lingers across full pi restarts too unless we clear it.

**Option B — Use resources_discover reason directly, no temp file**

`resources_discover` is the ONLY place we need to return paths. The trick:
- Store loaded skill paths in a module-level variable (outside the factory function)
- Module-level state persists across reloads because Node.js module cache is not cleared
  between reloads (jiti re-executes the factory but may cache the module)

Actually: jiti re-executes the entire module on reload, so module-level state is also reset.

**Option C — Single session_start handler + reason-aware resources_discover + temp file**

Fix the existing approach properly:
- ONE `session_start` handler: restore from temp file into map (harmless if file absent)
- `resources_discover`: return paths from map (always, regardless of reason)
- After load: save to temp file, reload
- On `session_shutdown`: clear temp file (this fires on /quit and on /reload)

Problem: `session_shutdown` fires on BOTH reload and quit. If we clear on shutdown,
we lose the file before the new instance can read it on reload.

**Option D — Don't clear on session_shutdown; clear on resources_discover(reason=startup)**

- `session_start`: restore from file into map (always)
- `resources_discover(reason="startup")`: clear file, return empty (fresh pi start)
- `resources_discover(reason="reload")`: return paths from map (keep file)
- After load: save to temp file, reload

This is clean:
- Fresh pi start → resources_discover(startup) → clear file → no skills
- /load-skills → save to file → reload → resources_discover(reload) → restore → skills present
- /reload manually → resources_discover(reload) → restore from file → skills present
- /quit → file lingers in /tmp but is cleared on next pi start

**Decision: Option D**

This is the correct fix. It uses the `reason` field (only available in >=0.62.0) to
distinguish startup from reload cleanly, without the isReloading flag race condition.
It requires only ONE session_start handler and removes the before_agent_start handler.

## What gets deleted

- `isReloading` flag and all code that sets/reads it
- Second `session_start` handler (the one that cleared the file)  
- The first `session_start` handler (restore logic) is simplified — just restore into map
- `before_agent_start` handler — pi's native pipeline handles injection correctly

## What gets added / changed

- `resources_discover` handler gains a `reason` check:
  - `"startup"` → clear temp file, return empty
  - `"reload"` → return paths from map

## resources_discover return value

The handler returns `{ skillPaths: string[] }` where each path is the skill directory path
(containing SKILL.md). pi's resource loader calls `loadSkills()` which reads SKILL.md and
extracts name, description, filePath for the system prompt.

## Version and peer dependency

- `version`: `1.0.2` → `1.1.0`
- `peerDependencies`: `"@mariozechner/pi-coding-agent": ">=0.50.0"` → `">=0.62.0"`

## Rationale for >=0.62.0 minimum

The `reason` field on `ResourcesDiscoverEvent` was introduced before 0.62.0 (it's present
in the CHANGELOG at 0.50.x range), but 0.62.0 is the version we have verified against and
the current latest. Pinning to >=0.62.0 is honest and safe.

## Files changed

- `extensions/load-skills.ts` — main implementation cleanup
- `package.json` — version bump, peerDependency pin
- `CHANGELOG.md` — document the change
- `README.md` — update persistence behavior description
