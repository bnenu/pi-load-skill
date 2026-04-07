# Decisions

Architectural and strategic decisions across all requests.
One decision per entry. One paragraph. Reference the request for details.

## Entry format

### <Decision title> — YYYY-MM-DD (Request: <request-name>)

What was decided and why. What was considered and rejected.
See request artifacts for full context.

---

## What belongs here
- Library or technology choices with rationale
- Architectural patterns adopted
- Approaches explicitly rejected and why
- Deviations from the original plan with explanation
- Decisions that constrain future work

## What does NOT belong here
- Activity entries ("added X", "removed Y", "refactored Z")
- Implementation details available in request artifacts
- Decisions too small to affect future planning

---

<!-- decisions below this line -->

### Session-entry persistence replaces temp-file persistence — 2026-04-07 (Request: pi-0.65-compat)

Skill persistence moved from a process-level temp file (`/tmp/pi-loaded-skills.json`) to pi's native session entry API (`pi.appendEntry` / `ctx.sessionManager.getBranch()`). On every load or unload, a full snapshot of the current skill map is appended as a `pi-load-skill` custom entry. On `session_start` (any reason), the extension replays `getBranch()` (leaf→root order), finds the first matching entry (most recent snapshot), and restores the map from it. This makes skills correctly survive `/reload`, `/resume`, `/fork`, and pi restart+resume, while `/new` correctly starts empty. Temp files were rejected because they are process-scoped — they cannot distinguish between session identities and fail silently on `/new`, `/resume`, and `/fork` in pi >=0.65. See request artifacts for full context.
