#!/usr/bin/env node
/**
 * Tests for hooks validator.
 */

import { describe, it, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const TEST_HOOKS_DIR = path.join(ROOT, 'test-fixtures', 'hooks');

function setupTestFixtures() {
  fs.rmSync(path.join(ROOT, 'test-fixtures'), { recursive: true, force: true });
  
  // Valid hooks.json with pre-commit hook
  fs.mkdirSync(path.join(TEST_HOOKS_DIR, 'valid-hooks', 'hooks'), { recursive: true });
  fs.writeFileSync(
    path.join(TEST_HOOKS_DIR, 'valid-hooks', 'hooks.json'),
    JSON.stringify({
      hooks: [
        {
          event: 'pre-commit',
          script: './hooks/pre-commit.sh',
          description: 'Run linting before commit'
        }
      ]
    }, null, 2)
  );
  fs.writeFileSync(
    path.join(TEST_HOOKS_DIR, 'valid-hooks', 'hooks', 'pre-commit.sh'),
    '#!/bin/bash\necho "Running pre-commit checks..."'
  );

  // Invalid hooks.json (missing required field)
  fs.mkdirSync(path.join(TEST_HOOKS_DIR, 'invalid-hooks'), { recursive: true });
  fs.writeFileSync(
    path.join(TEST_HOOKS_DIR, 'invalid-hooks', 'hooks.json'),
    JSON.stringify({
      hooks: [
        {
          event: 'pre-commit'
          // missing script
        }
      ]
    }, null, 2)
  );

  // Valid hooks.json but script file doesn't exist
  fs.mkdirSync(path.join(TEST_HOOKS_DIR, 'missing-script'), { recursive: true });
  fs.writeFileSync(
    path.join(TEST_HOOKS_DIR, 'missing-script', 'hooks.json'),
    JSON.stringify({
      hooks: [
        {
          event: 'pre-commit',
          script: './hooks/nonexistent.sh'
        }
      ]
    }, null, 2)
  );

  // Hooks.json with invalid event
  fs.mkdirSync(path.join(TEST_HOOKS_DIR, 'invalid-event'), { recursive: true });
  fs.writeFileSync(
    path.join(TEST_HOOKS_DIR, 'invalid-event', 'hooks.json'),
    JSON.stringify({
      hooks: [
        {
          event: 'invalid-event',
          script: './hooks/pre-commit.sh'
        }
      ]
    }, null, 2)
  );

  // Hooks.json with invalid JSON syntax
  fs.mkdirSync(path.join(TEST_HOOKS_DIR, 'invalid-json'), { recursive: true });
  fs.writeFileSync(
    path.join(TEST_HOOKS_DIR, 'invalid-json', 'hooks.json'),
    '{ hooks: [ }'
  );

  // Hooks.json with description
  fs.mkdirSync(path.join(TEST_HOOKS_DIR, 'with-description', 'hooks'), { recursive: true });
  fs.writeFileSync(
    path.join(TEST_HOOKS_DIR, 'with-description', 'hooks.json'),
    JSON.stringify({
      hooks: [
        {
          event: 'pre-commit',
          script: './hooks/pre-commit.sh',
          description: 'Run linting and tests before commit'
        },
        {
          event: 'post-merge',
          script: './hooks/post-merge.sh',
          description: 'Update dependencies after merge'
        }
      ]
    }, null, 2)
  );
  fs.writeFileSync(
    path.join(TEST_HOOKS_DIR, 'with-description', 'hooks', 'pre-commit.sh'),
    '#!/bin/bash\necho "Running pre-commit checks..."'
  );
  fs.writeFileSync(
    path.join(TEST_HOOKS_DIR, 'with-description', 'hooks', 'post-merge.sh'),
    '#!/bin/bash\necho "Running post-merge checks..."'
  );

  // Multiple hooks
  fs.mkdirSync(path.join(TEST_HOOKS_DIR, 'multiple-hooks', 'hooks'), { recursive: true });
  fs.writeFileSync(
    path.join(TEST_HOOKS_DIR, 'multiple-hooks', 'hooks.json'),
    JSON.stringify({
      hooks: [
        {
          event: 'pre-commit',
          script: './hooks/pre-commit.sh'
        },
        {
          event: 'post-commit',
          script: './hooks/post-commit.sh'
        },
        {
          event: 'pre-push',
          script: './hooks/pre-push.sh'
        }
      ]
    }, null, 2)
  );
  fs.writeFileSync(
    path.join(TEST_HOOKS_DIR, 'multiple-hooks', 'hooks', 'pre-commit.sh'),
    '#!/bin/bash\necho "pre-commit"'
  );
  fs.writeFileSync(
    path.join(TEST_HOOKS_DIR, 'multiple-hooks', 'hooks', 'post-commit.sh'),
    '#!/bin/bash\necho "post-commit"'
  );
  fs.writeFileSync(
    path.join(TEST_HOOKS_DIR, 'multiple-hooks', 'hooks', 'pre-push.sh'),
    '#!/bin/bash\necho "pre-push"'
  );
}

function cleanupTestFixtures() {
  fs.rmSync(path.join(ROOT, 'test-fixtures'), { recursive: true, force: true });
}

function runValidator(targetDir) {
  const result = spawnSync('node', [path.join(ROOT, 'scripts/validate-hooks.mjs'), targetDir], {
    encoding: 'utf8',
    cwd: ROOT
  });
  return {
    code: result.status,
    stdout: result.stdout,
    stderr: result.stderr
  };
}

function runValidatorWithFlags(targetDir, flags) {
  const args = [path.join(ROOT, 'scripts/validate-hooks.mjs'), ...flags, targetDir];
  const result = spawnSync('node', args, {
    encoding: 'utf8',
    cwd: ROOT
  });
  return {
    code: result.status,
    stdout: result.stdout,
    stderr: result.stderr
  };
}

describe('Hooks Validator', () => {
  beforeEach(setupTestFixtures);
  after(cleanupTestFixtures);

  it('should validate a valid hooks.json successfully', () => {
    const result = runValidator(path.join(TEST_HOOKS_DIR, 'valid-hooks'));
    assert.equal(result.code, 0);
    assert.match(result.stdout, /All hooks.json files are valid/);
  });

  it('should fail on invalid hooks.json (missing required field)', () => {
    const result = runValidator(path.join(TEST_HOOKS_DIR, 'invalid-hooks'));
    assert.equal(result.code, 1);
    assert.match(result.stderr, /Validation failed/);
    assert.match(result.stderr, /required/);
  });

  it('should fail when referenced script file does not exist', () => {
    const result = runValidator(path.join(TEST_HOOKS_DIR, 'missing-script'));
    assert.equal(result.code, 1);
    assert.match(result.stderr, /Validation failed/);
    assert.match(result.stderr, /script file does not exist/);
  });

  it('should fail on invalid event name', () => {
    const result = runValidator(path.join(TEST_HOOKS_DIR, 'invalid-event'));
    assert.equal(result.code, 1);
    assert.match(result.stderr, /Validation failed/);
  });

  it('should fail on invalid JSON syntax', () => {
    const result = runValidator(path.join(TEST_HOOKS_DIR, 'invalid-json'));
    assert.equal(result.code, 1);
    assert.match(result.stderr, /Validation failed/);
    assert.match(result.stderr, /Invalid JSON/);
  });

  it('should validate hooks.json with descriptions', () => {
    const result = runValidator(path.join(TEST_HOOKS_DIR, 'with-description'));
    assert.equal(result.code, 0);
    assert.match(result.stdout, /All hooks.json files are valid/);
  });

  it('should validate multiple hooks', () => {
    const result = runValidator(path.join(TEST_HOOKS_DIR, 'multiple-hooks'));
    assert.equal(result.code, 0);
    assert.match(result.stdout, /All hooks.json files are valid/);
  });

  it('should output JSON with --json flag', () => {
    const result = runValidatorWithFlags(path.join(TEST_HOOKS_DIR, 'valid-hooks'), ['--json']);
    assert.equal(result.code, 0);
    const output = JSON.parse(result.stdout.trim());
    assert.ok(output.valid === true);
    assert.ok(Array.isArray(output.hooks));
    assert.ok(output.hooks.length > 0);
    assert.ok(output.hooks[0].valid === true);
  });

  it('should output JSON with --strict --json flags combined', () => {
    const result = runValidatorWithFlags(path.join(TEST_HOOKS_DIR, 'valid-hooks'), ['--strict', '--json']);
    assert.equal(result.code, 0);
    const output = JSON.parse(result.stdout.trim());
    assert.ok(output.valid === true);
    assert.ok(Array.isArray(output.hooks));
    assert.ok(output.hooks.length > 0);
    assert.ok(output.hooks[0].valid === true);
  });

  it('should output JSON errors in --json mode', () => {
    const result = runValidatorWithFlags(path.join(TEST_HOOKS_DIR, 'invalid-hooks'), ['--json']);
    assert.equal(result.code, 1);
    const output = JSON.parse(result.stdout.trim());
    assert.ok(output.valid === false);
    assert.ok(Array.isArray(output.hooks));
    assert.ok(output.hooks.length > 0);
    assert.ok(output.hooks[0].valid === false);
    assert.ok(output.hooks[0].errors.length > 0);
  });
});
