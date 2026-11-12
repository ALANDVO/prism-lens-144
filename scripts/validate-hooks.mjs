#!/usr/bin/env node
/**
 * Hooks configuration validator for Cursor plugins.
 * Validates hooks.json files for structure and script path existence.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
const TARGET_DIR = args.find(arg => !arg.startsWith('--')) ? path.resolve(args.find(arg => !arg.startsWith('--'))) : ROOT;
const STRICT_MODE = args.includes('--strict');
const JSON_MODE = args.includes('--json');

const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);

const hooksSchema = JSON.parse(fs.readFileSync(path.join(ROOT, 'schemas/hooks.schema.json'), 'utf8'));
const validateHooks = ajv.compile(hooksSchema);

/**
 * Find all hooks.json files in the target directory.
 */
function findHooksFiles(root) {
  const files = [];
  
  function walk(dir) {
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(fullPath);
        } else if (entry.isFile() && entry.name === 'hooks.json') {
          files.push(fullPath);
        }
      }
    } catch (e) {
      // Ignore permission errors
    }
  }
  
  walk(root);
  return files;
}

/**
 * Validate a single hooks.json file.
 * Returns array of errors: { file: string, message: string }
 */
function validateHooksFile(filePath) {
  const errors = [];
  const relativePath = path.relative(TARGET_DIR, filePath);
  const baseDir = path.dirname(filePath);
  
  let content;
  try {
    content = fs.readFileSync(filePath, 'utf8');
  } catch (e) {
    return [{ file: relativePath, message: `Cannot read file: ${e.message}` }];
  }
  
  let hooksData;
  try {
    hooksData = JSON.parse(content);
  } catch (e) {
    return [{ file: relativePath, message: `Invalid JSON: ${e.message}` }];
  }
  
  // Validate against schema
  const valid = validateHooks(hooksData);
  if (!valid) {
    for (const err of validateHooks.errors || []) {
      const fieldPath = err.instancePath || '/';
      errors.push({
        file: relativePath,
        message: `Schema validation failed at ${fieldPath}: ${err.message}`
      });
    }
    return errors;
  }
  
  // Check that script paths exist
  if (hooksData.hooks && Array.isArray(hooksData.hooks)) {
    for (let i = 0; i < hooksData.hooks.length; i++) {
      const hook = hooksData.hooks[i];
      if (hook.script) {
        const scriptPath = path.join(baseDir, hook.script);
        if (!fs.existsSync(scriptPath)) {
          errors.push({
            file: relativePath,
            message: `Hook ${i} (${hook.event}): script file does not exist: ${hook.script}`
          });
        }
      }
    }
  }
  
  return errors;
}

function main() {
  if (!JSON_MODE && STRICT_MODE) {
    console.log('Running in strict mode: validating hooks.json against JSON schema');
  }
  
  if (!JSON_MODE) {
    console.log(`Validating hooks.json files in: ${TARGET_DIR}`);
  }
  
  const hooksFiles = findHooksFiles(TARGET_DIR);
  
  if (!JSON_MODE) {
    if (hooksFiles.length === 0) {
      console.log('No hooks.json files found.');
    } else {
      console.log(`Found ${hooksFiles.length} hooks.json file(s).`);
    }
  }
  
  let allErrors = [];
  const results = [];
  for (const file of hooksFiles) {
    const errors = validateHooksFile(file);
    const relPath = path.relative(TARGET_DIR, file);
    results.push({ file: relPath, valid: errors.length === 0, errors });
    allErrors.push(...errors);
  }
  
  if (JSON_MODE) {
    console.log(JSON.stringify({ valid: allErrors.length === 0, hooks: results, errors: allErrors }, null, 2));
  } else if (allErrors.length > 0) {
    console.error('\nValidation failed:');
    for (const err of allErrors) {
      console.error(`  ${err.file}: ${err.message}`);
    }
    return 1;
  } else {
    if (hooksFiles.length > 0) {
      console.log('\nAll hooks.json files are valid.');
    }
  }
  
  return allErrors.length > 0 ? 1 : 0;
}

process.exit(main());
