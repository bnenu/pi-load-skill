# Design: pi-0.65-compat

## Approach

Replace the temp-file persistence mechanism entirely with pi's native session entry
persistence (`appendEntry` / `getBranch`). The in-memory `loadedSkills` map remains
the single source of truth at runtime; the session file becomes the durable store.

## Key Design Decisions

### 1. Session entries as the persistence store

`pi.appendEntry("pi-load-skill", { skills: [...] })` appends a `CustomEntry` to the
session file. On every `session_start` the extension replays `ctx.sessionManager.getBranch()`
— the ordered path from the current leaf back to the root — finds the last `pi-load-skill`
entry, and restores the map from its `skills` snapshot.

**Why `getBranch()` not `getEntries()`**: `getEntries()` returns ALL entries in the file
including abandoned branches. `getBranch()` returns only the entries on the current branch
path (root → leaf), which is the correct set to replay.

**Why snapshot not event-log**: A snapshot entry (full skills list) makes replay trivial
— find the last entry, use it. An event-log approach (load/unload events) requires
replaying every mutation and is more complex with no real benefit for this use case.

### 2. Single entry type `pi-load-skill`

Both load and unload operations write the same entry type with the current full snapshot
after the mutation. This means:
- Load foo, load bar, unload foo → last entry has `{ skills: [bar] }` → correct
- Fork from before "unload foo" → last entry in that branch has `{ skills: [foo, bar] }` → correct

### 3. `resources_discover` unchanged

`resources_discover` already reads from the in-memory map and returns `skillPaths`.
No changes needed. The fix is entirely in how the map is populated and persisted.

### 4. `session_start` handles all reasons uniformly

```
session_start (any reason):
  1. loadedSkills.clear()
  2. walk getBranch()
  3. find last entry where type === "custom" && customType === "pi-load-skill"
  4. if found: restore map from entry.data.skills (skip entries whose SKILL.md is gone)
  5. notify user
```

This works correctly for every transition:

| Reason    | Branch contents                        | Result              |
|-----------|----------------------------------------|---------------------|
| startup   | entries from loaded/resumed session    | skills restored ✅  |
| reload    | same branch + new entries since reload | skills restored ✅  |
| new       | empty (fresh session, no entries)      | map empty ✅        |
| resume    | full branch of resumed session         | skills restored ✅  |
| fork      | branch up to fork point                | correct skills ✅   |

### 5. Temp file removed entirely

`STORAGE_FILE`, `saveToFile`, `restoreFromFile`, `clearFile`, and the `os` import are
all deleted. The `StoredSkill` interface is replaced by the `SkillSnapshot` type used
in the entry data.

### 6. `load_skill` tool — no `appendEntry` call

The `load_skill` tool mutates the in-memory map but does NOT call `appendEntry`. Tools
cannot trigger `ctx.reload()` either (per pi docs — tools cannot call reload directly).
The tool is a convenience for the LLM to trigger loading within a turn; the command
is the canonical entry point for durable loading. This matches existing behavior.

## Data Shape

```typescript
// Entry stored in session file
interface SkillSnapshot {
  skills: Array<{ name: string; path: string }>;
}

// Appended via:
pi.appendEntry("pi-load-skill", { skills: Array.from(loadedSkills.values()) });
```

## Risks

**SKILL.md deleted after snapshot**: On restore, we skip entries whose `SKILL.md` no
longer exists on disk (same defensive check as the old `restoreFromFile`). The skill
is silently dropped — same behavior as before.

**Session entries accumulate**: Every load/unload appends an entry. For typical usage
(a handful of load/unload operations per session) this is negligible. Sessions with
hundreds of load/unload cycles would accumulate entries, but this is not a realistic
concern.

## Files Changed

| File | Change |
|------|--------|
| `extensions/load-skills.ts` | Remove temp-file code; add session-entry persistence |
| `package.json` | Bump version to `1.2.0`; peer dep stays `>=0.62.0` |
| `CHANGELOG.md` | Add `[1.2.0]` entry |
| `README.md` | Update persistence model table and How It Works section |
