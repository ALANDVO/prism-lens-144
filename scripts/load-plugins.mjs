import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DEFAULT_PLUGIN_DIRS = [
  path.join(process.env.HOME || '', '.cursor', 'plugins', 'local'),
  path.join(process.env.HOME || '', '.cursor', 'plugins', 'marketplace'),
];

function resolveSymlink(pluginPath) {
  const isSymlink = fs.lstatSync(pluginPath).isSymbolicLink();
  try {
    const realPath = fs.realpathSync(pluginPath);
    return { valid: true, realPath, isSymlink };
  } catch (e) {
    return { valid: false, error: `Failed to resolve symlink: ${e.message}`, isSymlink };
  }
}

function findPluginManifest(pluginDir) {
  const manifestPath = path.join(pluginDir, '.cursor-plugin', 'plugin.json');
  if (fs.existsSync(manifestPath)) {
    return manifestPath;
  }
  return null;
}

function loadPlugin(pluginDir) {
  const resolved = resolveSymlink(pluginDir);
  if (!resolved.valid) {
    return { valid: false, errors: [resolved.error], isSymlink: resolved.isSymlink };
  }

  const manifestPath = findPluginManifest(resolved.realPath);
  if (!manifestPath) {
    return {
      valid: false,
      errors: [`No .cursor-plugin/plugin.json found in ${resolved.realPath}`],
      isSymlink: resolved.isSymlink,
      realPath: resolved.realPath,
    };
  }

  try {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
    return {
      valid: true,
      manifest,
      pluginDir: resolved.realPath,
      manifestPath,
      isSymlink: resolved.isSymlink,
      originalPath: pluginDir,
    };
  } catch (e) {
    return {
      valid: false,
      errors: [`Invalid JSON in manifest: ${e.message}`],
      isSymlink: resolved.isSymlink,
      realPath: resolved.realPath,
    };
  }
}

function discoverPlugins(pluginDirs = DEFAULT_PLUGIN_DIRS) {
  const plugins = [];

  for (const baseDir of pluginDirs) {
    if (!fs.existsSync(baseDir)) {
      continue;
    }

    const entries = fs.readdirSync(baseDir, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory() && !entry.isSymbolicLink()) {
        continue;
      }

      const pluginPath = path.join(baseDir, entry.name);
      const result = loadPlugin(pluginPath);

      if (result.valid) {
        plugins.push({
          name: result.manifest.name,
          displayName: result.manifest.displayName,
          version: result.manifest.version,
          description: result.manifest.description,
          pluginDir: result.pluginDir,
          manifestPath: result.manifestPath,
          isSymlink: result.isSymlink,
          originalPath: result.originalPath,
          sourceDir: baseDir,
          valid: true,
        });
      } else {
        plugins.push({
          name: entry.name,
          valid: false,
          errors: result.errors,
          isSymlink: result.isSymlink,
          originalPath: pluginPath,
          sourceDir: baseDir,
        });
      }
    }
  }

  return plugins;
}

async function main() {
  const args = process.argv.slice(2);
  const pluginDirs = args.length > 0 ? args : DEFAULT_PLUGIN_DIRS;

  const plugins = discoverPlugins(pluginDirs);

  console.log(`Discovered ${plugins.length} plugin(s):\n`);

  for (const plugin of plugins) {
    if (plugin.valid) {
      const symlinkInfo = plugin.isSymlink ? ` (symlink -> ${plugin.originalPath})` : '';
      console.log(`✅ ${plugin.displayName || plugin.name} v${plugin.version}${symlinkInfo}`);
      console.log(`   Path: ${plugin.pluginDir}`);
      console.log(`   Description: ${plugin.description}`);
      console.log();
    } else {
      console.log(`❌ ${plugin.name} (invalid)`);
      for (const err of plugin.errors) {
        console.log(`   Error: ${err}`);
      }
      if (plugin.isSymlink) {
        console.log(`   Note: Was a symlink to ${plugin.originalPath}`);
      }
      console.log();
    }
  }

  const validCount = plugins.filter(p => p.valid).length;
  const symlinkCount = plugins.filter(p => p.valid && p.isSymlink).length;

  console.log(`Summary: ${validCount} valid, ${plugins.length - validCount} invalid, ${symlinkCount} via symlink`);
}

export { discoverPlugins, loadPlugin, resolveSymlink, DEFAULT_PLUGIN_DIRS };

main();

