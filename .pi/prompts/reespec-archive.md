---
description: "Archive a completed reespec request. Use when the user wants to finalize and archive a request after implementation is complete."
---


Archive a completed reespec request.

**Input**: A request name. If not provided, run `reespec list` and ask the user to select. Do NOT auto-select or guess.

---

## Steps

### 1. Select the request

Run `reespec list` to show active requests. Ask the user to confirm which one to archive if not specified.

### 2. Check task completion

Read `reespec/requests/<name>/tasks.md`.

Count `- [ ]` (incomplete) vs `- [x]` (complete).

**If incomplete tasks exist:**
- Show warning: "N task(s) are not complete"
- List the incomplete tasks
- Ask the user: "Archive anyway? [y/N]"
- Only proceed if user confirms

**If all tasks complete:** proceed without prompt.

### 3. Check artifact completeness

Run:
```bash
reespec status --request "<name>"
```

If any artifacts are missing or empty, warn the user. Do not block — inform and confirm.

### 4. Sync delta specs (if applicable)

Check `reespec/requests/<name>/specs/` for capability specs.

If specs exist, compare with any corresponding specs in `reespec/specs/<capability>/spec.md`.

If updates are needed, ask: "Sync capability specs to main specs before archiving? [Y/n]"

Apply sync if confirmed.

### 5. Perform the archive

```bash
reespec archive --request "<name>"
```

This moves the request to `reespec/requests/archive/YYYY-MM-DD-<name>`.

### 6. Show summary

```
## Archived — <request-name>

Archived to: reespec/requests/archive/YYYY-MM-DD-<name>
Tasks:       M/M complete
Specs:       synced / not applicable / skipped
Artifacts:   brief ✓  design ✓  specs ✓  tasks ✓

<request-name> is now archived.
```

---

## Guardrails

- **Always confirm request name** — never auto-select without telling the user
- **Warn on incomplete tasks** — don't block, but always inform
- **Date-stamp archive** — YYYY-MM-DD prefix on archive folder
- **Show clear summary** — what was archived, what state it was in
- **Don't lose data** — archive is a move, not a delete
