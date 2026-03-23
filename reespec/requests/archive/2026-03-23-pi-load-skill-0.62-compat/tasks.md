# Tasks: pi-load-skill 0.62 compatibility upgrade

---

### 1. Write the test scaffold

- [x] **RED** — Check: `tests/` directory does not exist. Assertion: `ls tests/` fails.
- [x] **ACTION** — Create `tests/load-skills.test.mjs` with a minimal Node.js test runner
      scaffold (using `node:test` and `node:assert`). Import the extension factory by
      loading `extensions/load-skills.ts` via jiti. Write one placeholder test that
      asserts `true === true` so the file is runnable. Run
      `node --test tests/load-skills.test.mjs` → passes (scaffold works).
- [x] **GREEN** — Verify: `ls tests/load-skills.test.mjs` exists and
      `node --test tests/load-skills.test.mjs` exits 0.

---

### 2. Test: resources_discover(startup) clears file and returns empty

- [x] **RED** — In `tests/load-skills.test.mjs`, add a test: create a temp file at the
      known STORAGE_FILE path with fake skill paths, build a mock `ExtensionAPI`, invoke
      the extension factory, call the `resources_discover` handler with `reason="startup"`.
      Assert: handler returns no skillPaths (empty or undefined), temp file no longer exists.
      Run `node --test tests/load-skills.test.mjs` → test fails (not yet implemented).
- [x] **ACTION** — In `extensions/load-skills.ts`: update `resources_discover` handler to
      check `event.reason`. If `"startup"`: call `clearFile()`, return `{}`.
      If `"reload"`: call `restoreFromFile()` into map, return paths from map.
      Remove the second `session_start` handler entirely.
      Keep the first `session_start` handler but simplify: just call `restoreFromFile()`
      (it is now a no-op on startup because the file was already cleared by `resources_discover`).
- [x] **GREEN** — Run `node --test tests/load-skills.test.mjs` → new test passes.

---

### 3. Test: resources_discover(reload) restores skills from file

- [x] **RED** — Add a test: write fake skill paths to STORAGE_FILE, invoke factory, call
      `resources_discover` handler with `reason="reload"`. Assert: handler returns
      `skillPaths` containing the paths from the file.
      Run → test fails.
- [x] **ACTION** — No new code needed if Task 2 ACTION was correct. If test still fails,
      fix `restoreFromFile` → map → return path logic in the `resources_discover` handler.
- [x] **GREEN** — Run `node --test tests/load-skills.test.mjs` → all tests pass.

---

### 4. Remove before_agent_start handler

- [x] **RED** — Add a test: invoke the factory with a mock pi, capture any handler
      registered for `"before_agent_start"`. Assert: no handler is registered for
      `"before_agent_start"`.
      Run → test fails (handler currently exists).
- [x] **ACTION** — Delete the entire `before_agent_start` handler block from
      `extensions/load-skills.ts`.
- [x] **GREEN** — Run `node --test tests/load-skills.test.mjs` → all tests pass.

---

### 5. Remove isReloading flag and dead code

- [x] **RED** — Check: `grep -n "isReloading\|STORAGE_FILE.*clear\|session_start.*isReloading"
      extensions/load-skills.ts` returns matches. Assertion: dead code still present.
- [x] **ACTION** — Remove from `extensions/load-skills.ts`:
      - `let isReloading = false` declaration
      - All `isReloading = true` assignments
      - All `if (!isReloading` / `if (isReloading` checks
      - The second (duplicate) `session_start` handler
      Verify file still compiles: `npx tsc --noEmit --skipLibCheck extensions/load-skills.ts`
      or run the test suite.
- [x] **GREEN** — `grep "isReloading" extensions/load-skills.ts` returns nothing.
      `node --test tests/load-skills.test.mjs` → all tests pass.

---

### 6. Update package.json — version and peerDependency

- [x] **RED** — Check: `grep "0.50.0\|1.0.2" package.json` returns matches.
      Assertion: old version and peer dep still present.
- [x] **ACTION** — In `package.json`:
      - `"version": "1.0.2"` → `"version": "1.1.0"`
      - `"@mariozechner/pi-coding-agent": ">=0.50.0"` → `">=0.62.0"`
- [x] **GREEN** — `grep "1.1.0" package.json` and `grep "0.62.0" package.json` both match.
      `grep "1.0.2\|0.50.0" package.json` returns nothing.

---

### 7. Update CHANGELOG.md

- [x] **RED** — Check: `grep "1.1.0" CHANGELOG.md` returns nothing.
      Assertion: new version entry absent.
- [x] **ACTION** — Prepend a `## [1.1.0]` entry to `CHANGELOG.md` documenting:
      - Compatibility with pi >=0.62.0
      - Removed broken reload persistence mechanism (temp file + isReloading flag)
      - Removed manual before_agent_start skill injection
      - Skills now injected natively by pi's system prompt pipeline (with location)
      - Skills persist through /reload, not through /new, /resume, or pi restart
      - Minimum pi version bumped to >=0.62.0
- [x] **GREEN** — `grep "1.1.0" CHANGELOG.md` matches. Entry is non-empty and accurate.

---

### 8. Update README.md — persistence behavior

- [x] **RED** — Check: `grep ">=0.50.0\|0.50.0" README.md` returns matches OR
      README describes the old temp-file persistence behavior.
      Assertion: outdated content present.
- [x] **ACTION** — Update README.md:
      - Change any `>=0.50.0` references to `>=0.62.0`
      - Update the session persistence description to the new model:
        skills survive `/reload`, not `/new`, `/resume`, or restart
      - Remove any mention of the temp-file or reload-flag mechanism
- [x] **GREEN** — `grep "0.50.0" README.md` returns nothing.
      README accurately describes the new persistence model.

---

### 9. Local install and smoke test

- [x] **RED** — Check: the extension is NOT yet installed from the local build in pi.
      Assertion: `cat ~/.pi/agent/settings.json | grep pi-load-skill` shows old version
      or the package is not locally linked.
- [x] **ACTION** — Pack and install locally for testing:
      ```bash
      npm pack
      # In pi settings or via pi package manager, point to the local tarball
      # OR copy extensions/load-skills.ts to ~/.pi/agent/extensions/ for a quick test
      ```
      Launch pi, run `/load-skills <path-to-any-skill>`, verify:
      1. Skill appears in system prompt with `<location>` (ask the agent "what skills do you have?")
      2. Run `/reload` manually — skill still present
      3. Quit pi, restart — skill gone
- [x] **GREEN** — All three manual checks pass. Extension behaves as documented.

---

## Execution order

Tasks 1–5 are the code changes (TDD vertical slices).
Tasks 6–8 are non-code updates (can be done in any order after Task 5).
Task 9 is the local integration test before publishing.

**Do not publish to npm until Task 9 passes.**
