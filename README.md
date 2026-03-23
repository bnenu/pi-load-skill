# pi-load-skill

Load your skills on demand from any location. Keep your [pi](https://shittycodingagent.ai) agent lean — don't load all your skills when you don't need them, add only the ones you need for that session.

## Features

- **Load skills on-demand**: Load individual skills or entire skill directories from any path
- **Session-scoped**: Skills are available for the current pi session and survive `/reload`
- **Native injection**: Loaded skills appear in the system prompt with name, description, and location — the agent can read the full skill content on demand
- **Unload skills**: Remove loaded skills when no longer needed

## Installation

### Option 1: From npm

```bash
pi install npm:pi-load-skill
```

### Option 2: Local development

```bash
pi -e ./extensions/load-skills.ts
```

## Usage

### Load Skills

**Load all skills from a directory:**
```
/load-skills ./path/to/skills-folder
```

**Load a single skill:**
```
/load-skills ./path/to/skill-folder
```

The extension will:
1. Find all skills in the directory (or validate a single skill)
2. Add them to pi's skill discovery system via `resources_discover`
3. They appear in the `<available_skills>` section of the system prompt with their file location
4. The agent can read the full skill content on demand using the `read` tool

### List Loaded Skills

```
/list-loaded-skills
```

### Unload Skills

**Unload a specific skill:**
```
/unload-skills skill-name
```

**Unload all loaded skills:**
```
/unload-skills
```

## Example

```bash
# Start pi
pi

# In the pi session:
/load-skills ./my-skills

# Skills now appear in the system prompt — the agent can use them
What skills do you have available?

# Unload when done
/unload-skills
```

## How It Works

1. **On `/load-skills`**: Skills are validated, added to the in-memory map, saved to a temp file, and pi reloads
2. **On reload**: `resources_discover(reason="reload")` restores from the temp file — skills survive `/reload`
3. **On fresh pi start**: `resources_discover(reason="startup")` clears the temp file — no stale skills from a previous session

## Persistence Model

| Event         | Skills in session       |
|---------------|-------------------------|
| `/load-skills`| loaded + reload triggered |
| `/reload`     | persisted ✓             |
| `/quit`       | gone (process exit)     |
| pi restart    | gone (temp file cleared on next startup) |

## Skill Format

Skills must follow the [Agent Skills standard](https://agentskills.io):

```markdown
---
name: my-skill
description: What this skill does and when to use it.
---

# My Skill

## Usage

Instructions for using the skill...
```

## Requirements

- pi >= 0.62.0
- Node.js >= 18

## License

MIT
