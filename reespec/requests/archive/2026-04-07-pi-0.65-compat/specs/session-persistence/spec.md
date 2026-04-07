# Spec: Session-entry persistence

## Capability

The extension persists loaded skills in the session file via `appendEntry` and restores
them from the current branch on `session_start`, replacing the temp-file mechanism.

---

## Scenario 1: Map restored from last branch entry on session_start

GIVEN a session with a `pi-load-skill` custom entry containing `{ skills: [{name: "foo", path: "/a/foo"}] }`
WHEN `session_start` fires (any reason)
THEN the extension clears the in-memory map and rebuilds it from that entry
AND the map contains exactly `{ foo: { name: "foo", path: "/a/foo" } }`

---

## Scenario 2: Only the last pi-load-skill entry in the branch is used

GIVEN a branch with two `pi-load-skill` entries:
  - earlier entry: `{ skills: [{name: "foo", path: "/a/foo"}] }`
  - later entry:   `{ skills: [{name: "bar", path: "/a/bar"}] }`
WHEN `session_start` fires
THEN the map contains only `{ bar: ... }` (last entry wins)
AND `foo` is not in the map

---

## Scenario 3: No pi-load-skill entry → empty map

GIVEN a session with no `pi-load-skill` custom entries
WHEN `session_start` fires
THEN the in-memory map is empty
AND `resources_discover` returns `{}`

---

## Scenario 4: Entries with missing SKILL.md are skipped silently

GIVEN a `pi-load-skill` entry containing a skill whose path no longer has a `SKILL.md`
WHEN `session_start` fires
THEN that skill is skipped
AND the map contains only skills whose `SKILL.md` exists on disk

---

## Scenario 5: load-skills command appends a snapshot entry

GIVEN a valid skill directory at a known path
WHEN the `/load-skills` command handler succeeds
THEN `pi.appendEntry("pi-load-skill", { skills: [...] })` is called with the full current map
AND the entry reflects the state after the load

---

## Scenario 6: unload-skills command appends a snapshot entry

GIVEN one skill in the map (`foo`)
WHEN `/unload-skills foo` succeeds
THEN `pi.appendEntry("pi-load-skill", { skills: [] })` is called
AND the snapshot reflects the map after the unload

---

## Scenario 7: resources_discover returns paths from the in-memory map

GIVEN the map contains `{ foo: { name: "foo", path: "/a/foo" } }`
WHEN `resources_discover` fires (any reason)
THEN the handler returns `{ skillPaths: ["/a/foo"] }`
