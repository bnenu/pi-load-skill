/**
 * Tests for pi-load-skill extension (pi-load-skill-0.62-compat)
 *
 * Uses Node.js built-in test runner (node:test).
 * Loads the extension via jiti (same loader pi uses).
 */

import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { writeFileSync, existsSync, unlinkSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");

// Load extension factory via jiti (same as pi does at runtime)
const require = createRequire(import.meta.url);
const jiti = require("jiti");
const j = jiti(projectRoot, { interopDefault: true });
const _extModule = j("./extensions/load-skills.ts");
const loadExtension = _extModule.default ?? _extModule;

// ─── Mock helpers ────────────────────────────────────────────────────────────

/**
 * Build a minimal mock ExtensionAPI that records registered handlers and tools.
 */
function buildMockPi() {
  const handlers = new Map(); // event → [fn, ...]
  const tools = new Map();
  const commands = new Map();

  return {
    _handlers: handlers,
    _tools: tools,
    _commands: commands,

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

    // Minimal stubs for anything the extension might call at registration time
    sendUserMessage() {},
    events: { on() {}, emit() {} },
    appendEntry() {},
  };
}

/**
 * Build a minimal ctx stub for event handlers.
 */
function buildMockCtx() {
  return {
    ui: {
      notify() {},
      setStatus() {},
    },
    reload: async () => {},
    cwd: projectRoot,
  };
}

/**
 * Invoke all registered handlers for an event and return the last result.
 * Mirrors pi's behaviour of calling every handler.
 */
async function emit(mockPi, event, ctx) {
  const fns = mockPi._handlers.get(event.type) ?? [];
  let result;
  for (const fn of fns) {
    result = await fn(event, ctx);
  }
  return result;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const STORAGE_FILE = join(tmpdir(), "pi-loaded-skills.json");

function writeStorageFile(paths) {
  const data = paths.map((p, i) => ({ name: `skill-${i}`, path: p }));
  writeFileSync(STORAGE_FILE, JSON.stringify(data, null, 2));
}

function clearStorageFile() {
  if (existsSync(STORAGE_FILE)) unlinkSync(STORAGE_FILE);
}

// ─── Scaffold smoke test ──────────────────────────────────────────────────────

describe("scaffold", () => {
  it("extension factory loads without error", () => {
    assert.equal(typeof loadExtension, "function");
  });

  it("factory registers expected commands and tools", () => {
    const pi = buildMockPi();
    loadExtension(pi);
    assert.ok(pi._commands.has("load-skills"), "load-skills command registered");
    assert.ok(pi._commands.has("unload-skills"), "unload-skills command registered");
    assert.ok(pi._commands.has("list-loaded-skills"), "list-loaded-skills command registered");
    assert.ok(pi._tools.has("load_skill"), "load_skill tool registered");
  });
});

// ─── before_agent_start must NOT be registered ───────────────────────────────

describe("before_agent_start", () => {
  it("extension does not register a before_agent_start handler", () => {
    const pi = buildMockPi();
    loadExtension(pi);
    const handlers = pi._handlers.get("before_agent_start") ?? [];
    assert.equal(handlers.length, 0, "before_agent_start should not be registered");
  });
});

// ─── resources_discover behavior ─────────────────────────────────────────────

describe("resources_discover", () => {
  beforeEach(() => {
    clearStorageFile();
  });

  after(() => {
    clearStorageFile();
  });

  it("reason=reload: restores skills from file and returns skillPaths", async () => {
    // Use real sample skills so restoreFromFile() accepts them (checks SKILL.md exists)
    const skillA = resolve(projectRoot, "sample-skills/example-skill");
    const skillB = resolve(projectRoot, "sample-skills/another-skill");
    writeStorageFile([skillA, skillB]);

    const pi = buildMockPi();
    loadExtension(pi);
    const ctx = buildMockCtx();

    // Act: emit resources_discover with reason=reload
    const result = await emit(pi, { type: "resources_discover", cwd: projectRoot, reason: "reload" }, ctx);

    // Assert: both paths returned
    const paths = result?.skillPaths ?? [];
    assert.ok(paths.includes(skillA), `expected ${skillA} in skillPaths`);
    assert.ok(paths.includes(skillB), `expected ${skillB} in skillPaths`);
    assert.equal(paths.length, 2, `expected 2 skillPaths, got ${paths.length}`);
    // Storage file should still exist (not cleared on reload)
    assert.ok(existsSync(STORAGE_FILE), "storage file should persist after reload");
  });

  it("reason=startup: clears storage file and returns no skillPaths", async () => {
    // Arrange: pre-seed the storage file with fake paths
    writeStorageFile(["/fake/skill-a", "/fake/skill-b"]);
    assert.ok(existsSync(STORAGE_FILE), "storage file exists before test");

    const pi = buildMockPi();
    loadExtension(pi);
    const ctx = buildMockCtx();

    // Act: emit resources_discover with reason=startup
    const result = await emit(pi, { type: "resources_discover", cwd: projectRoot, reason: "startup" }, ctx);

    // Assert: file cleared, no paths returned
    assert.ok(!existsSync(STORAGE_FILE), "storage file should be cleared after startup");
    const paths = result?.skillPaths ?? [];
    assert.equal(paths.length, 0, `expected 0 skillPaths, got ${paths.length}: ${JSON.stringify(paths)}`);
  });
});
