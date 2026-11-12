#!/usr/bin/env node
/**
 * Tests for plugin validator.
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const TEST_PLUGIN_DIR = path.join(ROOT, 'test-fixtures', 'valid-plugin');
const INVALID_PLUGIN_DIR = path.join(ROOT, 'test-fixtures', 'invalid-plugin');
const INVALID_MARKETPLACE_DIR = path.join(ROOT, 'test-fixtures', 'invalid-marketplace');

function setupTestFixtures() {
  fs.mkdirSync(path.join(TEST_PLUGIN_DIR, '.cursor-plugin'), { recursive: true });
  fs.mkdirSync(path.join(TEST_PLUGIN_DIR, 'skills', 'test-skill'), { recursive: true });
  fs.mkdirSync(path.join(TEST_PLUGIN_DIR, 'agents', 'test-agent'), { recursive: true });
  fs.mkdirSync(path.join(TEST_PLUGIN_DIR, 'commands', 'test-command'), { recursive: true });
  fs.mkdirSync(path.join(TEST_PLUGIN_DIR, 'rules', 'test-rule'), { recursive: true });
  fs.mkdirSync(path.join(INVALID_PLUGIN_DIR, '.cursor-plugin'), { recursive: true });
  fs.mkdirSync(path.join(INVALID_MARKETPLACE_DIR, '.cursor-plugin'), { recursive: true });
  
  const validPluginJson = {
    name: "test-plugin",
    version: "1.0.0",
    description: "A test plugin for validation",
    author: "Test Author",
    skills: ["skills/test-skill"],
    agents: ["agents/test-agent/agent.md"],
    commands: ["commands/test-command"],
    rules: ["rules/test-rule/rule.md"],
    icon: "icon.png"
  };
  
  const validMarketplaceJson = {
    name: "test-plugin",
    publisher: "test-publisher",
    version: "1.0.0",
    description: "A test plugin for validation",
    repository: "https://github.com/test/test-plugin"
  };
  
  const invalidPluginJson = {
    name: "Test Plugin",
    version: "1.0.0",
    description: "Invalid plugin with uppercase name",
    author: "Test Author"
  };
  
  const invalidMarketplaceJson = {
    name: "test-plugin",
    publisher: "test-publisher",
    version: "1.0.0",
    description: "A test plugin for validation",
    repository: "not-a-valid-url"
  };
  
  fs.writeFileSync(path.join(TEST_PLUGIN_DIR, '.cursor-plugin', 'plugin.json'), JSON.stringify(validPluginJson, null, 2));
  fs.writeFileSync(path.join(TEST_PLUGIN_DIR, '.cursor-plugin', 'marketplace.json'), JSON.stringify(validMarketplaceJson, null, 2));
  fs.writeFileSync(path.join(TEST_PLUGIN_DIR, 'skills', 'test-skill', 'SKILL.md'), '---\nname: test-skill\ndescription: Test skill\n---\n# Test Skill');
  fs.writeFileSync(path.join(TEST_PLUGIN_DIR, 'agents', 'test-agent', 'agent.md'), '---\nname: test-agent\ndescription: Test agent\n---\n# Test Agent');
  fs.writeFileSync(path.join(TEST_PLUGIN_DIR, 'commands', 'test-command', 'command.json'), JSON.stringify({ name: 'test-command', description: 'Test command' }, null, 2));
  fs.writeFileSync(path.join(TEST_PLUGIN_DIR, 'rules', 'test-rule', 'rule.md'), '---\nname: test-rule\ndescription: Test rule\n---\n# Test Rule');
  fs.writeFileSync(path.join(TEST_PLUGIN_DIR, 'icon.png'), 'fake-icon');
  
  fs.writeFileSync(path.join(INVALID_PLUGIN_DIR, '.cursor-plugin', 'plugin.json'), JSON.stringify(invalidPluginJson, null, 2));
  fs.writeFileSync(path.join(INVALID_MARKETPLACE_DIR, '.cursor-plugin', 'marketplace.json'), JSON.stringify(invalidMarketplaceJson, null, 2));
  fs.writeFileSync(path.join(INVALID_MARKETPLACE_DIR, '.cursor-plugin', 'plugin.json'), JSON.stringify(validPluginJson, null, 2));
}

function cleanupTestFixtures() {
  fs.rmSync(path.join(ROOT, 'test-fixtures'), { recursive: true, force: true });
}

function runValidator(targetDir) {
  const args = ['scripts/validate-plugins.mjs'];
  if (targetDir) args.push(targetDir);
  const result = spawnSync('node', args, { cwd: ROOT, encoding: 'utf8' });
  return { code: result.status, stdout: result.stdout, stderr: result.stderr };
}

function runValidatorWithFlags(targetDir, flags) {
  const args = ['scripts/validate-plugins.mjs', ...flags];
  if (targetDir) args.push(targetDir);
  const result = spawnSync('node', args, { cwd: ROOT, encoding: 'utf8' });
  return { code: result.status, stdout: result.stdout, stderr: result.stderr };
}

describe('Plugin Validator', () => {
  before(setupTestFixtures);
  after(cleanupTestFixtures);
  
  it('should validate a valid plugin successfully', () => {
    const result = runValidator(TEST_PLUGIN_DIR);
    assert.equal(result.code, 0, `Expected exit code 0, got ${result.code}. stderr: ${result.stderr}`);
    assert.match(result.stdout, /✓ plugin\.json valid/);
    assert.match(result.stdout, /✓ marketplace\.json valid/);
    assert.match(result.stdout, /✓ All component paths exist/);
  });
  
  it('should fail on invalid plugin.json (uppercase name)', () => {
    const result = runValidator(INVALID_PLUGIN_DIR);
    assert.notEqual(result.code, 0, `Expected non-zero exit code, got ${result.code}`);
    assert.match(result.stderr + result.stdout, /plugin\.json.*name.*pattern/);
  });
  
  it('should fail on invalid marketplace.json (bad URL)', () => {
    const result = runValidator(INVALID_MARKETPLACE_DIR);
    assert.notEqual(result.code, 0, `Expected non-zero exit code, got ${result.code}`);
    assert.match(result.stderr + result.stdout, /marketplace\.json.*repository.*format/);
  });
  
  it('should fail when referenced paths do not exist', () => {
    const missingPathsDir = path.join(ROOT, 'test-fixtures', 'missing-paths');
    fs.mkdirSync(path.join(missingPathsDir, '.cursor-plugin'), { recursive: true });
    const pluginJson = {
      name: "test-plugin",
      version: "1.0.0",
      description: "Plugin with missing paths",
      author: "Test Author",
      skills: ["skills/nonexistent"],
      agents: ["agents/missing.md"]
    };
    fs.writeFileSync(path.join(missingPathsDir, '.cursor-plugin', 'plugin.json'), JSON.stringify(pluginJson, null, 2));
    
    const result = runValidator(missingPathsDir);
    assert.notEqual(result.code, 0, `Expected non-zero exit code, got ${result.code}`);
    assert.match(result.stderr + result.stdout, /path does not exist/);
    
    fs.rmSync(missingPathsDir, { recursive: true, force: true });
  });
  
  it('should fail when marketplace name does not match plugin name', () => {
    const mismatchDir = path.join(ROOT, 'test-fixtures', 'name-mismatch');
    fs.mkdirSync(path.join(mismatchDir, '.cursor-plugin'), { recursive: true });
    const pluginJson = {
      name: "plugin-a",
      version: "1.0.0",
      description: "Plugin A",
      author: "Test Author"
    };
    const marketplaceJson = {
      name: "plugin-b",
      publisher: "test-publisher",
      version: "1.0.0",
      description: "Plugin B",
      repository: "https://github.com/test/test-plugin"
    };
    fs.writeFileSync(path.join(mismatchDir, '.cursor-plugin', 'plugin.json'), JSON.stringify(pluginJson, null, 2));
    fs.writeFileSync(path.join(mismatchDir, '.cursor-plugin', 'marketplace.json'), JSON.stringify(marketplaceJson, null, 2));
    
    const result = runValidator(mismatchDir);
    assert.notEqual(result.code, 0, `Expected non-zero exit code, got ${result.code}`);
    assert.match(result.stderr + result.stdout, /does not match/);
    fs.rmSync(mismatchDir, { recursive: true, force: true });
  });
  
  it('should fail when commands or rules paths do not exist', () => {
    const missingCmdRulesDir = path.join(ROOT, 'test-fixtures', 'missing-cmd-rules');
    fs.mkdirSync(path.join(missingCmdRulesDir, '.cursor-plugin'), { recursive: true });
    const pluginJson = {
      name: "test-plugin",
      version: "1.0.0",
      description: "Plugin with missing commands and rules",
      author: "Test Author",
      commands: ["commands/nonexistent"],
      rules: ["rules/missing.md"]
    };
    fs.writeFileSync(path.join(missingCmdRulesDir, '.cursor-plugin', 'plugin.json'), JSON.stringify(pluginJson, null, 2));
    
    const result = runValidator(missingCmdRulesDir);
    assert.notEqual(result.code, 0, `Expected non-zero exit code, got ${result.code}`);
    assert.match(result.stderr + result.stdout, /path does not exist/);
    
    fs.rmSync(missingCmdRulesDir, { recursive: true, force: true });
  });
  
  it('should validate rules content in strict mode', () => {
    const result = runValidatorWithFlags(TEST_PLUGIN_DIR, ['--strict']);
    assert.equal(result.code, 0, `Expected exit code 0, got ${result.code}. stderr: ${result.stderr}`);
    assert.match(result.stdout, /✓ All referenced files valid/);
  });
  
  it('should fail on invalid rule name format in strict mode', () => {
    const invalidRuleDir = path.join(ROOT, 'test-fixtures', 'invalid-rule-name');
    fs.mkdirSync(path.join(invalidRuleDir, '.cursor-plugin'), { recursive: true });
    fs.mkdirSync(path.join(invalidRuleDir, 'rules', 'test-rule'), { recursive: true });
    const pluginJson = {
      name: "test-plugin",
      version: "1.0.0",
      description: "Plugin with invalid rule name",
      author: "Test Author",
      rules: ["rules/test-rule"]
    };
    fs.writeFileSync(path.join(invalidRuleDir, '.cursor-plugin', 'plugin.json'), JSON.stringify(pluginJson, null, 2));
    fs.writeFileSync(path.join(invalidRuleDir, 'rules', 'test-rule', 'rule.md'), '---\nname: Invalid Rule\ndescription: Test rule\n---\n# Test Rule');
    
    const result = runValidatorWithFlags(invalidRuleDir, ['--strict']);
    assert.notEqual(result.code, 0, `Expected non-zero exit code, got ${result.code}`);
    assert.match(result.stderr + result.stdout, /must match pattern/);
    
    fs.rmSync(invalidRuleDir, { recursive: true, force: true });
  });
  
  it('should fail when rule name does not match folder in strict mode', () => {
    const mismatchDir = path.join(ROOT, 'test-fixtures', 'rule-name-mismatch');
    fs.mkdirSync(path.join(mismatchDir, '.cursor-plugin'), { recursive: true });
    fs.mkdirSync(path.join(mismatchDir, 'rules', 'my-rule'), { recursive: true });
    const pluginJson = {
      name: "test-plugin",
      version: "1.0.0",
      description: "Plugin with rule name mismatch",
      author: "Test Author",
      rules: ["rules/my-rule"]
    };
    fs.writeFileSync(path.join(mismatchDir, '.cursor-plugin', 'plugin.json'), JSON.stringify(pluginJson, null, 2));
    fs.writeFileSync(path.join(mismatchDir, 'rules', 'my-rule', 'rule.md'), '---\nname: other-rule\ndescription: Test rule\n---\n# Test Rule');
    
    const result = runValidatorWithFlags(mismatchDir, ['--strict']);
    assert.notEqual(result.code, 0, `Expected non-zero exit code, got ${result.code}`);
    assert.match(result.stderr + result.stdout, /must match parent folder name/);
    
    fs.rmSync(mismatchDir, { recursive: true, force: true });
  });
  
  it('should fail on description exceeding 1024 chars in strict mode', () => {
    const longDescDir = path.join(ROOT, 'test-fixtures', 'rule-long-desc');
    fs.mkdirSync(path.join(longDescDir, '.cursor-plugin'), { recursive: true });
    fs.mkdirSync(path.join(longDescDir, 'rules', 'test-rule'), { recursive: true });
    const pluginJson = {
      name: "test-plugin",
      version: "1.0.0",
      description: "Plugin with long rule description",
      author: "Test Author",
      rules: ["rules/test-rule"]
    };
    fs.writeFileSync(path.join(longDescDir, '.cursor-plugin', 'plugin.json'), JSON.stringify(pluginJson, null, 2));
    const longDesc = 'a'.repeat(1025);
    fs.writeFileSync(path.join(longDescDir, 'rules', 'test-rule', 'rule.md'), `---\nname: test-rule\ndescription: ${longDesc}\n---\n# Test Rule`);
    
    const result = runValidatorWithFlags(longDescDir, ['--strict']);
    assert.notEqual(result.code, 0, `Expected non-zero exit code, got ${result.code}`);
    assert.match(result.stderr + result.stdout, /must NOT have more than 1024 characters/);
    
    fs.rmSync(longDescDir, { recursive: true, force: true });
  });
  
  it('should fail on invalid YAML frontmatter in strict mode', () => {
    const invalidYamlDir = path.join(ROOT, 'test-fixtures', 'rule-invalid-yaml');
    fs.mkdirSync(path.join(invalidYamlDir, '.cursor-plugin'), { recursive: true });
    fs.mkdirSync(path.join(invalidYamlDir, 'rules', 'test-rule'), { recursive: true });
    const pluginJson = {
      name: "test-plugin",
      version: "1.0.0",
      description: "Plugin with invalid rule YAML",
      author: "Test Author",
      rules: ["rules/test-rule"]
    };
    fs.writeFileSync(path.join(invalidYamlDir, '.cursor-plugin', 'plugin.json'), JSON.stringify(pluginJson, null, 2));
    fs.writeFileSync(path.join(invalidYamlDir, 'rules', 'test-rule', 'rule.md'), '---\nname: test-rule\ndescription: : invalid yaml\n---\n# Test Rule');
    
    const result = runValidatorWithFlags(invalidYamlDir, ['--strict']);
    assert.notEqual(result.code, 0, `Expected non-zero exit code, got ${result.code}`);
    assert.match(result.stderr + result.stdout, /Invalid YAML frontmatter/);
    
    fs.rmSync(invalidYamlDir, { recursive: true, force: true });
  });
  
  it('should validate command content in strict mode', () => {
    const validCmdDir = path.join(ROOT, 'test-fixtures', 'valid-command-strict');
    fs.mkdirSync(path.join(validCmdDir, '.cursor-plugin'), { recursive: true });
    fs.mkdirSync(path.join(validCmdDir, 'commands', 'my-command'), { recursive: true });
    const pluginJson = {
      name: "test-plugin",
      version: "1.0.0",
      description: "Plugin with valid command",
      author: "Test Author",
      commands: ["commands/my-command"]
    };
    fs.writeFileSync(path.join(validCmdDir, '.cursor-plugin', 'plugin.json'), JSON.stringify(pluginJson, null, 2));
    fs.writeFileSync(path.join(validCmdDir, 'commands', 'my-command', 'command.json'), JSON.stringify({ name: 'my-command', description: 'My command' }, null, 2));
    
    const result = runValidatorWithFlags(validCmdDir, ['--strict']);
    assert.equal(result.code, 0, `Expected exit code 0, got ${result.code}. stderr: ${result.stderr}`);
    assert.match(result.stdout, /✓ All referenced files valid/);
    
    fs.rmSync(validCmdDir, { recursive: true, force: true });
  });
  
  it('should fail on invalid command name format in strict mode', () => {
    const invalidCmdDir = path.join(ROOT, 'test-fixtures', 'invalid-command-name');
    fs.mkdirSync(path.join(invalidCmdDir, '.cursor-plugin'), { recursive: true });
    fs.mkdirSync(path.join(invalidCmdDir, 'commands', 'test-command'), { recursive: true });
    const pluginJson = {
      name: "test-plugin",
      version: "1.0.0",
      description: "Plugin with invalid command name",
      author: "Test Author",
      commands: ["commands/test-command"]
    };
    fs.writeFileSync(path.join(invalidCmdDir, '.cursor-plugin', 'plugin.json'), JSON.stringify(pluginJson, null, 2));
    fs.writeFileSync(path.join(invalidCmdDir, 'commands', 'test-command', 'command.json'), JSON.stringify({ name: 'Invalid Command', description: 'Test command' }, null, 2));
    
    const result = runValidatorWithFlags(invalidCmdDir, ['--strict']);
    assert.notEqual(result.code, 0, `Expected non-zero exit code, got ${result.code}`);
    assert.match(result.stderr + result.stdout, /must match pattern/);
    
    fs.rmSync(invalidCmdDir, { recursive: true, force: true });
  });
  
  it('should fail when command name does not match folder in strict mode', () => {
    const mismatchDir = path.join(ROOT, 'test-fixtures', 'command-name-mismatch');
    fs.mkdirSync(path.join(mismatchDir, '.cursor-plugin'), { recursive: true });
    fs.mkdirSync(path.join(mismatchDir, 'commands', 'my-command'), { recursive: true });
    const pluginJson = {
      name: "test-plugin",
      version: "1.0.0",
      description: "Plugin with command name mismatch",
      author: "Test Author",
      commands: ["commands/my-command"]
    };
    fs.writeFileSync(path.join(mismatchDir, '.cursor-plugin', 'plugin.json'), JSON.stringify(pluginJson, null, 2));
    fs.writeFileSync(path.join(mismatchDir, 'commands', 'my-command', 'command.json'), JSON.stringify({ name: 'other-command', description: 'Test command' }, null, 2));
    
    const result = runValidatorWithFlags(mismatchDir, ['--strict']);
    assert.notEqual(result.code, 0, `Expected non-zero exit code, got ${result.code}`);
    assert.match(result.stderr + result.stdout, /must match parent folder name/);
    
    fs.rmSync(mismatchDir, { recursive: true, force: true });
  });
  
  it('should fail on description exceeding 1024 chars in strict mode', () => {
    const longDescDir = path.join(ROOT, 'test-fixtures', 'command-long-desc');
    fs.mkdirSync(path.join(longDescDir, '.cursor-plugin'), { recursive: true });
    fs.mkdirSync(path.join(longDescDir, 'commands', 'test-command'), { recursive: true });
    const pluginJson = {
      name: "test-plugin",
      version: "1.0.0",
      description: "Plugin with long command description",
      author: "Test Author",
      commands: ["commands/test-command"]
    };
    fs.writeFileSync(path.join(longDescDir, '.cursor-plugin', 'plugin.json'), JSON.stringify(pluginJson, null, 2));
    const longDesc = 'a'.repeat(1025);
    fs.writeFileSync(path.join(longDescDir, 'commands', 'test-command', 'command.json'), JSON.stringify({ name: 'test-command', description: longDesc }, null, 2));
    
    const result = runValidatorWithFlags(longDescDir, ['--strict']);
    assert.notEqual(result.code, 0, `Expected non-zero exit code, got ${result.code}`);
    assert.match(result.stderr + result.stdout, /must NOT have more than 1024 characters/);
    
    fs.rmSync(longDescDir, { recursive: true, force: true });
  });
  
  it('should fail on invalid JSON in command.json in strict mode', () => {
    const invalidJsonDir = path.join(ROOT, 'test-fixtures', 'command-invalid-json');
    fs.mkdirSync(path.join(invalidJsonDir, '.cursor-plugin'), { recursive: true });
    fs.mkdirSync(path.join(invalidJsonDir, 'commands', 'test-command'), { recursive: true });
    const pluginJson = {
      name: "test-plugin",
      version: "1.0.0",
      description: "Plugin with invalid command JSON",
      author: "Test Author",
      commands: ["commands/test-command"]
    };
    fs.writeFileSync(path.join(invalidJsonDir, '.cursor-plugin', 'plugin.json'), JSON.stringify(pluginJson, null, 2));
    fs.writeFileSync(path.join(invalidJsonDir, 'commands', 'test-command', 'command.json'), '{ invalid json }');
    
    const result = runValidatorWithFlags(invalidJsonDir, ['--strict']);
    assert.notEqual(result.code, 0, `Expected non-zero exit code, got ${result.code}`);
    assert.match(result.stderr + result.stdout, /Invalid JSON/);
    
    fs.rmSync(invalidJsonDir, { recursive: true, force: true });
  });
  
  it('should fail on missing required fields in command.json in strict mode', () => {
    const missingFieldsDir = path.join(ROOT, 'test-fixtures', 'command-missing-fields');
    fs.mkdirSync(path.join(missingFieldsDir, '.cursor-plugin'), { recursive: true });
    fs.mkdirSync(path.join(missingFieldsDir, 'commands', 'test-command'), { recursive: true });
    const pluginJson = {
      name: "test-plugin",
      version: "1.0.0",
      description: "Plugin with missing command fields",
      author: "Test Author",
      commands: ["commands/test-command"]
    };
    fs.writeFileSync(path.join(missingFieldsDir, '.cursor-plugin', 'plugin.json'), JSON.stringify(pluginJson, null, 2));
    fs.writeFileSync(path.join(missingFieldsDir, 'commands', 'test-command', 'command.json'), JSON.stringify({ icon: 'test' }, null, 2));
    
    const result = runValidatorWithFlags(missingFieldsDir, ['--strict']);
    assert.notEqual(result.code, 0, `Expected non-zero exit code, got ${result.code}`);
    assert.match(result.stderr + result.stdout, /must have required property/);
    
    fs.rmSync(missingFieldsDir, { recursive: true, force: true });
  });
  
  it('should fail on invalid arguments schema in command.json in strict mode', () => {
    const invalidArgsDir = path.join(ROOT, 'test-fixtures', 'command-invalid-args');
    fs.mkdirSync(path.join(invalidArgsDir, '.cursor-plugin'), { recursive: true });
    fs.mkdirSync(path.join(invalidArgsDir, 'commands', 'test-command'), { recursive: true });
    const pluginJson = {
      name: "test-plugin",
      version: "1.0.0",
      description: "Plugin with invalid command arguments",
      author: "Test Author",
      commands: ["commands/test-command"]
    };
    fs.writeFileSync(path.join(invalidArgsDir, '.cursor-plugin', 'plugin.json'), JSON.stringify(pluginJson, null, 2));
    fs.writeFileSync(path.join(invalidArgsDir, 'commands', 'test-command', 'command.json'), JSON.stringify({ name: 'test-command', description: 'Test', arguments: 'not-an-object' }, null, 2));
    
    const result = runValidatorWithFlags(invalidArgsDir, ['--strict']);
    assert.notEqual(result.code, 0, `Expected non-zero exit code, got ${result.code}`);
    assert.match(result.stderr + result.stdout, /arguments/);
    
    fs.rmSync(invalidArgsDir, { recursive: true, force: true });
  });
  
  it('should not validate command content in non-strict mode', () => {
    const nonStrictDir = path.join(ROOT, 'test-fixtures', 'command-non-strict');
    fs.mkdirSync(path.join(nonStrictDir, '.cursor-plugin'), { recursive: true });
    fs.mkdirSync(path.join(nonStrictDir, 'commands', 'test-command'), { recursive: true });
    const pluginJson = {
      name: "test-plugin",
      version: "1.0.0",
      description: "Plugin with invalid command in non-strict",
      author: "Test Author",
      commands: ["commands/test-command"]
    };
    fs.writeFileSync(path.join(nonStrictDir, '.cursor-plugin', 'plugin.json'), JSON.stringify(pluginJson, null, 2));
    fs.writeFileSync(path.join(nonStrictDir, 'commands', 'test-command', 'command.json'), '{}');
    
    const result = runValidator(nonStrictDir);
    assert.equal(result.code, 0, `Expected exit code 0, got ${result.code}. stderr: ${result.stderr}`);
    
    fs.rmSync(nonStrictDir, { recursive: true, force: true });
  });

  it('should discover plugin through symlink to directory', () => {
    const symlinkDir = path.join(ROOT, 'test-fixtures', 'symlink-plugin');
    const realPluginDir = path.join(ROOT, 'test-fixtures', 'real-plugin-for-symlink');
    
    // Create real plugin
    fs.mkdirSync(path.join(realPluginDir, '.cursor-plugin'), { recursive: true });
    fs.mkdirSync(path.join(realPluginDir, 'skills', 'test-skill'), { recursive: true });
    const pluginJson = {
      name: "real-plugin",
      version: "1.0.0",
      description: "Real plugin for symlink test",
      author: "Test Author",
      skills: ["skills/test-skill"]
    };
    fs.writeFileSync(path.join(realPluginDir, '.cursor-plugin', 'plugin.json'), JSON.stringify(pluginJson, null, 2));
    fs.writeFileSync(path.join(realPluginDir, 'skills', 'test-skill', 'SKILL.md'), '---\nname: test-skill\ndescription: Test skill\n---\n# Test Skill');
    
    // Create symlink
    fs.mkdirSync(symlinkDir, { recursive: true });
    fs.symlinkSync(realPluginDir, path.join(symlinkDir, 'linked-plugin'), 'dir');
    
    // Validate through symlink directory
    const result = runValidator(symlinkDir);
    assert.equal(result.code, 0, `Expected exit code 0, got ${result.code}. stderr: ${result.stderr}`);
    assert.match(result.stdout, /✓ plugin\.json valid/);
    assert.match(result.stdout, /✓ All component paths exist/);
    
    fs.rmSync(symlinkDir, { recursive: true, force: true });
    fs.rmSync(realPluginDir, { recursive: true, force: true });
  });
});
