---
name: example-skill
description: A sample skill demonstrating the skill loading extension. Use this as a template for creating new skills.
---

# Example Skill

This is a sample skill loaded dynamically using the load-skills extension.

## Setup

This skill requires no setup - it's a demonstration skill.

## Usage

Simply invoke this skill when you need an example of how skills work in pi.

### Example Command

```bash
echo "Hello from example skill!"
```

## Notes

- Skills are loaded on-demand from any location
- They are session-scoped (available only for the current session)
- Use `/unload-skills` to unload loaded skills
