
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const schemaPath = path.resolve(__dirname, '../schemas/plugin.schema.json');
const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf-8'));

const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);
const validate = ajv.compile(schema);

function checkPaths(manifest, pluginDir) {
  const errors = [];
  const checkField = (field, label) => {
    if (manifest[field]) {
      for (const p of manifest[field]) {
        const fullPath = path.resolve(pluginDir, p);
        if (!fs.existsSync(fullPath)) {
          errors.push({ message: `${label} path does not exist: ${p}` });
        }
      }
    }
  };
  checkField('skills', 'Skill');
  checkField('agents', 'Agent');
  checkField('mcpServers', 'MCP Server');
  checkField('hooks', 'Hooks');
  checkField('commands', 'Commands');
  if (manifest.logo) {
    const logoPath = path.resolve(pluginDir, manifest.logo);
    if (!fs.existsSync(logoPath)) {
      errors.push({ message: `Logo path does not exist: ${manifest.logo}` });
    }
  }
  return { valid: errors.length === 0, errors };
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error('Usage: validate-plugin.mjs <plugin-dir>');
    process.exit(1);
  }
  const pluginDir = args[0];
  const manifestPath = path.join(pluginDir, '.cursor-plugin', 'plugin.json');
  if (!fs.existsSync(manifestPath)) {
    console.error(`❌ Manifest not found: ${manifestPath}`);
    process.exit(1);
  }
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
  const valid = validate(manifest);
  if (!valid) {
    console.error('❌ Schema validation failed:');
    for (const err of validate.errors) {
      console.error(`  - ${err.instancePath || '/'}: ${err.message}`);
    }
    process.exit(1);
  }
  const pathCheck = checkPaths(manifest, pluginDir);
  if (!pathCheck.valid) {
    console.error('❌ Referenced path checks failed:');
    for (const err of pathCheck.errors) {
      console.error(`  - ${err.message}`);
    }
    process.exit(1);
  }
  console.log('✅ Plugin manifest is valid');
  console.log(`   Name: ${manifest.name}`);
  console.log(`   Version: ${manifest.version}`);
  console.log(`   Display Name: ${manifest.displayName}`);
}

main();
