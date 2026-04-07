# Spec: Tilde expansion

## Capability

The extension expands a leading `~` to the user's home directory in any path argument
before attempting filesystem operations, matching standard Unix path behaviour.

---

## Scenario 1: ~/path resolves correctly in the load-skills command

GIVEN a valid skill directory exists at `$HOME/some-skill/`
WHEN the `/load-skills` command is invoked with the argument `~/some-skill`
THEN the skill is loaded successfully
AND no "Path not found" error is shown

---

## Scenario 2: ~/path resolves correctly in the load_skill tool

GIVEN a valid skill directory exists at `$HOME/some-skill/`
WHEN the `load_skill` tool is executed with `path: "~/some-skill"`
THEN the tool returns a success result
AND no error content is returned

---

## Scenario 3: ~ alone expands to home directory

GIVEN a valid skill directory exists at `$HOME/` (or `$HOME` contains skill subdirs)
WHEN the `/load-skills` command is invoked with the argument `~`
THEN the path resolves to `os.homedir()` (not to a literal `~` directory)

---

## Scenario 4: Paths without ~ are unaffected

GIVEN any absolute or relative path that does not start with `~`
WHEN the `/load-skills` command or `load_skill` tool is invoked
THEN path resolution behaves exactly as before

---

## Scenario 5: ~username is not expanded

GIVEN a path argument starting with `~username` (not `~/`)
WHEN the `/load-skills` command or `load_skill` tool is invoked
THEN the path is passed through unchanged (no expansion attempted)
