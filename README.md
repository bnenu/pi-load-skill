# pi-load-skill

Load your skills on demand from any location. Keep your [pi](https://shittycodingagent.ai) agent lean — don't load all your skills when you don't need them, add only the ones you need for that session.

## Features

- **Load skills on-demand**: Load individual skills or entire skill directories from any path
- **Session-scoped**: Skills persist in the session file and are restored automatically on `/reload`, `/resume`, `/fork`, and pi restart
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

1. **On `/load-skills`**: Skills are validated, added to the in-memory map, a snapshot is appended to the session file via `pi.appendEntry()`, and pi reloads
2. **On any session transition** (`/reload`, `/resume`, `/fork`, pi restart): `session_start` fires, the extension replays the current branch via `ctx.sessionManager.getBranch()`, finds the last `pi-load-skill` snapshot entry, and restores the map from it
3. **On `/new`**: A fresh session has no prior entries — the map starts empty

## Persistence Model

| Event                  | Skills in session                           |
|------------------------|---------------------------------------------|
| `/load-skills`         | snapshot appended to session + reload triggered |
| `/unload-skills`       | snapshot appended to session + reload triggered |
| `/reload`              | branch replayed → skills restored ✓         |
| `/new`                 | fresh session, no entries → map empty ✓     |
| `/resume`              | branch replayed → skills restored ✓         |
| `/fork`                | branch up to fork point replayed ✓          |
| pi restart + resume    | branch replayed → skills restored ✓         |
| pi restart (no resume) | fresh session → map empty ✓                 |

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

- pi >= 0.65.0
- Node.js >= 18

## License

MIT

---

Made with [reespec](https://reespec.dev) and ❤️ in EU
