# Spec: Documentation updates

## Capability

`CHANGELOG.md`, `README.md`, and `package.json` are updated to reflect the new
session-entry persistence model and the version bump to `1.2.0`.

---

## Scenario 1: package.json version is 1.2.0

GIVEN `package.json`
WHEN the file is read
THEN `version` is `"1.2.0"`
AND `peerDependencies["@mariozechner/pi-coding-agent"]` is `">=0.62.0"`

---

## Scenario 2: CHANGELOG contains a 1.2.0 entry

GIVEN `CHANGELOG.md`
WHEN the file is read
THEN it contains a `## [1.2.0]` section
AND that section describes the removal of temp-file persistence
AND that section describes the new session-entry persistence model

---

## Scenario 3: README persistence table is updated

GIVEN `README.md`
WHEN the persistence model table is read
THEN it contains rows for `/resume`, `/fork`, and pi restart (with resume)
AND it does NOT describe skills as being "saved to a temp file"

---

## Scenario 4: README How It Works section is updated

GIVEN `README.md`
WHEN the "How It Works" section is read
THEN it describes `appendEntry` / session-entry persistence
AND it does NOT reference temp files or `restoreFromFile`
