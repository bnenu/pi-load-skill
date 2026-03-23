# Spec: reload persistence behavior

## Capability

Skills loaded via `/load-skills` survive a `/reload` within the same pi session,
but are gone on fresh pi start or after `/quit`.

---

## Scenario 1: fresh pi start — no skills

GIVEN a fresh pi process (no temp file, empty in-memory map)  
WHEN `resources_discover(reason="startup")` fires  
THEN the handler returns no skillPaths  
AND the temp file is cleared/absent  
AND no loaded skills appear in the session

## Scenario 2: load skill → reload → skill survives

GIVEN a running pi session with no skills loaded  
WHEN the user runs `/load-skills <path>`  
THEN the skill is added to the in-memory map  
AND the skill paths are saved to the temp file  
AND `ctx.reload()` is called  
WHEN `resources_discover(reason="reload")` fires on the new runtime  
THEN the handler restores paths from the temp file into the new map  
AND returns those paths  
AND the skill appears in the session system prompt with name, description, and location

## Scenario 3: manual /reload — previously loaded skills survive

GIVEN a session where skills were loaded (temp file exists, map populated)  
WHEN the user runs `/reload` manually  
WHEN `resources_discover(reason="reload")` fires on the new runtime  
THEN skills are restored from the temp file  
AND still appear in the session

## Scenario 4: /quit then restart — skills gone

GIVEN a session where skills were loaded (temp file exists)  
WHEN the user quits pi  
AND starts pi again  
WHEN `resources_discover(reason="startup")` fires  
THEN the handler clears the temp file  
AND returns no skillPaths  
AND no loaded skills appear in the new session

## Scenario 5: unload skill

GIVEN a session where skill "my-skill" is loaded  
WHEN the user runs `/unload-skills my-skill`  
THEN "my-skill" is removed from the in-memory map  
AND the temp file is updated  
AND `ctx.reload()` is called  
AND the skill no longer appears in the session after reload
