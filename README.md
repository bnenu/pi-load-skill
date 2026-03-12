# pi-load-skill

Load your skills on demand from any location. Keep your agent lean, don't load all your skills when you don't need them, add only the ones you need in that session.

## Features

- **Load skills on-demand**: Load individual skills or entire skill directories from any path
- **Session-scoped**: Skills are available only for the current session
- **Temporary persistence**: Skills persist through reloads but not across fresh sessions
- **Unload skills**: Remove loaded skills when no longer needed

## Installation

### Option 1: From npm (coming soon)

```bash
pi install pi-load-skill
```

### Option 2: Local development

```bash
cd pi-load-skill
pi install ./load-skills.ts
```

Or run directly:

```bash
pi -e ./load-skills.ts
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
2. Add them to pi's skill discovery system
3. They appear in the available skills list

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
# Start pi with the extension
pi -e ./load-skills.ts

# In the pi session:
/load-skills ./my-skills

# Now you can use the skills
/skill:my-skill

# Or ask the agent about available skills
What skills are available?
```

## How It Works

1. **On load**: The extension validates the skill paths and checks for `SKILL.md` files
2. **On first run**: Skills are added to the system via `resources_discover` event
3. **Reload**: When loading skills, pi reloads to re-discover resources - skills persist via a temp file
4. **Fresh start**: When starting pi fresh (not reloaded), the temp file is cleared and skills are not restored

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

- pi >= 0.50.0
- Node.js >= 18

## License

MIT
