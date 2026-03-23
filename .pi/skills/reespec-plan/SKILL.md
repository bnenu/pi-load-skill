---
name: reespec-plan
description: Produce all planning artifacts for a reespec request — brief, design, specs, and tasks with explicit 3-step RED/GREEN checklists. Use when the user wants to plan a request, create a task list, or generate implementation artifacts after discovery.
license: MIT
metadata:
  author: reespec
  version: "1.1"
---

Produce all artifacts needed to execute a reespec request.

**Input**: A request name. If not provided, check for active requests with `reespec list`. If ambiguous, ask the user to select.

---

## Steps

### 1. Select the request

Announce: "Planning request: <name>"

Check what exists:
```bash
reespec status --request "<name>"
```

Read any existing artifacts for context before producing new ones.
Also read `reespec/decisions.md` if it exists — established decisions constrain the plan.

### 2. Produce artifacts in dependency order

Always read dependencies before writing the next artifact:

```
brief.md  →  design.md  →  specs/  →  tasks.md
```

For each artifact: read all completed dependencies, produce it, verify it exists and is non-empty before proceeding.

**brief.md** — what & why: goals, non-goals, impact. Skip if already substantive.
**design.md** — how: decisions, tradeoffs, approach, risks. Read brief first.
**specs/** — GIVEN/WHEN/THEN scenarios per capability. Read brief + design first.
**tasks.md** — the checklist. Read all above first. See task format below.

### 3. Present for human review

Present a summary. The human reviews before execution starts — they may adjust any step, assertion, or approach. Execution SHALL NOT begin until the human approves.

---

## Task Format

Every task — **code or non-code** — is a named group with exactly **3 checklist steps**:

```markdown
### N. Task title

- [ ] **RED** — <what to write/check that currently fails>
- [ ] **ACTION** — <implement the minimal thing to make it pass>
- [ ] **GREEN** — <run/verify — confirm it passes>
```

**This is not optional.** Every single task has exactly these three steps. No task is a single checklist item. No task skips RED. No task skips GREEN.

---

### Code tasks — RED is a test file

For anything involving writing or changing code, RED means writing an actual test file that runs and fails:

```markdown
### 1. reespec init creates directory structure

- [ ] **RED** — Write `tests/cli.test.mjs`: assert `reespec/` does not exist,
      run `reespec init`, assert `reespec/decisions.md` and `reespec/requests/`
      exist. Run `node --test tests/cli.test.mjs` → test fails (command not implemented).
- [ ] **ACTION** — Implement `reespec init` in `bin/reespec.mjs`: create
      `reespec/requests/`, `reespec/requests/archive/`, scaffold `decisions.md`.
- [ ] **GREEN** — Run `node --test tests/cli.test.mjs` → test passes.
```

Rules for code tasks:
- RED **always** produces a runnable test file. Not a description of a test. An actual file.
- Tests verify behavior through **public interfaces** only — not internal functions.
- One test → one implementation → repeat. Never write all tests then all implementation.
- GREEN is always running the test suite and confirming it passes.

### Non-code tasks — RED is an observable assertion

For research, documentation, config, or any task where no test runner applies:

```markdown
### 2. Write onboarding section of README

- [ ] **RED** — Check: `README.md` does not contain sections "Install", "Quickstart",
      "CLI Commands". Assertion fails — sections are absent.
- [ ] **ACTION** — Write those sections in `README.md`.
- [ ] **GREEN** — Verify: `README.md` now contains all three sections. Assertion passes.
```

Rules for non-code tasks:
- RED is a specific, binary, agent-verifiable assertion. Not a vague description.
- "Documentation is clear" is NOT a valid RED. "README contains section X" IS valid.
- GREEN re-checks the exact same assertion and confirms it passes.
- Human-verifiable assertions ("stakeholder approves") only as last resort.

---

## TDD discipline for code tasks

**Vertical slices — the only correct approach:**
```
RIGHT:  RED(test1) → GREEN(impl1) → RED(test2) → GREEN(impl2)
WRONG:  RED(test1, test2, test3) → GREEN(impl1, impl2, impl3)
```

Writing all tests first produces tests that verify imagined behavior. One test → one impl → repeat.

**Test quality:**
- Tests use public interfaces only — survive internal refactors
- Test names describe WHAT the system does, not HOW
- Mock only at system boundaries (external APIs, time, filesystem where unavoidable)

---

## Assertion derivation

Derive assertions from: discovery conversation, `brief.md` goals, `design.md` decisions, `decisions.md` patterns, existing codebase.

If an assertion is unclear, ask the human ONE clarifying question before proceeding.

---

## Guardrails

- Every task MUST have exactly 3 steps: RED, ACTION, GREEN
- Code task RED MUST produce a runnable test file — never just describe one
- Non-code task RED MUST be a specific binary assertion — never vague
- Never begin execution without human approval of the plan
- Keep tasks small — one verifiable behavior per task
- If context is unclear, ask ONE question — prefer reasonable decisions to keep momentum
