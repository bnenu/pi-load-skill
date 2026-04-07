# Tasks: tilde-expansion

## Reading order

Brief → Design → Specs → this file.

---

### 1. Tilde expansion in load-skills command and load_skill tool

- [x] **RED** — Add a `describe("tilde expansion", ...)` block to `tests/load-skills.test.mjs`
      with three tests:
      1. `/load-skills` command with a `~/...` path (constructed via
         `` `~/${path.relative(os.homedir(), SKILL_A_PATH)}` ``) loads the skill successfully
         (appendEntry called, no error notify).
      2. `load_skill` tool with the same `~/...` path returns a success result (no `error: true`
         in details).
      3. A path without `~` (plain absolute path) still works — no regression.
      Run `node --test tests/load-skills.test.mjs` → the two tilde tests fail, the regression
      test passes.
- [x] **ACTION** — In `extensions/load-skills.ts`:
      - Add `import os from "node:os"` at the top
      - Add `expandTilde` helper: `if p === "~" return homedir; if starts with "~/" or "~\\"
        return homedir + p.slice(1); else return p`
      - Apply `expandTilde` before `path.resolve` in the `load-skills` command handler
        (line ~213): `const targetPath = path.resolve(expandTilde(args))`
      - Apply `expandTilde` before `path.resolve` in the `load_skill` tool execute
        (line ~309): `const targetPath = path.resolve(expandTilde(params.path))`
- [x] **GREEN** — Run `node --test tests/load-skills.test.mjs` → all tests pass including
      the two new tilde tests.

---

### 2. Add tilde fix to the [1.2.0] CHANGELOG entry

- [x] **RED** — Check: `grep "tilde\|~" CHANGELOG.md` → no match. Assertion confirms the
      fix is not yet mentioned.
- [x] **ACTION** — Add a `### Fixed` subsection to the existing `## [1.2.0]` entry in
      `CHANGELOG.md` describing the tilde expansion fix for `/load-skills` and the
      `load_skill` tool. No version bump.
- [x] **GREEN** — Check: `grep "tilde\|~" CHANGELOG.md` → match found inside the `[1.2.0]`
      section.
