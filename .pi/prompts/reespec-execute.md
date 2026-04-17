---
description: "Implement tasks from a reespec request, one RED→GREEN cycle at a time. Use when the user wants to start or continue implementing a planned request."
---


Implement tasks from a reespec request. One RED→GREEN cycle at a time.

**Input**: A request name. If not provided, check `reespec list`. If only one active request exists, use it. If ambiguous, ask the user to select.

---

## Steps

### 1. Select the request

Announce: "Executing request: <name>"

### 2. Read all context before starting

Read in order before touching any implementation:
```
reespec/requests/<name>/brief.md
reespec/requests/<name>/design.md
reespec/requests/<name>/specs/
reespec/requests/<name>/tasks.md
reespec/decisions.md
reespec/requests/<name>/evaluations.md  (if it exists)
```

Do NOT begin implementation without reading full context.

### 2a. Check for previous evaluations

After reading context, check whether `evaluations.md` exists:

```bash
ls reespec/requests/<name>/evaluations.md 2>/dev/null
```

**If it exists** — read the LATEST entry only (the last `## Evaluation —` block at
the bottom of the file). Announce to the user:

```
Found previous evaluation (<date>).
Gaps flagged:
⚠️  <capability> — <one-line reason from verdict>
❌  <capability> — <one-line reason from verdict>
I'll focus on these first, then work remaining tasks.
```

Only surface PARTIAL and UNSATISFIED items — skip SATISFIED and UNCLEAR.
If all items were SATISFIED, announce:
```
Found previous evaluation (<date>) — all capabilities satisfied. Proceeding normally.
```

**If it does not exist** — proceed normally, no mention.

### 3. Show current progress

```
## Executing: <request-name>
Progress: N/M tasks complete
Remaining: [list pending tasks]
```

### 4. Work through tasks — one at a time

Each task has exactly 3 checklist steps. Work through them strictly in order.

---

#### Step RED — write the failing test or check the assertion

**For code tasks** (RED step says "Write `tests/...`" or references a test file):

1. **Write the test file** at the specified path
2. **Run it** — `node --test <file>` or the project's test command
3. **Confirm it fails** — the test must actually fail before you proceed
4. Mark the RED checkbox: `- [x] **RED**`

> **Never skip this.** Never proceed to ACTION if the test passes (it means the behavior already exists or the test is wrong). Never proceed to ACTION without running the test.

**For non-code tasks** (RED step is an observable assertion):

1. **Check the assertion** — does the file exist? does it contain the section? does the command work?
2. **Confirm it fails** — the assertion must currently be false
3. Mark the RED checkbox: `- [x] **RED**`

---

#### Step ACTION — implement the minimal thing

- Write only enough code/content to make the RED assertion pass
- Do not add speculative features or anticipate future tasks
- Stay strictly scoped to this task

Mark the ACTION checkbox: `- [x] **ACTION**`

---

#### Step GREEN — verify it passes

**For code tasks:**

1. **Run the test file again** — same command as RED
2. **Confirm it passes** — all assertions green
3. Mark the GREEN checkbox: `- [x] **GREEN**`

**For non-code tasks:**

1. **Re-check the exact assertion from RED** — same check, not a different one
2. **Confirm it passes** — the condition is now true
3. Mark the GREEN checkbox: `- [x] **GREEN**`

> **Never mark GREEN without running/checking.** Never assume it passes.

---

#### After each task

- All 3 checkboxes marked `[x]`
- Report: `✓ Task N/total complete: <title>`
- Check decisions.md — if this task involved a significant decision, log it (see below)
- Move to next task

---

## Pause Conditions

Stop and report when:
- RED cannot be established (test won't run, assertion is untestable)
- GREEN cannot be reached after implementing (test still fails)
- A task contradicts the design or brief
- Implementation reveals something not anticipated in planning
- The human interrupts

**Never guess. Never skip a failing RED. Never mark GREEN without verifying.**

```
## Paused — <request-name>
Progress: N/M tasks complete

Issue: <description>

Options:
1. <option>
2. <option>

What would you like to do?
```

---

## decisions.md guidance

**Log this** — when you:
- Chose library X over Y and it matters for future work
- Deviated from the plan in a way that affects future tasks
- Discovered a constraint not in the design
- Reversed a previous decision
- Made an architectural choice future agents should know about

**Do NOT log** — activity entries: "added X", "removed Y", "refactored Z", implementation details captured in the task. The log is signal, not noise.

Entry format:
```markdown
### <Decision title> — YYYY-MM-DD (Request: <request-name>)

One paragraph. What was decided and why. What was considered and rejected.
See request artifacts for full context.
```

---

## Progress reporting

After each task:
```
✓ Task N/total complete: <title>
```

After all tasks:
```
## Complete — <request-name>
Progress: M/M tasks complete ✓

All tasks done. Ready to archive.
```

---

## Guardrails

- **Read all context first** before any implementation
- **Read only the latest evaluation entry** — older entries are history, not current gaps
- **RED before ACTION** — write/run the test or check the assertion first, always
- **Code RED = actual test file** — write it, run it, confirm it fails
- **GREEN = run it again** — never assume, always verify
- **One task at a time** — all 3 steps complete before moving on
- **Pause on blockers** — never guess, never proceed silently
- **Update decisions.md** when significant decisions are made
