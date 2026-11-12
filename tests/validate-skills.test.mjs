#!/usr/bin/env node
/**
 * Tests for skill validator.
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
const TEST_SKILLS_DIR = path.join(ROOT, 'test-fixtures', 'skills');

function setupTestFixtures() {
  fs.rmSync(path.join(ROOT, 'test-fixtures'), { recursive: true, force: true });
  fs.mkdirSync(path.join(TEST_SKILLS_DIR, 'valid-skill'), { recursive: true });
  fs.mkdirSync(path.join(TEST_SKILLS_DIR, 'invalid-name'), { recursive: true });
  fs.mkdirSync(path.join(TEST_SKILLS_DIR, 'missing-description'), { recursive: true });
  fs.mkdirSync(path.join(TEST_SKILLS_DIR, 'long-description'), { recursive: true });
  fs.mkdirSync(path.join(TEST_SKILLS_DIR, 'name-mismatch'), { recursive: true });
  fs.mkdirSync(path.join(TEST_SKILLS_DIR, 'invalid-yaml'), { recursive: true });
  fs.mkdirSync(path.join(TEST_SKILLS_DIR, 'missing-frontmatter'), { recursive: true });
  
  // Valid skill
  fs.writeFileSync(
    path.join(TEST_SKILLS_DIR, 'valid-skill', 'SKILL.md'),
    '---\nname: valid-skill\ndescription: A valid test skill\npaths:\n  - src/**\nicon: sparkles\ncolor: "#ff6b6b"\nmetadata:\n  cursor-display-name: Valid Skill\n---\n# Valid Skill\nThis is a valid skill.'
  );
  
  // Invalid name (uppercase)
  fs.writeFileSync(
    path.join(TEST_SKILLS_DIR, 'invalid-name', 'SKILL.md'),
    '---\nname: InvalidName\ndescription: Skill with invalid name\n---\n# Invalid Name'
  );
  
  // Missing description
  fs.writeFileSync(
    path.join(TEST_SKILLS_DIR, 'missing-description', 'SKILL.md'),
    '---\nname: missing-description\n---\n# Missing Description'
  );
  
  // Long description (> 1024 chars)
  const longDesc = 'a'.repeat(1025);
  fs.writeFileSync(
    path.join(TEST_SKILLS_DIR, 'long-description', 'SKILL.md'),
    `---\nname: long-description\ndescription: ${longDesc}\n---\n# Long Description`
  );
  
  // Name doesn't match folder
  fs.writeFileSync(
    path.join(TEST_SKILLS_DIR, 'name-mismatch', 'SKILL.md'),
    '---\nname: different-name\ndescription: Name does not match folder\n---\n# Name Mismatch'
  );
  
  // Invalid YAML frontmatter (bad indentation)
  fs.writeFileSync(
    path.join(TEST_SKILLS_DIR, 'invalid-yaml', 'SKILL.md'),
    '---\nname: invalid-yaml\ndescription: : invalid yaml\n---\n# Invalid YAML'
  );
  
  // Missing frontmatter delimiter
  fs.writeFileSync(
    path.join(TEST_SKILLS_DIR, 'missing-frontmatter', 'SKILL.md'),
    '# No Frontmatter\nThis file has no frontmatter.'
  );
}

function cleanupTestFixtures() {
  fs.rmSync(path.join(ROOT, 'test-fixtures'), { recursive: true, force: true });
}

function runValidator(targetDir) {
  const result = spawnSync('node', ['scripts/validate-skills.mjs', targetDir], {
    cwd: ROOT,
    encoding: 'utf8'
  });
  return {
    code: result.status,
    stdout: result.stdout,
    stderr: result.stderr
  };
}

function runValidatorWithFlags(targetDir, flags) {
  const args = ['scripts/validate-skills.mjs', ...flags, targetDir];
  const result = spawnSync('node', args, {
    cwd: ROOT,
    encoding: 'utf8'
  });
  return {
    code: result.status,
    stdout: result.stdout,
    stderr: result.stderr
  };
}

describe('Skill Validator', () => {
  beforeEach(() => {
    setupTestFixtures();
  });
  
  after(() => {
    cleanupTestFixtures();
  });
  
  it('should validate a valid skill successfully', () => {
    const result = runValidator(path.join(TEST_SKILLS_DIR, 'valid-skill'));
    assert.equal(result.code, 0);
    assert.match(result.stdout, /All skills validated successfully/);
  });
  
  it('should fail on invalid name format (uppercase)', () => {
    const result = runValidator(path.join(TEST_SKILLS_DIR, 'invalid-name'));
    assert.equal(result.code, 1);
    assert.match(result.stderr + result.stdout, /Invalid name format/);
  });
  
  it('should fail when description is missing', () => {
    const result = runValidator(path.join(TEST_SKILLS_DIR, 'missing-description'));
    assert.equal(result.code, 1);
    assert.match(result.stderr + result.stdout, /Missing required field: description/);
  });
  
  it('should fail when description exceeds 1024 characters', () => {
    const result = runValidator(path.join(TEST_SKILLS_DIR, 'long-description'));
    assert.equal(result.code, 1);
    assert.match(result.stderr + result.stdout, /exceeds 1024 characters/);
  });
  
  it('should fail when skill name does not match parent folder name', () => {
    const result = runValidator(path.join(TEST_SKILLS_DIR, 'name-mismatch'));
    assert.equal(result.code, 1);
    assert.match(result.stderr + result.stdout, /does not match parent folder name/);
  });
  
  it('should fail on invalid YAML frontmatter', () => {
    const result = runValidator(path.join(TEST_SKILLS_DIR, 'invalid-yaml'));
    assert.equal(result.code, 1);
    assert.match(result.stderr + result.stdout, /Frontmatter parse error/);
  });
  
  it('should fail when frontmatter delimiter is missing', () => {
    const result = runValidator(path.join(TEST_SKILLS_DIR, 'missing-frontmatter'));
    assert.equal(result.code, 1);
    assert.match(result.stderr + result.stdout, /Missing frontmatter delimiter/);
  });

  it('should validate with --strict flag using JSON schema', () => {
    const result = runValidatorWithFlags(path.join(TEST_SKILLS_DIR, 'valid-skill'), ['--strict']);
    assert.equal(result.code, 0);
    assert.match(result.stdout, /All skills validated successfully/);
  });

  it('should fail on invalid schema fields in --strict mode', () => {
    const invalidSchemaDir = path.join(TEST_SKILLS_DIR, 'invalid-schema-field');
    fs.mkdirSync(invalidSchemaDir, { recursive: true });
    // Write a skill with an invalid field that passes basic validation but fails schema validation
    fs.writeFileSync(
      path.join(invalidSchemaDir, 'SKILL.md'),
      '---\nname: invalid-schema-field\ndescription: Test skill\ninvalidField: "should fail in strict mode"\n---\n# Invalid Schema Field'
    );
    
    // Non-strict mode should pass (only basic validation)
    const nonStrictResult = runValidator(invalidSchemaDir);
    assert.equal(nonStrictResult.code, 0);
// Strict mode should fail (schema validation)
    const strictResult = runValidatorWithFlags(invalidSchemaDir, ['--strict']);
    assert.equal(strictResult.code, 1);
    assert.match(strictResult.stderr + strictResult.stdout, /must NOT have additional properties/);
    
    fs.rmSync(invalidSchemaDir, { recursive: true, force: true });
  });

  it('should output JSON with --json flag', () => {
    const result = runValidatorWithFlags(path.join(TEST_SKILLS_DIR, 'valid-skill'), ['--json']);
    assert.equal(result.code, 0);
    const output = JSON.parse(result.stdout.trim());
    assert.ok(output.valid === true);
    assert.ok(Array.isArray(output.skills));
    assert.ok(output.skills.length > 0);
    assert.ok(output.skills[0].valid === true);
  });

  it('should output JSON with --strict --json flags combined', () => {
    const result = runValidatorWithFlags(path.join(TEST_SKILLS_DIR, 'valid-skill'), ['--strict', '--json']);
    assert.equal(result.code, 0);
    const output = JSON.parse(result.stdout.trim());
    assert.ok(output.valid === true);
    assert.ok(Array.isArray(output.skills));
    assert.ok(output.skills.length > 0);
    assert.ok(output.skills[0].valid === true);
  });

  it('should output JSON errors in --json mode', () => {
    const result = runValidatorWithFlags(path.join(TEST_SKILLS_DIR, 'invalid-name'), ['--json']);
    assert.equal(result.code, 1);
    const output = JSON.parse(result.stdout.trim());
    assert.ok(output.valid === false);
    assert.ok(Array.isArray(output.skills));
    assert.ok(output.skills.length > 0);
    assert.ok(output.skills[0].valid === false);
    assert.ok(output.skills[0].errors.length > 0);
  });
});
