# Spec: system prompt injection

## Capability

Loaded skills appear in the pi system prompt with name, description, AND location —
so the agent can use the `read` tool to load the full skill content on demand.

---

## Scenario 1: skill appears with location in system prompt

GIVEN a skill loaded via `/load-skills`  
AFTER `resources_discover` returns the skill path  
WHEN pi builds the system prompt  
THEN the system prompt contains `<available_skills>` with an entry that includes  
  `<name>`, `<description>`, AND `<location>` for the loaded skill

## Scenario 2: no manual before_agent_start injection

GIVEN the extension is loaded  
WHEN `before_agent_start` fires  
THEN the extension does NOT modify the system prompt  
AND skill injection is handled entirely by pi's native buildSystemPrompt pipeline

## Scenario 3: agent can load skill content

GIVEN a skill is loaded and appears in the system prompt with a `<location>`  
WHEN the agent determines the skill is relevant to a task  
THEN the agent can call the `read` tool with the skill's location path  
AND receive the full SKILL.md content
