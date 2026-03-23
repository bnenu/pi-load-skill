import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

interface LoadedSkill {
  name: string;
  path: string; // Path to the skill directory (containing SKILL.md)
}

interface StoredSkill {
  name: string;
  path: string;
}

// Temp file used to persist loaded skill paths across /reload within a session.
// Cleared on fresh pi start (resources_discover reason="startup").
// NOT cleared on /reload (resources_discover reason="reload") so skills survive.
// Lingering file from a previous /quit is cleaned up on next pi start.
const STORAGE_FILE = path.join(os.tmpdir(), "pi-loaded-skills.json");

/**
 * Pi extension for loading skills on demand from specified locations.
 *
 * Skills are discovered via resources_discover so pi's native system-prompt
 * pipeline injects them with name, description, AND location — allowing the
 * agent to read the full skill content on demand.
 *
 * Persistence model:
 *   /load-skills  → added to map + saved to temp file + reload triggered
 *   /reload       → resources_discover(reload) restores from temp file ✓
 *   /new, /resume → skills NOT re-injected (Option B — intentional)
 *   /quit         → process exit, temp file cleared on next startup
 *   pi restart    → resources_discover(startup) clears temp file, fresh start
 */
export default function (pi: ExtensionAPI) {
  const loadedSkills: Map<string, LoadedSkill> = new Map();

  // ─── Temp file helpers ──────────────────────────────────────────────────────

  function saveToFile(): void {
    const data: StoredSkill[] = Array.from(loadedSkills.values());
    fs.writeFileSync(STORAGE_FILE, JSON.stringify(data, null, 2));
  }

  /**
   * Restore skills from temp file into the in-memory map.
   * Returns the list of restored skill directory paths.
   * Skips entries whose SKILL.md no longer exists on disk.
   */
  function restoreFromFile(): string[] {
    if (!fs.existsSync(STORAGE_FILE)) {
      return [];
    }
    try {
      const data = JSON.parse(fs.readFileSync(STORAGE_FILE, "utf-8")) as StoredSkill[];
      const paths: string[] = [];
      for (const s of data) {
        const skillMdPath = path.join(s.path, "SKILL.md");
        if (fs.existsSync(skillMdPath)) {
          loadedSkills.set(s.name, { name: s.name, path: s.path });
          paths.push(s.path);
        }
      }
      return paths;
    } catch {
      return [];
    }
  }

  function clearFile(): void {
    if (fs.existsSync(STORAGE_FILE)) {
      fs.unlinkSync(STORAGE_FILE);
    }
  }

  // ─── Lifecycle ──────────────────────────────────────────────────────────────

  /**
   * session_start: restore from temp file into the in-memory map.
   * On reason="startup" the file will have been cleared by resources_discover
   * before this runs (pi fires session_start then resources_discover), so
   * restoreFromFile() is a no-op. On reason="reload" the file is intact and
   * skills are restored.
   *
   * Note: pi fires session_start BEFORE resources_discover. On a fresh start the
   * file may still linger here (it gets cleared in resources_discover). That is
   * fine — the map is populated but resources_discover(startup) returns empty,
   * so pi never injects those stale skills into the system prompt.
   */
  pi.on("session_start", async (_event, ctx) => {
    restoreFromFile();
    ctx.ui.notify("Skill loader ready. Use /load-skills <path> to load skills from any location.", "info");
  });

  /**
   * resources_discover: the primary integration point with pi's skill system.
   *
   * reason="startup" → fresh pi start. Clear the temp file (removes any stale
   *   file from a previous session) and return no paths.
   *
   * reason="reload"  → triggered by /reload (manual or after /load-skills).
   *   Restore from temp file and return paths so pi injects them into the
   *   system prompt with name + description + location.
   */
  pi.on("resources_discover", (event) => {
    if (event.reason === "startup") {
      clearFile();
      loadedSkills.clear();
      return {};
    }

    // reason === "reload"
    const paths = restoreFromFile();
    if (paths.length === 0) {
      return {};
    }
    return { skillPaths: paths };
  });

  // ─── Skill path helpers ─────────────────────────────────────────────────────

  /**
   * Resolve any input path to the SKILL.md file path, or null if not found.
   */
  function resolveSkillPath(targetPath: string): string | null {
    const resolved = path.resolve(targetPath);
    if (!fs.existsSync(resolved)) return null;

    const stat = fs.statSync(resolved);
    if (stat.isFile()) {
      return resolved; // caller validates it's actually SKILL.md
    }
    if (stat.isDirectory()) {
      const skillMdPath = path.join(resolved, "SKILL.md");
      if (fs.existsSync(skillMdPath)) return skillMdPath;
    }
    return null;
  }

  /**
   * Validate a SKILL.md and return a LoadedSkill, or null if invalid.
   */
  function validateSkill(skillMdPath: string): LoadedSkill | null {
    const dirPath = path.dirname(skillMdPath);
    if (!fs.existsSync(skillMdPath)) return null;

    const content = fs.readFileSync(skillMdPath, "utf-8");
    const frontmatterRegex = /^---\n([\s\S]*?)\n---/;
    const match = content.match(frontmatterRegex);
    if (!match) return null;

    const frontmatter = match[1];
    const nameMatch = frontmatter.match(/^name:\s*(.+)$/m);
    const name = nameMatch ? nameMatch[1].trim() : path.basename(dirPath);

    if (!/^[a-z][a-z0-9-]*$/.test(name) || name.length > 64) return null;

    const descMatch = frontmatter.match(/^description:\s*(.+)$/m);
    if (!descMatch) return null;

    return { name, path: dirPath };
  }

  /**
   * Load a single skill. Returns the skill if loaded, null if invalid or already loaded.
   * Pass force=true to reload even if already in the map.
   */
  function loadSkill(targetPath: string, force = false): LoadedSkill | null {
    const skillMdPath = resolveSkillPath(targetPath);
    if (!skillMdPath) return null;

    const skill = validateSkill(skillMdPath);
    if (!skill) return null;

    if (!force && loadedSkills.has(skill.name)) return null;

    loadedSkills.set(skill.name, skill);
    return skill;
  }

  /**
   * Load all skills from sub-directories of dirPath.
   */
  function loadSkillsFromDirectory(dirPath: string): LoadedSkill[] {
    const loaded: LoadedSkill[] = [];
    const resolved = path.resolve(dirPath);
    if (!fs.existsSync(resolved) || !fs.statSync(resolved).isDirectory()) return loaded;

    for (const entry of fs.readdirSync(resolved, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const skill = loadSkill(path.join(resolved, entry.name), true);
      if (skill) loaded.push(skill);
    }
    return loaded;
  }

  function unloadSkill(name: string): boolean {
    return loadedSkills.delete(name);
  }

  function listLoadedSkills(): string {
    if (loadedSkills.size === 0) return "No skills loaded";
    const lines = ["Loaded skills:"];
    for (const [name, skill] of loadedSkills) {
      lines.push(`  - ${name}: ${skill.path}`);
    }
    return lines.join("\n");
  }

  // ─── Commands ───────────────────────────────────────────────────────────────

  pi.registerCommand("load-skills", {
    description:
      "Load one or more skills from a specified location. Accepts a path to a SKILL.md file, a skill directory, or a parent directory (loads all skills inside).",
    getArgumentCompletions: async (prefix: string) => {
      try {
        const dir = prefix.includes("/") ? path.dirname(prefix) : ".";
        const base = path.basename(prefix);
        if (!fs.existsSync(dir)) return null;
        const items = fs
          .readdirSync(dir, { withFileTypes: true })
          .filter((e) => e.name.startsWith(base))
          .map((e) => ({
            value: path.join(dir, e.name),
            label: e.isDirectory() ? `${e.name}/` : e.name,
          }));
        return items.length > 0 ? items : null;
      } catch {
        return null;
      }
    },
    handler: async (args, ctx) => {
      if (!args) {
        ctx.ui.notify("Usage: /load-skills <path>", "warning");
        return;
      }

      const targetPath = path.resolve(args);
      if (!fs.existsSync(targetPath)) {
        ctx.ui.notify(`Path not found: ${targetPath}`, "error");
        return;
      }

      let loaded = false;
      const stat = fs.statSync(targetPath);

      if (stat.isFile()) {
        const skill = loadSkill(targetPath);
        if (skill) {
          ctx.ui.notify(`Loaded skill: ${skill.name}`, "success");
          loaded = true;
        } else {
          ctx.ui.notify("Invalid skill or already loaded", "warning");
        }
      } else if (stat.isDirectory()) {
        const singleSkillPath = path.join(targetPath, "SKILL.md");
        if (fs.existsSync(singleSkillPath)) {
          const skill = loadSkill(targetPath, true);
          if (skill) {
            ctx.ui.notify(`Loaded skill: ${skill.name}`, "success");
            loaded = true;
          } else {
            ctx.ui.notify("Invalid skill or already loaded", "warning");
          }
        } else {
          const skills = loadSkillsFromDirectory(targetPath);
          if (skills.length > 0) {
            ctx.ui.notify(`Loaded ${skills.length} skills: ${skills.map((s) => s.name).join(", ")}`, "success");
            loaded = true;
          } else {
            ctx.ui.notify("No valid skills found in directory", "warning");
          }
        }
      }

      if (loaded) {
        saveToFile();
        await ctx.reload();
      }
    },
  });

  pi.registerCommand("unload-skills", {
    description:
      "Unload skills loaded via /load-skills. Use /unload-skills to unload all, or /unload-skills <name> to unload a specific skill.",
    getArgumentCompletions: async (prefix: string) => {
      if (loadedSkills.size === 0) return null;
      const items = Array.from(loadedSkills.keys()).map((name) => ({ value: name, label: name }));
      return prefix ? items.filter((i) => i.value.startsWith(prefix)) : items;
    },
    handler: async (args, ctx) => {
      let unloaded = false;

      if (!args) {
        const count = loadedSkills.size;
        loadedSkills.clear();
        ctx.ui.notify(`Unloaded ${count} skills`, "info");
        unloaded = count > 0;
      } else {
        if (unloadSkill(args)) {
          ctx.ui.notify(`Unloaded skill: ${args}`, "info");
          unloaded = true;
        } else {
          ctx.ui.notify(`Skill not loaded: ${args}`, "warning");
        }
      }

      if (unloaded) {
        saveToFile();
        await ctx.reload();
      }
    },
  });

  pi.registerCommand("list-loaded-skills", {
    description: "List all skills currently loaded via /load-skills.",
    handler: async (_args, ctx) => {
      ctx.ui.notify(listLoadedSkills(), "info");
    },
  });

  // ─── Tool ───────────────────────────────────────────────────────────────────

  pi.registerTool({
    name: "load_skill",
    label: "Load Skill",
    description:
      "Load or unload a skill from a specified path. When loaded, the skill appears in available skills and can be invoked via /skill:name.",
    parameters: Type.Object({
      path: Type.String({ description: "Path to skill file (SKILL.md) or directory containing SKILL.md" }),
      unload: Type.Optional(Type.Boolean({ description: "If true, unload the skill instead of loading" })),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, _ctx) {
      const targetPath = path.resolve(params.path);

      if (params.unload) {
        const skill = Array.from(loadedSkills.values()).find((s) => s.path === targetPath);
        if (skill) {
          unloadSkill(skill.name);
          return {
            content: [{ type: "text", text: `Unloaded skill: ${skill.name}` }],
            details: { unloaded: skill.name },
          };
        }
        return {
          content: [{ type: "text", text: `Skill not found at path: ${targetPath}` }],
          details: { error: true },
        };
      }

      if (!fs.existsSync(targetPath)) {
        return {
          content: [{ type: "text", text: `Path not found: ${targetPath}` }],
          details: { error: true },
        };
      }

      const stat = fs.statSync(targetPath);

      if (stat.isFile()) {
        const skill = loadSkill(targetPath);
        if (skill) {
          return {
            content: [{ type: "text", text: `Loaded skill: ${skill.name}` }],
            details: { loaded: skill.name, path: skill.path },
          };
        }
        return {
          content: [{ type: "text", text: "Invalid skill or already loaded" }],
          details: { error: true },
        };
      }

      if (stat.isDirectory()) {
        const singleSkillPath = path.join(targetPath, "SKILL.md");
        if (fs.existsSync(singleSkillPath)) {
          const skill = loadSkill(targetPath, true);
          if (skill) {
            return {
              content: [{ type: "text", text: `Loaded skill: ${skill.name}` }],
              details: { loaded: skill.name, path: skill.path },
            };
          }
          return {
            content: [{ type: "text", text: "Invalid skill or already loaded" }],
            details: { error: true },
          };
        }
        const skills = loadSkillsFromDirectory(targetPath);
        return {
          content: [{ type: "text", text: `Loaded ${skills.length} skills: ${skills.map((s) => s.name).join(", ")}` }],
          details: { loaded: skills.map((s) => s.name), path: targetPath },
        };
      }

      return {
        content: [{ type: "text", text: "Invalid path - must be a file or directory" }],
        details: { error: true },
      };
    },
  });
}
