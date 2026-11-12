#!/usr/bin/env node
/**
 * Tests for MCP validator.
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const SCRIPT = path.join(ROOT, 'scripts/validate-mcp.mjs');

/**
 * Run the validator on a test directory and return { code, stdout, stderr }
 */
async function runValidator(testDir) {
  const { spawn } = await import('node:child_process');
  return new Promise((resolve) => {
    const proc = spawn('node', [SCRIPT, testDir]);
    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', (data) => { stdout += data.toString(); });
    proc.stderr.on('data', (data) => { stderr += data.toString(); });
    proc.on('close', (code) => { resolve({ code, stdout, stderr }); });
  });
}

async function runValidatorWithFlags(testDir, flags = []) {
  const { spawn } = await import('node:child_process');
  return new Promise((resolve) => {
    const proc = spawn('node', [SCRIPT, ...flags, testDir]);
    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', (data) => { stdout += data.toString(); });
    proc.stderr.on('data', (data) => { stderr += data.toString(); });
    proc.on('close', (code) => { resolve({ code, stdout, stderr }); });
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
describe('MCP Validator', () => {
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

  test('should validate a valid mcp.json successfully', async () => {
    const testDir = createTestDir('valid-mcp');
    testDirs.push(testDir);
    
    // Create plugin.json with variables
    writeFile(testDir, '.cursor-plugin/plugin.json', JSON.stringify({
      name: 'test-plugin',
      version: '1.0.0',
      description: 'Test plugin',
      author: 'Test Author',
      variables: {
        API_KEY: 'API key for the service',
        ENDPOINT: 'Service endpoint URL'
      }
    }, null, 2));
    
    // Create valid mcp.json
    writeFile(testDir, 'mcp.json', JSON.stringify({
      mcpServers: {
        'test-server': {
          command: 'node',
          args: ['server.js'],
          env: {
            API_KEY: '${API_KEY}',
            ENDPOINT: '${ENDPOINT}'
          }
        }
      }
    }, null, 2));
    
    const result = await runValidator(testDir);
    assert.strictEqual(result.code, 0);
    assert.ok(result.stdout.includes('All MCP configurations are valid.'));
  });

  test('should fail on invalid JSON syntax', async () => {
    const testDir = createTestDir('invalid-json');
    testDirs.push(testDir);
    
    writeFile(testDir, 'mcp.json', '{ invalid json }');
    
    const result = await runValidator(testDir);
    assert.strictEqual(result.code, 1);
    assert.ok(result.stderr.includes('Invalid JSON') || result.stdout.includes('Invalid JSON'));
  });

  test('should fail when mcpServers is missing', async () => {
    const testDir = createTestDir('missing-mcpServers');
    testDirs.push(testDir);
    
    writeFile(testDir, 'mcp.json', JSON.stringify({
      notMcpServers: {}
    }, null, 2));
    
    const result = await runValidator(testDir);
    assert.strictEqual(result.code, 1);
    assert.ok(result.stdout.includes('Schema validation failed') || result.stderr.includes('Schema validation failed'));
  });

  test('should fail when server is missing required command', async () => {
    const testDir = createTestDir('missing-command');
    testDirs.push(testDir);
    
    writeFile(testDir, 'mcp.json', JSON.stringify({
      mcpServers: {
        'test-server': {
          args: ['server.js']
        }
      }
    }, null, 2));
    
    const result = await runValidator(testDir);
    assert.strictEqual(result.code, 1);
    assert.ok(result.stdout.includes('Schema validation failed') || result.stderr.includes('Schema validation failed'));
  });

  test('should fail when server is missing required args', async () => {
    const testDir = createTestDir('missing-args');
    testDirs.push(testDir);
    
    writeFile(testDir, 'mcp.json', JSON.stringify({
      mcpServers: {
        'test-server': {
          command: 'node'
        }
      }
    }, null, 2));
    
    const result = await runValidator(testDir);
    assert.strictEqual(result.code, 1);
    assert.ok(result.stdout.includes('Schema validation failed') || result.stderr.includes('Schema validation failed'));
  });

  test('should fail when placeholder variable is not declared in plugin.json', async () => {
    const testDir = createTestDir('undefined-variable');
    testDirs.push(testDir);
    
    // Create plugin.json WITHOUT the variable
    writeFile(testDir, '.cursor-plugin/plugin.json', JSON.stringify({
      name: 'test-plugin',
      version: '1.0.0',
      description: 'Test plugin',
      author: 'Test Author',
      variables: {
        API_KEY: 'API key for the service'
      }
    }, null, 2));
    
    // mcp.json references UNDECLARED_VAR which is not in plugin.json
    writeFile(testDir, 'mcp.json', JSON.stringify({
      mcpServers: {
        'test-server': {
          command: 'node',
          args: ['server.js'],
          env: {
            UNDECLARED_VAR: '${UNDECLARED_VAR}'
          }
        }
      }
    }, null, 2));
    
    const result = await runValidator(testDir);
    assert.strictEqual(result.code, 1);
    assert.ok(result.stdout.includes('Undefined variable placeholder') || result.stderr.includes('Undefined variable placeholder'));
  });

  test('should validate multiple servers in mcp.json', async () => {
    const testDir = createTestDir('multiple-servers');
    testDirs.push(testDir);
    
    writeFile(testDir, '.cursor-plugin/plugin.json', JSON.stringify({
      name: 'test-plugin',
      version: '1.0.0',
      description: 'Test plugin',
      author: 'Test Author',
      variables: {
        KEY1: 'Key 1',
        KEY2: 'Key 2'
      }
    }, null, 2));
    
    writeFile(testDir, 'mcp.json', JSON.stringify({
      mcpServers: {
        'server-one': {
          command: 'node',
          args: ['server1.js'],
          env: { KEY1: '${KEY1}' }
        },
        'server-two': {
          command: 'python',
          args: ['server2.py'],
          env: { KEY2: '${KEY2}' }
        }
      }
    }, null, 2));
    
    const result = await runValidator(testDir);
    assert.strictEqual(result.code, 0);
    assert.ok(result.stdout.includes('All MCP configurations are valid.'));
  });

  test('should validate server with optional cwd field', async () => {
    const testDir = createTestDir('with-cwd');
    testDirs.push(testDir);
    
    writeFile(testDir, '.cursor-plugin/plugin.json', JSON.stringify({
      name: 'test-plugin',
      version: '1.0.0',
      description: 'Test plugin',
      author: 'Test Author',
      variables: {}
    }, null, 2));
    
    writeFile(testDir, 'mcp.json', JSON.stringify({
      mcpServers: {
        'test-server': {
          command: 'node',
          args: ['server.js'],
          cwd: './subdir'
        }
      }
    }, null, 2));
    
    const result = await runValidator(testDir);
    assert.strictEqual(result.code, 0);
    assert.ok(result.stdout.includes('All MCP configurations are valid.'));
  });

  test('should find mcp.json in nested directories', async () => {
    const testDir = createTestDir('nested-mcp');
    testDirs.push(testDir);
    
    writeFile(testDir, '.cursor-plugin/plugin.json', JSON.stringify({
      name: 'test-plugin',
      version: '1.0.0',
      description: 'Test plugin',
      author: 'Test Author',
      variables: {
        NESTED_KEY: 'Nested key'
      }
    }, null, 2));
    
    writeFile(testDir, 'subdir/mcp.json', JSON.stringify({
      mcpServers: {
        'nested-server': {
          command: 'node',
          args: ['server.js'],
          env: { NESTED_KEY: '${NESTED_KEY}' }
        }
      }
    }, null, 2));
    
    const result = await runValidator(testDir);
    assert.strictEqual(result.code, 0);
    assert.ok(result.stdout.includes('All MCP configurations are valid.'));
  });

  test('should output JSON with --json flag', async () => {
    const testDir = createTestDir('mcp-json-flag');
    testDirs.push(testDir);
    writeFile(testDir, '.cursor-plugin/plugin.json', JSON.stringify({
      name: 'test-plugin',
      version: '1.0.0',
      description: 'Test plugin',
      author: 'Test Author'
    }, null, 2));
    writeFile(testDir, 'mcp.json', JSON.stringify({
      mcpServers: {
        'test-server': {
          command: 'node',
          args: ['server.js']
        }
      }
    }, null, 2));
    
    const result = await runValidatorWithFlags(testDir, ['--json']);
    assert.strictEqual(result.code, 0);
    const output = JSON.parse(result.stdout.trim());
    assert.ok(output.valid === true);
    assert.ok(Array.isArray(output.mcp));
    assert.ok(output.mcp.length > 0);
    assert.ok(output.mcp[0].valid === true);
  });

  test('should output JSON with --strict --json flags combined', async () => {
    const testDir = createTestDir('mcp-strict-json-flag');
    testDirs.push(testDir);
    writeFile(testDir, '.cursor-plugin/plugin.json', JSON.stringify({
      name: 'test-plugin',
      version: '1.0.0',
      description: 'Test plugin',
      author: 'Test Author'
    }, null, 2));
    writeFile(testDir, 'mcp.json', JSON.stringify({
      mcpServers: {
        'test-server': {
          command: 'node',
          args: ['server.js']
        }
      }
    }, null, 2));
    
    const result = await runValidatorWithFlags(testDir, ['--strict', '--json']);
    assert.strictEqual(result.code, 0);
    const output = JSON.parse(result.stdout.trim());
    assert.ok(output.valid === true);
    assert.ok(Array.isArray(output.mcp));
    assert.ok(output.mcp.length > 0);
    assert.ok(output.mcp[0].valid === true);
  });

  test('should output JSON errors in --json mode', async () => {
    const testDir = createTestDir('mcp-json-error');
    testDirs.push(testDir);
    writeFile(testDir, '.cursor-plugin/plugin.json', JSON.stringify({
      name: 'test-plugin',
      version: '1.0.0',
      description: 'Test plugin',
      author: 'Test Author'
    }, null, 2));
    // Invalid mcp.json - missing required mcpServers
    writeFile(testDir, 'mcp.json', JSON.stringify({
      someOtherField: 'value'
    }, null, 2));
    
    const result = await runValidatorWithFlags(testDir, ['--json']);
    assert.strictEqual(result.code, 1);
    const output = JSON.parse(result.stdout.trim());
    assert.ok(output.valid === false);
    assert.ok(Array.isArray(output.mcp));
    assert.ok(output.mcp.length > 0);
    assert.ok(output.mcp[0].valid === false);
    assert.ok(output.mcp[0].errors.length > 0);
  });
});