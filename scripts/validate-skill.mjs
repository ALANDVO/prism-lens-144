import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import * as yaml from 'js-yaml';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const schemaPath = path.resolve(__dirname, '../schemas/skill.schema.json');
const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf-8'));

const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);
const validate = ajv.compile(schema);

function parseSkillFrontmatter(skillPath) {
  const content = fs.readFileSync(skillPath, 'utf-8');
  const frontmatterMatch = content.match(/^\s*---\n([\s\S]*?)\n---/);
  if (!frontmatterMatch) {
    return { valid: false, errors: [{ message: 'No frontmatter found (missing --- delimiters)' }] };
  }
  try {
    const frontmatter = yaml.load(frontmatterMatch[1]);
    return { valid: true, frontmatter };
  } catch (e) {
    return { valid: false, errors: [{ message: `YAML parse error: ${e.message}` }] };
  }
}

function checkNameMatchesFolder(frontmatter, skillDir) {
  const folderName = path.basename(path.resolve(skillDir));
  if (frontmatter.name !== folderName) {
    return { valid: false, errors: [{ message: `Skill name "${frontmatter.name}" does not match parent folder name "${folderName}"` }] };
  }
  return { valid: true, errors: [] };
}

function checkDescriptionLength(frontmatter) {
  if (frontmatter.description && frontmatter.description.length > 1024) {
    return { valid: false, errors: [{ message: `Description exceeds 1024 characters (${frontmatter.description.length})` }] };
  }
  return { valid: true, errors: [] };
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error('Usage: validate-skill.mjs <skill-dir>');
    process.exit(1);
  }
  const skillDir = args[0];
  const skillPath = path.join(skillDir, 'SKILL.md');
  if (!fs.existsSync(skillPath)) {
    console.error(`❌ SKILL.md not found: ${skillPath}`);
    process.exit(1);
  }

  const parsed = parseSkillFrontmatter(skillPath);
  if (!parsed.valid) {
    console.error('❌ Frontmatter parse failed:');
    for (const err of parsed.errors) {
      console.error(`  - ${err.message}`);
    }
    process.exit(1);
  }

  const frontmatter = parsed.frontmatter;
  const valid = validate(frontmatter);
  if (!valid) {
    console.error('❌ Schema validation failed:');
    for (const err of validate.errors) {
      console.error(`  - ${err.instancePath || '/'}: ${err.message}`);
    }
    process.exit(1);
  }

  const nameCheck = checkNameMatchesFolder(frontmatter, skillDir);
  if (!nameCheck.valid) {
    console.error('❌ Name/folder mismatch:');
    for (const err of nameCheck.errors) {
      console.error(`  - ${err.message}`);
    }
    process.exit(1);
  }

  const descCheck = checkDescriptionLength(frontmatter);
  if (!descCheck.valid) {
    console.error('❌ Description check failed:');
    for (const err of descCheck.errors) {
      console.error(`  - ${err.message}`);
    }
    process.exit(1);
  }

  console.log('✅ Skill frontmatter is valid');
  console.log(`   Name: ${frontmatter.name}`);
  console.log(`   Display Name: ${frontmatter.displayName || '(not set)'}`);
  console.log(`   Description: ${frontmatter.description.slice(0, 80)}${frontmatter.description.length > 80 ? '...' : ''}`);
}

main();