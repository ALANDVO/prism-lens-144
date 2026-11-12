#!/usr/bin/env node
/**
 * Unit tests for agent validator
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const SCRIPT = path.join(ROOT, 'scripts/validate-agents.mjs');

/**
 * Run the validator on a test directory and return { code, stdout, stderr }
 */
async function runValidator(testDir) {
  const { spawn } = await import('node:child_process');
  return new Promise((resolve) => {
    const child = spawn('node', [SCRIPT, testDir], { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => (stdout += d));
    child.stderr.on('data', (d) => (stderr += d));
    child.on('close', (code) => resolve({ code, stdout, stderr }));
  });
}

async function runValidatorWithFlags(testDir, flags = []) {
  const { spawn } = await import('node:child_process');
  return new Promise((resolve) => {
    const child = spawn('node', [SCRIPT, testDir, ...flags], { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => (stdout += d));
    child.stderr.on('data', (d) => (stderr += d));
    child.on('close', (code) => resolve({ code, stdout, stderr }));
  });
}

/**
 * Create a temporary test directory structure
 */
function createTestDir(name) {
  const testDir = path.join(ROOT, 'test-tmp', name);
  fs.rmSync(testDir, { recursive: true, force: true });
  fs.mkdirSync(testDir, { recursive: true });
  return testDir;
}

function cleanupTestDir(testDir) {
  fs.rmSync(testDir, { recursive: true, force: true });
}

function writeFile(dir, relPath, content) {
  const fullPath = path.join(dir, relPath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, content);
}

// Test cases
describe('Agent Validator', () => {
  let testDirs = [];

  before(() => {
    fs.mkdirSync(path.join(ROOT, 'test-tmp'), { recursive: true });
  });

  after(() => {
    for (const dir of testDirs) {
      cleanupTestDir(dir);
    }
    fs.rmSync(path.join(ROOT, 'test-tmp'), { recursive: true, force: true });
  });

  test('should validate a valid agent successfully', async () => {
    const dir = createTestDir('valid-agent');
    testDirs.push(dir);
    writeFile(dir, 'agents/my-agent/agent.md', `---\nname: my-agent\ndescription: A valid test agent\n---\n# Agent content\n`);
    const result = await runValidator(dir);
    assert.strictEqual(result.code, 0);
    assert.ok(result.stdout.includes('All agents validated successfully.'));
  });

  test('should fail on invalid name format (uppercase)', async () => {
    const dir = createTestDir('invalid-name-format');
    testDirs.push(dir);
    writeFile(dir, 'agents/MyAgent/agent.md', `---\nname: MyAgent\ndescription: Invalid name with uppercase\n---\n`);
    const result = await runValidator(dir);
    assert.strictEqual(result.code, 1);
    assert.ok(result.stderr.includes('Invalid name format') || result.stdout.includes('Invalid name format'));
  });

  test('should fail when description is missing', async () => {
    const dir = createTestDir('missing-description');
    testDirs.push(dir);
    writeFile(dir, 'agents/no-desc/agent.md', `---\nname: no-desc\n---\n`);
    const result = await runValidator(dir);
    assert.strictEqual(result.code, 1);
    assert.ok(result.stderr.includes('Missing required field: description') || result.stdout.includes('Missing required field: description'));
  });

  test('should fail when description exceeds 1024 characters', async () => {
    const dir = createTestDir('long-description');
    testDirs.push(dir);
    const longDesc = 'a'.repeat(1025);
    writeFile(dir, 'agents/long-desc/agent.md', `---\nname: long-desc\ndescription: ${longDesc}\n---\n`);
    const result = await runValidator(dir);
    assert.strictEqual(result.code, 1);
    assert.ok(result.stderr.includes('exceeds 1024 characters') || result.stdout.includes('exceeds 1024 characters'));
  });

  test('should fail when agent name does not match parent folder name', async () => {
    const dir = createTestDir('name-mismatch');
    testDirs.push(dir);
    writeFile(dir, 'agents/folder-name/agent.md', `---\nname: different-name\ndescription: Name doesn't match folder\n---\n`);
    const result = await runValidator(dir);
    assert.strictEqual(result.code, 1);
    assert.ok(result.stderr.includes('does not match parent folder name') || result.stdout.includes('does not match parent folder name'));
  });

  test('should fail on invalid YAML frontmatter', async () => {
    const dir = createTestDir('invalid-yaml');
    testDirs.push(dir);
    writeFile(dir, 'agents/bad-yaml/agent.md', `---\nname: bad-yaml\ndescription: "unclosed quote\n---\n`);
    const result = await runValidator(dir);
    assert.strictEqual(result.code, 1);
    assert.ok(result.stderr.includes('YAML parse error') || result.stdout.includes('YAML parse error'));
  });

  test('should fail when frontmatter delimiter is missing', async () => {
    const dir = createTestDir('missing-delimiter');
    testDirs.push(dir);
    writeFile(dir, 'agents/no-delimiter/agent.md', `# No frontmatter\nname: no-delimiter\ndescription: Missing delimiter\n`);
    const result = await runValidator(dir);
    assert.strictEqual(result.code, 1);
    assert.ok(result.stderr.includes('Missing frontmatter delimiter') || result.stdout.includes('Missing frontmatter delimiter'));
  });

  test('should validate agent with all optional fields', async () => {
    const dir = createTestDir('full-agent');
    testDirs.push(dir);
    writeFile(dir, 'agents/full-agent/agent.md', `---\nname: full-agent\ndescription: A complete agent with all fields\npaths:\n  - src/**\n  - tests/**\ndisable-model-invocation: true\nicon: bot\ncolor: "#ff6b6b"\nmetadata:\n  cursor-display-name: Full Agent\n  custom-field: 123\n---\n# Agent content\n`);
    const result = await runValidator(dir);
    assert.strictEqual(result.code, 0);
    assert.ok(result.stdout.includes('All agents validated successfully.'));
  });

  test('should validate agent with valid color format', async () => {
    const dir = createTestDir('valid-color');
    testDirs.push(dir);
    writeFile(dir, 'agents/valid-color/agent.md', `---\nname: valid-color\ndescription: Agent with valid color\ncolor: "#abcdef"\n---\n`);
    const result = await runValidator(dir);
    assert.strictEqual(result.code, 0);
  });

  test('should fail on invalid color format', async () => {
    const dir = createTestDir('invalid-color');
    testDirs.push(dir);
    writeFile(dir, 'agents/invalid-color/agent.md', `---\nname: invalid-color\ndescription: Agent with invalid color\ncolor: "not-a-color"\n---\n`);
    const result = await runValidatorWithFlags(dir, ['--strict']);
    assert.strictEqual(result.code, 1);
    assert.ok(result.stderr.includes('color') || result.stdout.includes('color'));
  });

  test('should ignore non-agent markdown files', async () => {
    const dir = createTestDir('ignore-non-agents');
    testDirs.push(dir);
    writeFile(dir, 'skills/my-skill/SKILL.md', `---\nname: my-skill\ndescription: This is a skill, not an agent\n---\n`);
    writeFile(dir, 'README.md', `# README\nJust a readme file\n`);
    const result = await runValidator(dir);
    assert.strictEqual(result.code, 0);
    assert.ok(result.stdout.includes('No agent files found'));
  });

  test('should output JSON with --json flag', async () => {
    const dir = createTestDir('agent-json-flag');
    testDirs.push(dir);
    writeFile(dir, 'agents/my-agent/agent.md', `---\nname: my-agent\ndescription: A valid test agent\n---\n# Agent content\n`);
    const result = await runValidatorWithFlags(dir, ['--json']);
    assert.strictEqual(result.code, 0);
    const output = JSON.parse(result.stdout.trim());
    assert.ok(output.valid === true);
    assert.ok(Array.isArray(output.agents));
    assert.ok(output.agents.length > 0);
    assert.ok(output.agents[0].valid === true);
  });

  test('should output JSON with --strict --json flags combined', async () => {
    const dir = createTestDir('agent-strict-json-flag');
    testDirs.push(dir);
    writeFile(dir, 'agents/my-agent/agent.md', `---\nname: my-agent\ndescription: A valid test agent\n---\n# Agent content\n`);
    const result = await runValidatorWithFlags(dir, ['--strict', '--json']);
    assert.strictEqual(result.code, 0);
    const output = JSON.parse(result.stdout.trim());
    assert.ok(output.valid === true);
    assert.ok(Array.isArray(output.agents));
    assert.ok(output.agents.length > 0);
    assert.ok(output.agents[0].valid === true);
  });

  test('should output JSON errors in --json mode', async () => {
    const dir = createTestDir('agent-json-error');
    testDirs.push(dir);
    writeFile(dir, 'agents/MyAgent/agent.md', `---\nname: MyAgent\ndescription: Invalid name with uppercase\n---\n`);
    const result = await runValidatorWithFlags(dir, ['--json']);
    assert.strictEqual(result.code, 1);
    const output = JSON.parse(result.stdout.trim());
    assert.ok(output.valid === false);
    assert.ok(Array.isArray(output.agents));
    assert.ok(output.agents.length > 0);
    assert.ok(output.agents[0].valid === false);
    assert.ok(output.agents[0].errors.length > 0);
  });
});
