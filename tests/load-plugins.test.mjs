import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { discoverPlugins, loadPlugin, resolveSymlink, DEFAULT_PLUGIN_DIRS } from '../scripts/load-plugins.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TEST_BASE_DIR = path.join(__dirname, '..', 'test-plugins', 'load-test');

function setupTestPlugins() {
  if (fs.existsSync(TEST_BASE_DIR)) {
    fs.rmSync(TEST_BASE_DIR, { recursive: true });
  }
  fs.mkdirSync(TEST_BASE_DIR, { recursive: true });

  // Create a real plugin directory
  const realPluginDir = path.join(TEST_BASE_DIR, 'real-plugin');
  fs.mkdirSync(path.join(realPluginDir, '.cursor-plugin'), { recursive: true });
  fs.mkdirSync(path.join(realPluginDir, 'skills', 'test-skill'), { recursive: true });
  fs.writeFileSync(
    path.join(realPluginDir, '.cursor-plugin', 'plugin.json'),
    JSON.stringify({
      name: 'real-plugin',
      version: '1.0.0',
      displayName: 'Real Plugin',
      description: 'A real plugin for testing',
      skills: ['skills/test-skill'],
    }, null, 2)
  );
  fs.writeFileSync(
    path.join(realPluginDir, 'skills', 'test-skill', 'SKILL.md'),
    '---\nname: test-skill\ndescription: Test skill\n---\n# Test Skill'
  );

  // Create a symlink to the real plugin
  const symlinkDir = path.join(TEST_BASE_DIR, 'symlinked-plugin');
  fs.symlinkSync(realPluginDir, symlinkDir);

  // Create a broken symlink
  const brokenSymlinkDir = path.join(TEST_BASE_DIR, 'broken-symlink');
  fs.symlinkSync('/nonexistent/path', brokenSymlinkDir);

  // Create a plugin with invalid manifest
  const invalidPluginDir = path.join(TEST_BASE_DIR, 'invalid-plugin');
  fs.mkdirSync(path.join(invalidPluginDir, '.cursor-plugin'), { recursive: true });
  fs.writeFileSync(
    path.join(invalidPluginDir, '.cursor-plugin', 'plugin.json'),
    '{ invalid json'
  );

  // Create a plugin without manifest
  const noManifestDir = path.join(TEST_BASE_DIR, 'no-manifest');
  fs.mkdirSync(noManifestDir, { recursive: true });

  return {
    realPluginDir,
    symlinkDir,
    brokenSymlinkDir,
    invalidPluginDir,
    noManifestDir,
  };
}

function cleanupTestPlugins() {
  if (fs.existsSync(TEST_BASE_DIR)) {
    fs.rmSync(TEST_BASE_DIR, { recursive: true });
  }
}

let testFixtures = null;

describe('load-plugins', () => {
  before(() => {
    testFixtures = setupTestPlugins();
  });

  after(() => {
    cleanupTestPlugins();
  });

  describe('resolveSymlink', () => {
    it('resolves a valid symlink to its real path', () => {
      const { symlinkDir, realPluginDir } = testFixtures;
      const result = resolveSymlink(symlinkDir);
      assert.strictEqual(result.valid, true);
      assert.strictEqual(result.realPath, path.resolve(realPluginDir));
      assert.strictEqual(result.isSymlink, true);
    });

    it('returns isSymlink: false for a real directory', () => {
      const { realPluginDir } = testFixtures;
      const result = resolveSymlink(realPluginDir);
      assert.strictEqual(result.valid, true);
      assert.strictEqual(result.realPath, path.resolve(realPluginDir));
      assert.strictEqual(result.isSymlink, false);
    });

    it('fails for a broken symlink', () => {
      const { brokenSymlinkDir } = testFixtures;
      const result = resolveSymlink(brokenSymlinkDir);
      assert.strictEqual(result.valid, false);
      assert.ok(result.error.includes('Failed to resolve symlink'));
      assert.strictEqual(result.isSymlink, true);
    });
  });

  describe('loadPlugin', () => {
    it('loads a valid real plugin', () => {
      const { realPluginDir } = testFixtures;
      const result = loadPlugin(realPluginDir);
      assert.strictEqual(result.valid, true);
      assert.strictEqual(result.manifest.name, 'real-plugin');
      assert.strictEqual(result.manifest.displayName, 'Real Plugin');
      assert.strictEqual(result.isSymlink, false);
    });

    it('loads a valid plugin via symlink', () => {
      const { symlinkDir, realPluginDir } = testFixtures;
      const result = loadPlugin(symlinkDir);
      assert.strictEqual(result.valid, true);
      assert.strictEqual(result.manifest.name, 'real-plugin');
      assert.strictEqual(result.isSymlink, true);
      assert.strictEqual(result.originalPath, symlinkDir);
      assert.strictEqual(result.pluginDir, path.resolve(realPluginDir));
    });

    it('fails for a broken symlink', () => {
      const { brokenSymlinkDir } = testFixtures;
      const result = loadPlugin(brokenSymlinkDir);
      assert.strictEqual(result.valid, false);
      assert.ok(result.errors[0].includes('Failed to resolve symlink'));
      assert.strictEqual(result.isSymlink, true);
    });

    it('fails for invalid JSON manifest', () => {
      const { invalidPluginDir } = testFixtures;
      const result = loadPlugin(invalidPluginDir);
      assert.strictEqual(result.valid, false);
      assert.ok(result.errors[0].includes('Invalid JSON'));
    });

    it('fails when manifest is missing', () => {
      const { noManifestDir } = testFixtures;
      const result = loadPlugin(noManifestDir);
      assert.strictEqual(result.valid, false);
      assert.ok(result.errors[0].includes('No .cursor-plugin/plugin.json found'));
    });
  });

  describe('discoverPlugins', () => {
    it('discovers real and symlinked plugins', () => {
      const plugins = discoverPlugins([TEST_BASE_DIR]);

      const validPlugins = plugins.filter(p => p.valid);
      const invalidPlugins = plugins.filter(p => !p.valid);

      assert.strictEqual(validPlugins.length, 2);
      assert.ok(validPlugins.some(p => p.name === 'real-plugin' && !p.isSymlink));
      assert.ok(validPlugins.some(p => p.name === 'real-plugin' && p.isSymlink));

      const symlinked = validPlugins.find(p => p.isSymlink);
      assert.ok(symlinked);
      assert.strictEqual(symlinked.originalPath, testFixtures.symlinkDir);

      assert.strictEqual(invalidPlugins.length, 3);
      const broken = invalidPlugins.find(p => p.name === 'broken-symlink');
      assert.ok(broken);
      assert.ok(broken.isSymlink);
      const invalid = invalidPlugins.find(p => p.name === 'invalid-plugin');
      assert.ok(invalid);
      assert.ok(invalid.errors[0].includes('Invalid JSON'));
      const noManifest = invalidPlugins.find(p => p.name === 'no-manifest');
      assert.ok(noManifest);
      assert.ok(noManifest.errors[0].includes('No .cursor-plugin/plugin.json found'));
    });

    it('skips non-existent directories', () => {
      const plugins = discoverPlugins(['/nonexistent/path']);
      assert.strictEqual(plugins.length, 0);
    });

    it('skips non-directory entries', () => {
      const fileDir = path.join(TEST_BASE_DIR, 'not-a-dir.txt');
      fs.writeFileSync(fileDir, 'not a plugin');

      const plugins = discoverPlugins([TEST_BASE_DIR]);
      const validPlugins = plugins.filter(p => p.valid);
      // Should still find the 2 valid plugins from fixtures, but not the file
      const filePlugin = plugins.find(p => p.name === 'not-a-dir.txt');
      assert.strictEqual(filePlugin, undefined, 'File should not be discovered as a plugin');

      fs.unlinkSync(fileDir);
    });
  });

  describe('DEFAULT_PLUGIN_DIRS', () => {
    it('includes standard cursor plugin directories', () => {
      assert.ok(DEFAULT_PLUGIN_DIRS.some(d => d.includes('.cursor/plugins/local')));
      assert.ok(DEFAULT_PLUGIN_DIRS.some(d => d.includes('.cursor/plugins/marketplace')));
    });
  });
});

