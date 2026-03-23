# Brief: pi-load-skill 0.62 compatibility upgrade

## Goal

Make the `pi-load-skill` extension compatible with `@mariozechner/pi-coding-agent` >=0.62.0,
remove the now-broken persistence mechanism, and publish a new compatible version.

## Background

The current implementation (v1.0.2) targets pi >=0.50.0 and uses a temp-file + `isReloading`
flag + dual `session_start` handlers to survive reloads. This mechanism is broken in 0.62.0
because each `/reload` creates a fresh extension instance, resetting all in-memory state
including the `isReloading` flag — making the restore/clear logic unpredictable.

Additionally, the `before_agent_start` handler manually injects skill name/description XML
but omits the `<location>` field, so the agent cannot actually read the full skill content
on demand. This defeats the core purpose of the extension.

## What changes

- **Delete** the temp-file persistence mechanism (STORAGE_FILE, saveToFile, restoreFromFile,
  clearFile, isReloading flag, both session_start handlers)
- **Delete** the before_agent_start handler (manual skill XML injection)
- **Keep** the in-memory `loadedSkills` map as the single source of truth
- **Keep** the `resources_discover` handler — it already returns paths from the map; pi's
  native pipeline injects name + description + location into the system prompt correctly
- **Pin** peerDependency minimum to `>=0.62.0`
- **Bump** version to `1.1.0`
- **Update** CHANGELOG and README to reflect new behavior

## Persistence model (post-upgrade)

| Event         | Skills in session |
|---------------|-------------------|
| /load-skills  | loaded + reload triggered |
| /reload       | persisted (resources_discover refires from map) |
| /new          | skills may persist (pi does not reset the resource loader on /new) |
| /resume       | skills may persist (same reason) |
| /quit         | gone (process exit) |
| pi restart    | gone (fresh process) |

## Non-goals

- Persistence across /new or /resume (deferred, may revisit)
- Any new features beyond the compatibility fix

## Impact

Users on pi >=0.62.0 get a working extension. The session-scoped skill loading behavior
is now correct and simpler. Users can test locally before publishing.
