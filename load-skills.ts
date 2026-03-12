import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";
import fs from "node:fs";
import path from "node:path";

interface LoadedSkill {
  name: string;
  path: string;  // Path to the skill directory (containing SKILL.md)
}

import os from "node:os";

const STORAGE_FILE = path.join(os.tmpdir(), "pi-loaded-skills.json");

interface StoredSkill {
  name: string;
  path: string;
}

/**
 * Pi extension for loading skills on demand from specified locations.
 * Uses resources_discover to dynamically add skills to pi's discovery system.
 * Skills appear in the available skills list (name/description only),
 * and full content loads normally when invoked.
 */
export default function (pi: ExtensionAPI) {
  const loadedSkills: Map<string, LoadedSkill> = new Map();

  /**
   * Save loaded skills to temp file
   */
  function saveToFile() {
    const data: StoredSkill[] = Array.from(loadedSkills.values());
    fs.writeFileSync(STORAGE_FILE, JSON.stringify(data, null, 2));
  }

  /**
   * Restore loaded skills from temp file
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

  /**
   * Clear the temp file
   */
  function clearFile() {
    if (fs.existsSync(STORAGE_FILE)) {
      fs.unlinkSync(STORAGE_FILE);
    }
  }

  // Restore skills on session start (only for reloads, not new sessions)
  pi.on("session_start", async (event, ctx) => {
    // Only restore if we have a temp file (meaning we just reloaded)
    if (fs.existsSync(STORAGE_FILE)) {
      const paths = restoreFromFile();
      if (paths.length > 0) {
        ctx.ui.notify(`Restored ${paths.length} skills from previous session`, "info");
      }
    }
  });

  // Track if we're restoring from a reload
  let isReloading = false;
  
  // On session start - check if we just reloaded
  pi.on("session_start", async (event, ctx) => {
    // Check if temp file exists and we didn't just reload (fresh start)
    if (!isReloading && fs.existsSync(STORAGE_FILE)) {
      // Fresh start - clear the temp file
      clearFile();
      return;
    }
    
    // This is a reload - restore skills
    if (fs.existsSync(STORAGE_FILE)) {
      const paths = restoreFromFile();
      if (paths.length > 0) {
        ctx.ui.notify(`Restored ${paths.length} skills from previous session`, "info");
      }
    }
    
    // Reset the reload flag
    isReloading = false;
  });

  /**
   * Find SKILL.md path from a given path (file or directory)
   */
  function resolveSkillPath(targetPath: string): string | null {
    const resolved = path.resolve(targetPath);
    
    if (!fs.existsSync(resolved)) {
      return null;
    }
    
    const stat = fs.statSync(resolved);
    
    if (stat.isFile()) {
      // If it's a file, check if it's SKILL.md or in a directory with SKILL.md
      if (path.basename(resolved) === "SKILL.md") {
        return resolved;
      }
      // Assume it's a SKILL.md file, use its directory
      return resolved;
    } else if (stat.isDirectory()) {
      // Check for SKILL.md in directory
      const skillMdPath = path.join(resolved, "SKILL.md");
      if (fs.existsSync(skillMdPath)) {
        return skillMdPath;
      }
    }
    
    return null;
  }

  /**
   * Validate and parse a skill
   */
  function validateSkill(skillPath: string): LoadedSkill | null {
    const dirPath = path.dirname(skillPath);
    const skillMdPath = path.join(dirPath, "SKILL.md");
    
    if (!fs.existsSync(skillMdPath)) {
      return null;
    }
    
    const content = fs.readFileSync(skillMdPath, "utf-8");
    
    // Parse frontmatter
    const frontmatterRegex = /^---\n([\s\S]*?)\n---/;
    const match = content.match(frontmatterRegex);
    
    if (!match) {
      return null;
    }
    
    const frontmatter = match[1];
    const nameMatch = frontmatter.match(/^name:\s*(.+)$/m);
    const name = nameMatch ? nameMatch[1].trim() : path.basename(dirPath);
    
    // Validate name (lowercase, hyphens only, etc.)
    if (!/^[a-z][a-z0-9-]*$/.test(name) || name.length > 64) {
      return null;
    }
    
    // Check description exists
    const descMatch = frontmatter.match(/^description:\s*(.+)$/m);
    if (!descMatch) {
      return null;
    }
    
    return {
      name,
      path: dirPath,
    };
  }

  /**
   * Load a single skill from path
   */
  function loadSkill(targetPath: string, force = false): LoadedSkill | null {
    const skillMdPath = resolveSkillPath(targetPath);
    
    if (!skillMdPath) {
      return null;
    }
    
    const skill = validateSkill(skillMdPath);
    
    if (!skill) {
      return null;
    }
    
    // Check if already loaded (unless force is true)
    if (!force && loadedSkills.has(skill.name)) {
      return null;
    }
    
    loadedSkills.set(skill.name, skill);
    return skill;
  }

  /**
   * Load all skills from a directory
   */
  function loadSkillsFromDirectory(dirPath: string): LoadedSkill[] {
    const loaded: LoadedSkill[] = [];
    const resolved = path.resolve(dirPath);
    
    if (!fs.existsSync(resolved) || !fs.statSync(resolved).isDirectory()) {
      return loaded;
    }
    
    const entries = fs.readdirSync(resolved, { withFileTypes: true });
    
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      
      const skillPath = path.join(resolved, entry.name);
      const skill = loadSkill(skillPath, true);
      
      if (skill) {
        loaded.push(skill);
      }
    }
    
    return loaded;
  }

  /**
   * Unload a skill by name
   */
  function unloadSkill(name: string): boolean {
    return loadedSkills.delete(name);
  }

  /**
   * Get all loaded skill paths
   */
  function getLoadedSkillPaths(): string[] {
    return Array.from(loadedSkills.values()).map(s => s.path);
  }

  /**
   * List loaded skills
   */
  function listLoadedSkills(): string {
    if (loadedSkills.size === 0) {
      return "No skills loaded";
    }
    
    const lines = ["Loaded skills:"];
    for (const [name, skill] of loadedSkills) {
      lines.push(`  - ${name}: ${skill.path}`);
    }
    return lines.join("\n");
  }

  /**
   * Get all loaded skill paths, including restoring from temp file if needed
   */
  function getAllSkillPaths(): string[] {
    // If we have in-memory skills, use those
    if (loadedSkills.size > 0) {
      return getLoadedSkillPaths();
    }
    
    // Otherwise, restore from temp file
    return restoreFromFile();
  }

  // Subscribe to resources_discover to dynamically add skill paths at startup
  // Note: This only fires once at startup, not on reload
  pi.on("resources_discover", () => {
    const skillPaths = getAllSkillPaths();
    
    if (skillPaths.length === 0) {
      return;
    }
    
    return {
      skillPaths,
    };
  });

  // Register the /load-skills command
  pi.registerCommand("load-skills", {
    description: "Load one or more skills from a specified location. Accepts a file path (SKILL.md or directory) or a directory path (loads all skills in that directory).",
    getArgumentCompletions: async (prefix: string) => {
      try {
        const dir = prefix.includes("/") ? path.dirname(prefix) : ".";
        const base = path.basename(prefix);
        
        if (!fs.existsSync(dir)) return null;
        
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        const items = entries
          .filter(e => e.name.startsWith(base))
          .map(e => ({
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
        const skills = loadSkillsFromDirectory(targetPath);
        if (skills.length > 0) {
          ctx.ui.notify(`Loaded ${skills.length} skills: ${skills.map(s => s.name).join(", ")}`, "success");
          loaded = true;
        } else {
          ctx.ui.notify("No valid skills found in directory", "warning");
        }
      }
      
      // Trigger reload to re-discover skills and save state
      if (loaded) {
        saveToFile();
        isReloading = true;
        await ctx.reload();
      }
    },
  });

  // Register the /unload-skills command
  pi.registerCommand("unload-skills", {
    description: "Unload skills loaded via /load-skills. Use /unload-skills to unload all, or /unload-skills <name> to unload specific skill.",
    getArgumentCompletions: async (prefix: string) => {
      if (loadedSkills.size === 0) return null;
      
      const items = Array.from(loadedSkills.keys()).map(name => ({
        value: name,
        label: name,
      }));
      
      if (prefix) {
        return items.filter(i => i.value.startsWith(prefix));
      }
      return items;
    },
    handler: async (args, ctx) => {
      let unloaded = false;
      
      if (!args) {
        // Unload all
        const count = loadedSkills.size;
        loadedSkills.clear();
        ctx.ui.notify(`Unloaded ${count} skills`, "info");
        unloaded = count > 0;
      } else {
        // Unload specific skill
        if (unloadSkill(args)) {
          ctx.ui.notify(`Unloaded skill: ${args}`, "info");
          unloaded = true;
        } else {
          ctx.ui.notify(`Skill not loaded: ${args}`, "warning");
        }
      }
      
      // Trigger reload to update skill list and save state
      if (unloaded) {
        saveToFile();
        isReloading = true;
        await ctx.reload();
      }
    },
  });

  // Register the /list-loaded-skills command
  pi.registerCommand("list-loaded-skills", {
    description: "List all skills loaded via /load-skills command.",
    handler: async (_args, ctx) => {
      const list = listLoadedSkills();
      ctx.ui.notify(list, "info");
    },
  });

  // Register a tool for programmatic loading/unloading
  pi.registerTool({
    name: "load_skill",
    label: "Load Skill",
    description: "Load or unload a skill from a specified path. When loaded, the skill appears in available skills and can be invoked via /skill:name.",
    parameters: Type.Object({
      path: Type.String({ description: "Path to skill file (SKILL.md) or directory containing SKILL.md" }),
      unload: Type.Optional(Type.Boolean({ description: "If true, unload the skill instead of loading" })),
    }),
    async execute(toolCallId, params, signal, onUpdate, ctx) {
      const targetPath = path.resolve(params.path);
      
      if (params.unload) {
        // Find skill by path
        const skill = Array.from(loadedSkills.values()).find(s => s.path === targetPath);
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
      } else if (stat.isDirectory()) {
        const skills = loadSkillsFromDirectory(targetPath);
        return {
          content: [{ type: "text", text: `Loaded ${skills.length} skills: ${skills.map(s => s.name).join(", ")}` }],
          details: { loaded: skills.map(s => s.name), path: targetPath },
        };
      }
      
      return {
        content: [{ type: "text", text: "Invalid path - must be a file or directory" }],
        details: { error: true },
      };
    },
  });

  // Inject loaded skills into context before agent starts
  pi.on("before_agent_start", async (event, ctx) => {
    const skillPaths = getAllSkillPaths();
    
    if (skillPaths.length === 0) {
      return;
    }
    
    // Read skill descriptions from loaded skills
    let skillXml = "\n<skills>\n";
    
    for (const skillPath of skillPaths) {
      const skillMdPath = path.join(skillPath, "SKILL.md");
      if (!fs.existsSync(skillMdPath)) continue;
      
      const content = fs.readFileSync(skillMdPath, "utf-8");
      
      // Parse frontmatter
      const frontmatterRegex = /^---\n([\s\S]*?)\n---/;
      const match = content.match(frontmatterRegex);
      if (!match) continue;
      
      const frontmatter = match[1];
      const nameMatch = frontmatter.match(/^name:\s*(.+)$/m);
      const descMatch = frontmatter.match(/^description:\s*(.+)$/m);
      
      if (nameMatch && descMatch) {
        const name = nameMatch[1].trim();
        const description = descMatch[1].trim();
        skillXml += `  <skill name="${name}">\n    <description>${description}</description>\n  </skill>\n`;
      }
    }
    
    skillXml += "</skills>\n";
    
    // Inject into system prompt
    return {
      systemPrompt: event.systemPrompt + skillXml,
    };
  });

  // Notify on session start
  pi.on("session_start", async (_event, ctx) => {
    ctx.ui.notify("Skill loader ready. Use /load-skills <path> to load skills from any location.", "info");
  });
}
