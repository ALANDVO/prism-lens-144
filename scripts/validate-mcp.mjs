#!/usr/bin/env node
/**
 * MCP configuration validator for Cursor plugins.
 * Validates mcp.json files for structure and placeholder variables.
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

const mcpSchema = JSON.parse(fs.readFileSync(path.join(ROOT, 'schemas/mcp.schema.json'), 'utf8'));
const validateMcp = ajv.compile(mcpSchema);

/**
 * Find all mcp.json files in the target directory.
 */
function findMcpFiles(root) {
  const files = [];
  
  function walk(dir) {
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(fullPath);
        } else if (entry.isFile() && entry.name === 'mcp.json') {
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
 * Extract placeholder variables from mcp.json content.
 * Returns array of variable names found (e.g., 'API_KEY' from ${API_KEY}).
 */
function extractPlaceholders(content) {
  const placeholders = [];
  const regex = /\$\{([^}]+)\}/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    placeholders.push(match[1]);
  }
  return placeholders;
}

/**
 * Validate a single mcp.json file.
 * Returns array of errors: { file: string, message: string }
 */
function validateMcpFile(filePath, pluginVariables) {
  const errors = [];
  const relPath = path.relative(TARGET_DIR, filePath);
  const content = fs.readFileSync(filePath, 'utf8');
  
  // Parse JSON
  let mcpData;
  try {
    mcpData = JSON.parse(content);
  } catch (e) {
    errors.push({ file: relPath, message: `Invalid JSON: ${e.message}` });
    return errors;
  }
  
  // Validate against schema
  const valid = validateMcp(mcpData);
  if (!valid) {
    for (const err of validateMcp.errors || []) {
      const instancePath = err.instancePath || '/';
      errors.push({ 
        file: relPath, 
        message: `Schema validation failed at ${instancePath}: ${err.message}` 
      });
    }
  }
  
  // Validate placeholder variables against plugin variables
  const placeholders = extractPlaceholders(content);
  for (const placeholder of placeholders) {
    if (!pluginVariables || !Object.prototype.hasOwnProperty.call(pluginVariables, placeholder)) {
      errors.push({ 
        file: relPath, 
        message: `Undefined variable placeholder: \${${placeholder}} (not declared in plugin.json variables)` 
      });
    }
  }
  
  return errors;
}

/**
 * Find the plugin.json for a given mcp.json file by walking up the directory tree.
 */
function findPluginJson(mcpFilePath) {
  let currentDir = path.dirname(mcpFilePath);
  while (currentDir !== ROOT && currentDir !== path.parse(currentDir).root) {
    const pluginPath = path.join(currentDir, '.cursor-plugin', 'plugin.json');
    if (fs.existsSync(pluginPath)) {
      return pluginPath;
    }
    currentDir = path.dirname(currentDir);
  }
  return null;
}

/**
 * Load variables from plugin.json.
 */
function loadPluginVariables(pluginJsonPath) {
  try {
    const content = fs.readFileSync(pluginJsonPath, 'utf8');
    const pluginData = JSON.parse(content);
    return pluginData.variables || {};
  } catch {
    return {};
  }
}

function main() {
  if (!JSON_MODE && STRICT_MODE) {
    console.log('Running in strict mode: validating mcp.json against JSON schema and placeholders');
  }
  
  if (!JSON_MODE) {
    console.log(`Validating MCP configurations in: ${TARGET_DIR}`);
  }
  
  const mcpFiles = findMcpFiles(TARGET_DIR);
  
  if (!JSON_MODE) {
    if (mcpFiles.length === 0) {
      console.log('No mcp.json files found.');
    } else {
      console.log(`Found ${mcpFiles.length} mcp.json file(s).`);
    }
  }
  
  let allErrors = [];
  const results = [];
  
  for (const file of mcpFiles) {
    const pluginJsonPath = findPluginJson(file);
    const pluginVariables = pluginJsonPath ? loadPluginVariables(pluginJsonPath) : {};
    
    const errors = validateMcpFile(file, pluginVariables);
    const relPath = path.relative(TARGET_DIR, file);
    results.push({ file: relPath, valid: errors.length === 0, errors });
    allErrors.push(...errors);
  }
  
  if (JSON_MODE) {
    console.log(JSON.stringify({ valid: allErrors.length === 0, mcp: results, errors: allErrors }, null, 2));
  } else if (allErrors.length > 0) {
    console.error('\nValidation failed:');
    for (const err of allErrors) {
      console.error(`  ${err.file}: ${err.message}`);
    }
    return 1;
  } else {
    if (mcpFiles.length > 0) {
      console.log('\nAll MCP configurations are valid.');
    }
  }
  
  return allErrors.length > 0 ? 1 : 0;
}

process.exit(main());
