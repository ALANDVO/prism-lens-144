#!/usr/bin/env node
/**
 * Agent frontmatter validator for Cursor plugins.
 * Validates agent .md files for required fields, name format, and description length.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { load } from 'js-yaml';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
const TARGET_DIR = args.find(arg => !arg.startsWith('--')) ? path.resolve(args.find(arg => !arg.startsWith('--'))) : ROOT;
const STRICT_MODE = args.includes('--strict');
const JSON_MODE = args.includes('--json');

const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);

const agentSchema = JSON.parse(fs.readFileSync(path.join(ROOT, 'schemas/agent.schema.json'), 'utf8'));
const validateAgent = ajv.compile(agentSchema);

/**
 * Parse YAML frontmatter from a markdown file.
 * Returns { frontmatter: object, content: string, error: string|null }
 */
  function parseFrontmatter(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');

    // Check for frontmatter delimiter - accept both Unix and Windows line endings
    const delimiterUnix = '---\n';
    const delimiterWindows = '---\r\n';
    if (!(content.startsWith(delimiterUnix) || content.startsWith(delimiterWindows))) {
      return { frontmatter: null, content, error: 'Missing frontmatter delimiter (---)' };
    }

    const endDelimiter = content.indexOf('\n---\n');
    if (endDelimiter === -1) {
      return { frontmatter: null, content, error: 'Unclosed frontmatter delimiter' };
    }

    const frontmatterText = content.slice(4, endDelimiter);
    const bodyContent = content.slice(endDelimiter + 5);

    try {
      const frontmatter = load(frontmatterText);
      return { frontmatter, content: bodyContent, error: null };
    } catch (e) {
      return { frontmatter: null, content: bodyContent, error: `YAML parse error: ${e.message}` };
    }
  }

/**
 * Validate a single agent .md file.
 * Returns array of errors: { file: string, message: string }
 */
function validateAgentFile(filePath) {
  const errors = [];
  const relPath = path.relative(TARGET_DIR, filePath);

  const { frontmatter, error } = parseFrontmatter(filePath);

  if (error) {
    errors.push({ file: relPath, message: `Frontmatter parse error: ${error}` });
    return errors;
  }

  if (!frontmatter) {
    errors.push({ file: relPath, message: 'No frontmatter found' });
    return errors;
  }

  // Check required fields
  if (!frontmatter.name) {
    errors.push({ file: relPath, message: 'Missing required field: name' });
  }

  if (!frontmatter.description) {
    errors.push({ file: relPath, message: 'Missing required field: description' });
  }

  // Validate name format if present
  if (frontmatter.name) {
    const namePattern = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/;
    if (!namePattern.test(frontmatter.name)) {
      errors.push({ file: relPath, message: `Invalid name format: "${frontmatter.name}". Must be lowercase letters, numbers, and hyphens only.` });
    }

    // Check name matches parent folder name
    const parentFolder = path.basename(path.dirname(filePath));
    if (frontmatter.name !== parentFolder) {
      errors.push({ file: relPath, message: `Agent name "${frontmatter.name}" does not match parent folder name "${parentFolder}"` });
    }
  }

  // Validate description length if present
  if (frontmatter.description && frontmatter.description.length > 1024) {
    errors.push({ file: relPath, message: `Description exceeds 1024 characters (${frontmatter.description.length} chars)` });
  }

  // Schema validation (strict mode only)
  if (STRICT_MODE && frontmatter.name && frontmatter.description) {
    const valid = validateAgent(frontmatter);
    if (!valid) {
      for (const err of validateAgent.errors || []) {
        errors.push({ file: relPath, message: `${err.instancePath || 'root'}: ${err.message}` });
      }
    }
  }

  return errors;
}

/**
 * Find all agent .md files in the target directory.
 * Agents are typically in agents/ subdirectories.
 */
function findAgentFiles(root) {
  const agentFiles = [];

  function walk(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        // Check if file is in an agents directory
        const relPath = path.relative(root, fullPath);
        if (relPath.includes('/agents/') || relPath.startsWith('agents/')) {
          agentFiles.push(fullPath);
        }
      }
    }
  }

  walk(root);
  return agentFiles;
}

function main() {
  if (!JSON_MODE && STRICT_MODE) {
    console.log('Running in strict mode: validating agent frontmatter against JSON schema');
  }

  if (!JSON_MODE) {
    console.log(`Validating agents in: ${TARGET_DIR}`);
  }

  const agentFiles = findAgentFiles(TARGET_DIR);

  if (!JSON_MODE) {
    if (agentFiles.length === 0) {
      console.log('No agent files found.');
    } else {
      console.log(`Found ${agentFiles.length} agent file(s)`);
    }
  }

  let allErrors = [];
  const results = [];

  for (const file of agentFiles) {
    const errors = validateAgentFile(file);
    const relPath = path.relative(TARGET_DIR, file);
    results.push({ file: relPath, valid: errors.length === 0, errors });
    allErrors.push(...errors);
  }

  if (JSON_MODE) {
    console.log(JSON.stringify({ valid: allErrors.length === 0, agents: results, errors: allErrors }, null, 2));
  } else if (allErrors.length > 0) {
    console.error('\nValidation failed:');
    for (const err of allErrors) {
      console.error(`  ${err.file}: ${err.message}`);
    }
    return 1;
  } else {
    if (agentFiles.length > 0) {
      console.log('\nAll agents validated successfully.');
    }
  }

  return allErrors.length > 0 ? 1 : 0;
}

process.exit(main());
