
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const validateScript = path.join(projectRoot, 'scripts', 'validate-plugin.mjs');
const testPluginDir = path.join(projectRoot, 'test-plugins', 'sample-plugin');

describe('validate-plugin.mjs', () => {
  it('validates a correct plugin manifest', () => {
    const result = spawnSync('node', [validateScript, testPluginDir], {
      cwd: projectRoot,
      encoding: 'utf-8'
    });
    assert.strictEqual(result.status, 0, `Validator should exit with 0, got ${result.status}: ${result.stderr}`);
    assert.ok(result.stdout.includes('✅ Plugin manifest is valid'));
    assert.ok(result.stdout.includes('Name: sample-plugin'));
    assert.ok(result.stdout.includes('Version: 1.0.0'));
    assert.ok(result.stdout.includes('Display Name: Sample Plugin'));
  });

  it('fails on missing manifest', () => {
    const tempDir = path.join(projectRoot, 'test-plugins', 'empty-plugin');
    fs.mkdirSync(tempDir, { recursive: true });
    const result = spawnSync('node', [validateScript, tempDir], {
      cwd: projectRoot,
      encoding: 'utf-8'
    });
    assert.notStrictEqual(result.status, 0, 'Validator should fail on missing manifest');
    assert.ok(result.stderr.includes('Manifest not found') || result.stdout.includes('Manifest not found'));
    fs.rmSync(tempDir, { recursive: true });
  });

  it('fails on invalid name pattern', () => {
    const tempDir = path.join(projectRoot, 'test-plugins', 'bad-name-plugin');
    const pluginDir = path.join(tempDir, '.cursor-plugin');
    fs.mkdirSync(pluginDir, { recursive: true });
    const manifest = {
      name: 'Bad_Name', // invalid: underscore and uppercase
      version: '1.0.0',
      displayName: 'Bad Name Plugin',
      description: 'A plugin with invalid name'
    };
    fs.writeFileSync(path.join(pluginDir, 'plugin.json'), JSON.stringify(manifest, null, 2));
    const result = spawnSync('node', [validateScript, tempDir], {
      cwd: projectRoot,
      encoding: 'utf-8'
    });
    assert.notStrictEqual(result.status, 0, 'Validator should fail on invalid name pattern');
    fs.rmSync(tempDir, { recursive: true });
  });

  it('fails on missing referenced paths', () => {
    const tempDir = path.join(projectRoot, 'test-plugins', 'missing-paths-plugin');
    const pluginDir = path.join(tempDir, '.cursor-plugin');
    fs.mkdirSync(pluginDir, { recursive: true });
    const manifest = {
      name: 'missing-paths-plugin',
      version: '1.0.0',
      displayName: 'Missing Paths Plugin',
      description: 'A plugin with missing referenced paths',
      skills: ['skills/nonexistent'],
      agents: ['agents/nonexistent']
    };
    fs.writeFileSync(path.join(pluginDir, 'plugin.json'), JSON.stringify(manifest, null, 2));
    const result = spawnSync('node', [validateScript, tempDir], {
      cwd: projectRoot,
      encoding: 'utf-8'
    });
    assert.notStrictEqual(result.status, 0, 'Validator should fail on missing referenced paths');
    assert.ok(result.stderr.includes('does not exist') || result.stdout.includes('does not exist'));
    fs.rmSync(tempDir, { recursive: true });
  });
});
