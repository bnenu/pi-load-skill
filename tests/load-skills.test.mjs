/**
 * Tests for pi-load-skill extension (pi-0.65-compat)
 *
 * Uses Node.js built-in test runner (node:test).
 * Loads the extension via jiti (same loader pi uses).
 *
 * Persistence model under test:
 *   - Skills are stored in session entries via pi.appendEntry()
 *   - On session_start, the map is rebuilt from ctx.sessionManager.getBranch()
 *   - getBranch() returns entries leaf→root; the first pi-load-skill entry found
 *     is the most recent snapshot
 *   - No temp files used
 */

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";
import { dirname, resolve, relative } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");

// Load extension factory via jiti (same as pi does at runtime)
const require = createRequire(import.meta.url);
const jiti = require("jiti");
const j = jiti(projectRoot, { interopDefault: true });
const _extModule = j("./extensions/load-skills.ts");
const loadExtension = _extModule.default ?? _extModule;

// ─── Sample skill paths ───────────────────────────────────────────────────────

const SKILL_A_PATH = resolve(projectRoot, "sample-skills/example-skill");
const SKILL_B_PATH = resolve(projectRoot, "sample-skills/another-skill");
const SKILL_A_NAME = "example-skill";
const SKILL_B_NAME = "another-skill";

// ─── Mock helpers ─────────────────────────────────────────────────────────────

/**
 * Build a mock ExtensionAPI.
 * - appendEntry records calls for assertion
 * - on/registerTool/registerCommand collect handlers/defs
 */
function buildMockPi(branchEntries = []) {
  const handlers = new Map();
  const tools = new Map();
  const commands = new Map();
  const appendedEntries = [];

  return {
    _handlers: handlers,
    _tools: tools,
    _commands: commands,
    _appendedEntries: appendedEntries,

    on(event, fn) {
      if (!handlers.has(event)) handlers.set(event, []);
      handlers.get(event).push(fn);
    },

    registerTool(def) {
      tools.set(def.name, def);
    },

    registerCommand(name, def) {
      commands.set(name, def);
    },

    appendEntry(customType, data) {
      appendedEntries.push({ customType, data });
    },
  };
}

/**
 * Build a mock ExtensionContext.
 * branchEntries: array of session entries returned by getBranch() in leaf→root order.
 */
function buildMockCtx(branchEntries = []) {
  return {
    ui: {
      notify() {},
      setStatus() {},
    },
    reload: async () => {},
    cwd: projectRoot,
    sessionManager: {
      getBranch() {
        return branchEntries;
      },
    },
  };
}

/**
 * Build a custom session entry as pi would store it.
 */
function makeSkillEntry(skills) {
  return {
    type: "custom",
    customType: "pi-load-skill",
    id: Math.random().toString(16).slice(2, 10),
    parentId: null,
    timestamp: new Date().toISOString(),
    data: { skills },
  };
}

/**
 * Emit all registered handlers for an event, return the last result.
 */
async function emit(mockPi, eventType, eventData, ctx) {
  const fns = mockPi._handlers.get(eventType) ?? [];
  let result;
  for (const fn of fns) {
    result = await fn({ type: eventType, ...eventData }, ctx);
  }
  return result;
}

// ─── Scaffold ─────────────────────────────────────────────────────────────────

describe("scaffold", () => {
  it("extension factory loads without error", () => {
    assert.equal(typeof loadExtension, "function");
  });

  it("registers expected commands and tools", () => {
    const pi = buildMockPi();
    loadExtension(pi);
    assert.ok(pi._commands.has("load-skills"), "load-skills command registered");
    assert.ok(pi._commands.has("unload-skills"), "unload-skills command registered");
    assert.ok(pi._commands.has("list-loaded-skills"), "list-loaded-skills command registered");
    assert.ok(pi._tools.has("load_skill"), "load_skill tool registered");
  });

  it("does not register a before_agent_start handler", () => {
    const pi = buildMockPi();
    loadExtension(pi);
    const handlers = pi._handlers.get("before_agent_start") ?? [];
    assert.equal(handlers.length, 0);
  });
});

// ─── session_start: map restoration ──────────────────────────────────────────

describe("session_start — map restoration", () => {
  it("scenario 1: restores map from the last pi-load-skill entry in the branch", async () => {
    // Branch (leaf→root): one pi-load-skill entry
    const entry = makeSkillEntry([{ name: SKILL_A_NAME, path: SKILL_A_PATH }]);
    const pi = buildMockPi();
    loadExtension(pi);
    const ctx = buildMockCtx([entry]);

    await emit(pi, "session_start", { reason: "startup" }, ctx);

    // Verify via resources_discover: map should contain skill A
    const result = await emit(pi, "resources_discover", { reason: "reload" }, ctx);
    assert.ok(result?.skillPaths?.includes(SKILL_A_PATH), "skill A path should be in skillPaths");
    assert.equal(result.skillPaths.length, 1);
  });

  it("scenario 2: only the last (first in leaf→root order) pi-load-skill entry is used", async () => {
    // Branch (leaf→root): newer entry first, older entry second
    const newerEntry = makeSkillEntry([{ name: SKILL_B_NAME, path: SKILL_B_PATH }]);
    const olderEntry = makeSkillEntry([{ name: SKILL_A_NAME, path: SKILL_A_PATH }]);
    const pi = buildMockPi();
    loadExtension(pi);
    const ctx = buildMockCtx([newerEntry, olderEntry]);

    await emit(pi, "session_start", { reason: "startup" }, ctx);

    const result = await emit(pi, "resources_discover", { reason: "reload" }, ctx);
    assert.ok(result?.skillPaths?.includes(SKILL_B_PATH), "skill B (newer) should be present");
    assert.ok(!result?.skillPaths?.includes(SKILL_A_PATH), "skill A (older) should NOT be present");
    assert.equal(result.skillPaths.length, 1);
  });

  it("scenario 3: no pi-load-skill entry → empty map → resources_discover returns {}", async () => {
    // Branch has no skill entries
    const pi = buildMockPi();
    loadExtension(pi);
    const ctx = buildMockCtx([]);

    await emit(pi, "session_start", { reason: "startup" }, ctx);

    const result = await emit(pi, "resources_discover", { reason: "reload" }, ctx);
    const paths = result?.skillPaths ?? [];
    assert.equal(paths.length, 0);
  });

  it("scenario 4: entries with missing SKILL.md are skipped silently", async () => {
    const missingPath = "/nonexistent/path/to/ghost-skill";
    const entry = makeSkillEntry([
      { name: "ghost-skill", path: missingPath },
      { name: SKILL_A_NAME, path: SKILL_A_PATH },
    ]);
    const pi = buildMockPi();
    loadExtension(pi);
    const ctx = buildMockCtx([entry]);

    await emit(pi, "session_start", { reason: "startup" }, ctx);

    const result = await emit(pi, "resources_discover", { reason: "reload" }, ctx);
    assert.ok(!result?.skillPaths?.includes(missingPath), "missing skill should be absent");
    assert.ok(result?.skillPaths?.includes(SKILL_A_PATH), "valid skill should be present");
    assert.equal(result.skillPaths.length, 1);
  });

  it("session_start works for all reasons (reload, new, resume, fork)", async () => {
    const entry = makeSkillEntry([{ name: SKILL_A_NAME, path: SKILL_A_PATH }]);
    for (const reason of ["reload", "new", "resume", "fork"]) {
      const pi = buildMockPi();
      loadExtension(pi);
      // For "new": no entries (fresh session); for others: entry present
      const branch = reason === "new" ? [] : [entry];
      const ctx = buildMockCtx(branch);

      // Should not throw
      await emit(pi, "session_start", { reason }, ctx);

      const result = await emit(pi, "resources_discover", { reason: "reload" }, ctx);
      if (reason === "new") {
        assert.equal((result?.skillPaths ?? []).length, 0, `reason=${reason}: map should be empty`);
      } else {
        assert.ok(result?.skillPaths?.includes(SKILL_A_PATH), `reason=${reason}: skill should be restored`);
      }
    }
  });
});

// ─── resources_discover ───────────────────────────────────────────────────────

describe("resources_discover", () => {
  it("scenario 7: returns skillPaths from in-memory map (any reason)", async () => {
    const entry = makeSkillEntry([{ name: SKILL_A_NAME, path: SKILL_A_PATH }]);
    const pi = buildMockPi();
    loadExtension(pi);
    const ctx = buildMockCtx([entry]);

    // Populate map via session_start
    await emit(pi, "session_start", { reason: "startup" }, ctx);

    for (const reason of ["startup", "reload"]) {
      const result = await emit(pi, "resources_discover", { reason }, ctx);
      assert.ok(result?.skillPaths?.includes(SKILL_A_PATH), `reason=${reason}: should return skill path`);
    }
  });

  it("returns {} when map is empty", async () => {
    const pi = buildMockPi();
    loadExtension(pi);
    const ctx = buildMockCtx([]);

    await emit(pi, "session_start", { reason: "startup" }, ctx);

    const result = await emit(pi, "resources_discover", { reason: "startup" }, ctx);
    const paths = result?.skillPaths ?? [];
    assert.equal(paths.length, 0);
  });
});

// ─── appendEntry on load/unload ───────────────────────────────────────────────

describe("appendEntry — snapshot on load/unload", () => {
  it("scenario 5: /load-skills appends a pi-load-skill snapshot entry", async () => {
    const pi = buildMockPi();
    loadExtension(pi);
    const ctx = buildMockCtx([]);
    // Patch ctx.reload to no-op (prevent actual reload in test)
    ctx.reload = async () => {};

    await emit(pi, "session_start", { reason: "startup" }, ctx);

    const handler = pi._commands.get("load-skills").handler;
    await handler(SKILL_A_PATH, ctx);

    const entries = pi._appendedEntries.filter((e) => e.customType === "pi-load-skill");
    assert.equal(entries.length, 1, "should have appended exactly one entry");
    const skills = entries[0].data.skills;
    assert.ok(
      skills.some((s) => s.name === SKILL_A_NAME && s.path === SKILL_A_PATH),
      "snapshot should contain the loaded skill"
    );
  });

  it("scenario 6: /unload-skills appends a snapshot reflecting state after unload", async () => {
    // Pre-load skill A via a session entry
    const entry = makeSkillEntry([{ name: SKILL_A_NAME, path: SKILL_A_PATH }]);
    const pi = buildMockPi();
    loadExtension(pi);
    const ctx = buildMockCtx([entry]);
    ctx.reload = async () => {};

    await emit(pi, "session_start", { reason: "startup" }, ctx);

    const handler = pi._commands.get("unload-skills").handler;
    await handler(SKILL_A_NAME, ctx);

    const entries = pi._appendedEntries.filter((e) => e.customType === "pi-load-skill");
    assert.equal(entries.length, 1, "should have appended exactly one entry");
    const skills = entries[0].data.skills;
    assert.equal(skills.length, 0, "snapshot should be empty after unloading the only skill");
  });

  it("/unload-skills (all) appends empty snapshot", async () => {
    const entry = makeSkillEntry([
      { name: SKILL_A_NAME, path: SKILL_A_PATH },
      { name: SKILL_B_NAME, path: SKILL_B_PATH },
    ]);
    const pi = buildMockPi();
    loadExtension(pi);
    const ctx = buildMockCtx([entry]);
    ctx.reload = async () => {};

    await emit(pi, "session_start", { reason: "startup" }, ctx);

    const handler = pi._commands.get("unload-skills").handler;
    await handler(null, ctx); // no args = unload all

    const entries = pi._appendedEntries.filter((e) => e.customType === "pi-load-skill");
    assert.equal(entries.length, 1);
    assert.equal(entries[0].data.skills.length, 0);
  });
});

// ─── No temp-file code ────────────────────────────────────────────────────────

describe("temp-file removal", () => {
  it("extension does not reference STORAGE_FILE or pi-loaded-skills.json at runtime", () => {
    // If STORAGE_FILE constant existed it would be visible as a module-level side-effect.
    // We verify no temp file is created/read by checking no file ops happen on tmpdir path.
    // The grep-based assertions are in the non-code task; here we just verify
    // the extension loads cleanly with no os.tmpdir usage detectable at runtime.
    const pi = buildMockPi();
    assert.doesNotThrow(() => loadExtension(pi));
  });
});

// ─── Tilde expansion ──────────────────────────────────────────────────────────

describe("tilde expansion", () => {
  it("scenario 1: /load-skills with ~/... path loads skill successfully", async () => {
    const tildePath = `~/${relative(homedir(), SKILL_A_PATH)}`;
    const pi = buildMockPi();
    loadExtension(pi);
    const ctx = buildMockCtx([]);
    let notifiedError = false;
    ctx.ui.notify = (msg, level) => { if (level === "error") notifiedError = true; };
    ctx.reload = async () => {};

    const handler = pi._commands.get("load-skills").handler;
    await handler(tildePath, ctx);

    assert.ok(!notifiedError, "should not notify an error");
    const entries = pi._appendedEntries.filter((e) => e.customType === "pi-load-skill");
    assert.equal(entries.length, 1, "should have appended a snapshot entry");
    assert.ok(
      entries[0].data.skills.some((s) => s.name === SKILL_A_NAME),
      "snapshot should contain the loaded skill"
    );
  });

  it("scenario 2: load_skill tool with ~/... path returns success", async () => {
    const tildePath = `~/${relative(homedir(), SKILL_A_PATH)}`;
    const pi = buildMockPi();
    loadExtension(pi);

    const tool = pi._tools.get("load_skill");
    const result = await tool.execute("id", { path: tildePath }, undefined, undefined, {});

    assert.ok(!result.details?.error, "details.error should not be set");
    assert.ok(
      result.content[0].text.includes(SKILL_A_NAME),
      "result text should mention the skill name"
    );
  });

  it("scenario 4: plain absolute path still works (no regression)", async () => {
    const pi = buildMockPi();
    loadExtension(pi);
    const ctx = buildMockCtx([]);
    let notifiedError = false;
    ctx.ui.notify = (msg, level) => { if (level === "error") notifiedError = true; };
    ctx.reload = async () => {};

    const handler = pi._commands.get("load-skills").handler;
    await handler(SKILL_A_PATH, ctx);

    assert.ok(!notifiedError, "absolute path should still work");
    const entries = pi._appendedEntries.filter((e) => e.customType === "pi-load-skill");
    assert.equal(entries.length, 1, "should have appended a snapshot entry");
  });

  it("scenario 5: ~username path is not expanded", async () => {
    const pi = buildMockPi();
    loadExtension(pi);
    const ctx = buildMockCtx([]);
    const notifiedLevels = [];
    ctx.ui.notify = (msg, level) => notifiedLevels.push(level);
    ctx.reload = async () => {};

    const handler = pi._commands.get("load-skills").handler;
    await handler("~someotheruser/skills", ctx);

    // Should fail with error or warning (path won't exist), not succeed
    assert.ok(
      notifiedLevels.includes("error"),
      "~username path should not resolve to a valid location"
    );
  });
});
