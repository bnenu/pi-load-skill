# Tasks: pi-0.65-compat

## Reading order

Brief → Design → Specs → this file.

All tasks are vertical slices: RED (failing test) → ACTION (implementation) → GREEN (passing test).
The existing test file `tests/load-skills.test.mjs` is rewritten as part of task 1, then
extended in subsequent tasks.

---

### 1. Rewrite tests for session-entry persistence model

- [x] **RED** — Check: `tests/load-skills.test.mjs` still contains references to
      `STORAGE_FILE`, `pi-loaded-skills.json`, `restoreFromFile`, `clearStorageFile`,
      and tests that assert `existsSync(STORAGE_FILE)`. Assertion passes — old tests exist.
- [x] **ACTION** — Rewrite `tests/load-skills.test.mjs` from scratch for the new model.
      Replace the `buildMockPi` stub: add a `sessionManager` mock with `getBranch()` that
      returns a configurable list of entries, and record `appendEntry` calls. Replace temp-file
      scaffolding with session-entry scaffolding. Keep scaffold and command/tool registration
      smoke tests. Add session-entry restore tests (scenarios 1–4 from session-persistence
      spec) and `appendEntry` call tests (scenarios 5–6). Keep `resources_discover` test
      (scenario 7). Remove all `STORAGE_FILE` / `existsSync` assertions.
- [x] **GREEN** — Run `node --test tests/load-skills.test.mjs` → all tests fail (extension
      still has old implementation). Confirm the tests themselves are syntactically valid
      and the failures are assertion failures, not parse/import errors.

---

### 2. Remove temp-file code from extension

- [x] **RED** — Run `node --test tests/load-skills.test.mjs` → tests from task 1 fail.
      Also verify with `grep -n "STORAGE_FILE\|saveToFile\|restoreFromFile\|clearFile\|node:os"
      extensions/load-skills.ts` → all present (confirming old code still there).
- [x] **ACTION** — Edit `extensions/load-skills.ts`:
      - Delete `STORAGE_FILE` constant, `saveToFile`, `restoreFromFile`, `clearFile` functions
      - Delete `StoredSkill` interface
      - Delete `import os from "node:os"`
      - Delete `restoreFromFile()` call in `session_start` handler
      - In `resources_discover`: remove the `if (event.reason === "startup")` branch that
        calls `clearFile()` / `loadedSkills.clear()`; remove the `restoreFromFile()` call
        in the reload branch; make the handler always return paths from the in-memory map:
        `return loadedSkills.size > 0 ? { skillPaths: [...loadedSkills.values()].map(s => s.path) } : {}`
- [x] **GREEN** — Run `grep -n "STORAGE_FILE\|saveToFile\|restoreFromFile\|clearFile\|node:os"
      extensions/load-skills.ts` → no matches. Run `node --test tests/load-skills.test.mjs`
      → temp-file removal tests pass; session-entry tests still fail (appendEntry not yet called).

---

### 3. Restore map from session branch on session_start

- [x] **RED** — Run `node --test tests/load-skills.test.mjs` → session_start restore
      tests (scenarios 1–4) fail: map not rebuilt from branch entries.
- [x] **ACTION** — Edit the `session_start` handler in `extensions/load-skills.ts`:
      - Clear `loadedSkills` map
      - Call `ctx.sessionManager.getBranch()` to get the ordered branch entries
        (root → leaf order; reverse if getBranch returns leaf → root)
      - Find the last entry where `entry.type === "custom"` and
        `entry.customType === "pi-load-skill"`
      - If found: iterate `entry.data.skills`, for each check SKILL.md exists on disk,
        add to map if valid
      - Add `SkillSnapshot` interface: `{ skills: Array<{ name: string; path: string }> }`
- [x] **GREEN** — Run `node --test tests/load-skills.test.mjs` → session_start restore
      tests pass.

---

### 4. Append snapshot entry on load and unload

- [x] **RED** — Run `node --test tests/load-skills.test.mjs` → `appendEntry` call tests
      (scenarios 5–6) fail: `appendEntry` not being called after load/unload.
- [x] **ACTION** — Edit `extensions/load-skills.ts`:
      - Add a helper `saveSnapshot(ctx)` that calls
        `pi.appendEntry("pi-load-skill", { skills: Array.from(loadedSkills.values()) })`
      - In the `load-skills` command handler: replace `saveToFile()` with `saveSnapshot(ctx)`
        (call before `ctx.reload()`)
      - In the `unload-skills` command handler: replace `saveToFile()` with `saveSnapshot(ctx)`
        (call before `ctx.reload()`)
      - Note: `load_skill` tool does NOT call `saveSnapshot` (tools cannot reload; snapshot
        is only meaningful when persisted via a command that triggers reload)
- [x] **GREEN** — Run `node --test tests/load-skills.test.mjs` → all tests pass.

---

### 5. Update package.json version

- [x] **RED** — Check: `cat package.json | grep '"version"'` outputs `"version": "1.1.0"`.
      Assertion passes — version is still 1.1.0.
- [x] **ACTION** — Edit `package.json`: change `"version": "1.1.0"` to `"version": "1.2.0"`.
- [x] **GREEN** — Check: `cat package.json | grep '"version"'` outputs `"version": "1.2.0"`.

---

### 6. Update CHANGELOG.md

- [x] **RED** — Check: `grep "1.2.0" CHANGELOG.md` → no match. Assertion passes — entry
      absent.
- [x] **ACTION** — Prepend a `## [1.2.0] - 2026-04-07` section to `CHANGELOG.md` describing:
      removal of temp-file persistence, new session-entry persistence via `appendEntry`,
      correct behavior across `/new`, `/resume`, `/fork`, and pi restart. Include updated
      persistence model table.
- [x] **GREEN** — Check: `grep "1.2.0" CHANGELOG.md` → match found. Check: `grep "appendEntry"
      CHANGELOG.md` → match found.

---

### 7. Update README.md

- [x] **RED** — Check: `grep "temp file\|tmpdir\|restoreFromFile" README.md` → matches found
      (old How It Works text references temp file). Assertion passes — old text present.
- [x] **ACTION** — Update `README.md`:
      - Rewrite the "How It Works" section to describe `appendEntry` / session-entry persistence
      - Update the persistence model table to match the brief (add rows for `/resume`, `/fork`,
        pi restart with/without resume; remove temp-file rows)
      - Update the "Session-scoped" feature bullet to reflect new persistence behavior
      - Update Requirements: change `pi >= 0.62.0` to `pi >= 0.65.0`
- [x] **GREEN** — Check: `grep "temp file\|tmpdir\|restoreFromFile" README.md` → no matches.
      Check: `grep "resume\|fork\|appendEntry" README.md` → matches found.
