import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const validateScript = path.join(projectRoot, 'scripts', 'validate-skill.mjs');
const testSkillDir = path.join(projectRoot, 'test-plugins', 'sample-plugin', 'skills', 'sample-skill');

describe('validate-skill.mjs', () => {
  it('validates a correct skill frontmatter', () => {
    const result = spawnSync('node', [validateScript, testSkillDir], {
      cwd: projectRoot,
      encoding: 'utf-8'
    });
    assert.strictEqual(result.status, 0, `Validator should exit with 0, got ${result.status}: ${result.stderr}`);
    assert.ok(result.stdout.includes('✅ Skill frontmatter is valid'));
    assert.ok(result.stdout.includes('Name: sample-skill'));
  });

  it('fails on missing SKILL.md', () => {
    const tempDir = path.join(projectRoot, 'test-plugins', 'empty-skill');
    fs.mkdirSync(tempDir, { recursive: true });
    const result = spawnSync('node', [validateScript, tempDir], {
      cwd: projectRoot,
      encoding: 'utf-8'
    });
    assert.notStrictEqual(result.status, 0, 'Validator should fail on missing SKILL.md');
    assert.ok(result.stderr.includes('SKILL.md not found') || result.stdout.includes('SKILL.md not found'));
    fs.rmSync(tempDir, { recursive: true });
  });

  it('fails on invalid name pattern (uppercase and space)', () => {
    const tempDir = path.join(projectRoot, 'test-plugins', 'bad-name-skill');
    fs.mkdirSync(tempDir, { recursive: true });
    const skillContent = `---
name: Poteto Mode
description: A skill with invalid name
---
# Bad Name Skill`;
    fs.writeFileSync(path.join(tempDir, 'SKILL.md'), skillContent);
    const result = spawnSync('node', [validateScript, tempDir], {
      cwd: projectRoot,
      encoding: 'utf-8'
    });
    assert.notStrictEqual(result.status, 0, 'Validator should fail on invalid name pattern');
    assert.ok(result.stderr.includes('pattern') || result.stdout.includes('pattern'));
    fs.rmSync(tempDir, { recursive: true });
  });

  it('fails when name does not match parent folder', () => {
    const tempDir = path.join(projectRoot, 'test-plugins', 'mismatch-skill');
    fs.mkdirSync(tempDir, { recursive: true });
    const skillContent = `---
name: different-name
description: A skill with mismatched name
---
# Mismatch Skill`;
    fs.writeFileSync(path.join(tempDir, 'SKILL.md'), skillContent);
    const result = spawnSync('node', [validateScript, tempDir], {
      cwd: projectRoot,
      encoding: 'utf-8'
    });
    assert.notStrictEqual(result.status, 0, 'Validator should fail on name/folder mismatch');
    assert.ok(result.stderr.includes('does not match parent folder') || result.stdout.includes('does not match parent folder'));
    fs.rmSync(tempDir, { recursive: true });
  });

  it('fails on description exceeding 1024 characters', () => {
    const tempDir = path.join(projectRoot, 'test-plugins', 'long-desc-skill');
    fs.mkdirSync(tempDir, { recursive: true });
    const longDesc = 'a'.repeat(1025);
    const skillContent = `---
name: long-desc-skill
description: ${longDesc}
---
# Long Description Skill`;
    fs.writeFileSync(path.join(tempDir, 'SKILL.md'), skillContent);
    const result = spawnSync('node', [validateScript, tempDir], {
      cwd: projectRoot,
      encoding: 'utf-8'
    });
    assert.notStrictEqual(result.status, 0, 'Validator should fail on description too long');
    assert.ok(result.stderr.includes('more than 1024 characters') || result.stdout.includes('more than 1024 characters'));
    fs.rmSync(tempDir, { recursive: true });
  });

  it('fails on invalid YAML frontmatter', () => {
    const tempDir = path.join(projectRoot, 'test-plugins', 'invalid-yaml-skill');
    fs.mkdirSync(tempDir, { recursive: true });
    const skillContent = `---
name: invalid-yaml-skill
description: A skill with invalid YAML
paths: [unclosed
---
# Invalid YAML Skill`;
    fs.writeFileSync(path.join(tempDir, 'SKILL.md'), skillContent);
    const result = spawnSync('node', [validateScript, tempDir], {
      cwd: projectRoot,
      encoding: 'utf-8'
    });
    assert.notStrictEqual(result.status, 0, 'Validator should fail on invalid YAML');
    assert.ok(result.stderr.includes('YAML parse error') || result.stdout.includes('YAML parse error'));
    fs.rmSync(tempDir, { recursive: true });
  });

  it('passes with valid displayName and metadata', () => {
    const tempDir = path.join(projectRoot, 'test-plugins', 'full-skill');
    fs.mkdirSync(tempDir, { recursive: true });
    const skillContent = `---
name: full-skill
displayName: Full Skill Display
description: A skill with all optional fields
paths:
  - "**/*.js"
  - "**/*.ts"
icon: "🔧"
color: "blue"
metadata:
  cursor-display-name: Full Skill Display
  custom-field: custom-value
---
# Full Skill`;
    fs.writeFileSync(path.join(tempDir, 'SKILL.md'), skillContent);
    const result = spawnSync('node', [validateScript, tempDir], {
      cwd: projectRoot,
      encoding: 'utf-8'
    });
    assert.strictEqual(result.status, 0, `Validator should pass with full frontmatter, got ${result.status}: ${result.stderr}`);
    assert.ok(result.stdout.includes('✅ Skill frontmatter is valid'));
    assert.ok(result.stdout.includes('Display Name: Full Skill Display'));
    fs.rmSync(tempDir, { recursive: true });
  });
});