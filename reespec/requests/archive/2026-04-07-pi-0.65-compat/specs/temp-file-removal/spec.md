# Spec: Temp-file removal

## Capability

All temp-file persistence code is removed from the extension. No references to
`STORAGE_FILE`, `saveToFile`, `restoreFromFile`, `clearFile`, or `os.tmpdir()` remain.

---

## Scenario 1: No STORAGE_FILE constant

GIVEN the extension source file `extensions/load-skills.ts`
WHEN the file is read
THEN it contains no reference to `STORAGE_FILE`
AND it contains no reference to `pi-loaded-skills.json`

---

## Scenario 2: No temp-file helper functions

GIVEN the extension source file
WHEN the file is read
THEN it contains no `saveToFile` function
AND it contains no `restoreFromFile` function
AND it contains no `clearFile` function

---

## Scenario 3: No os import

GIVEN the extension source file
WHEN the file is read
THEN it does not import `node:os`

---

## Scenario 4: resources_discover no longer clears or reads temp file

GIVEN the extension source file
WHEN the `resources_discover` handler is examined
THEN it does not call `clearFile()`
AND it does not call `restoreFromFile()`
AND it reads from the in-memory `loadedSkills` map only
