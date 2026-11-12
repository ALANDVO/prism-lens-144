import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { load } from 'js-yaml';

const __filename = new URL(import.meta.url).pathname;
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);

const pluginSchema = JSON.parse(fs.readFileSync(path.join(ROOT, 'schemas/plugin.schema.json'), 'utf8'));
const marketplaceSchema = JSON.parse(fs.readFileSync(path.join(ROOT, 'schemas/marketplace.schema.json'), 'utf8'));
const skillSchema = JSON.parse(fs.readFileSync(path.join(ROOT, 'schemas/skill.schema.json'), 'utf8'));
const agentSchema = JSON.parse(fs.readFileSync(path.join(ROOT, 'schemas/agent.schema.json'), 'utf8'));
const hooksSchema = JSON.parse(fs.readFileSync(path.join(ROOT, 'schemas/hooks.schema.json'), 'utf8'));
const mcpSchema = JSON.parse(fs.readFileSync(path.join(ROOT, 'schemas/mcp.schema.json'), 'utf8'));
const ruleSchema = JSON.parse(fs.readFileSync(path.join(ROOT, 'schemas/rule.schema.json'), 'utf8'));
const commandSchema = JSON.parse(fs.readFileSync(path.join(ROOT, 'schemas/command.schema.json'), 'utf8'));

const validatePlugin = ajv.compile(pluginSchema);
const validateMarketplace = ajv.compile(marketplaceSchema);
const validateSkillSchema = ajv.compile(skillSchema);
const validateAgentSchema = ajv.compile(agentSchema);
const validateHooksSchema = ajv.compile(hooksSchema);
const validateMcpSchema = ajv.compile(mcpSchema);
const validateRuleSchema = ajv.compile(ruleSchema);
const validateCommandSchema = ajv.compile(commandSchema);

function findPluginDirs(root) {
  const dirs = [];
  function walk(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === '.cursor-plugin') {
          dirs.push(dir);
        } else if (!entry.name.startsWith('.') && entry.name !== 'node_modules' && entry.name !== 'schemas' && entry.name !== 'scripts' && entry.name !== 'tests') {
          walk(fullPath);
        }
      } else if (entry.isSymbolicLink()) {
        // Handle symlinks to directories
        try {
          const realPath = fs.realpathSync(fullPath);
          const stat = fs.statSync(realPath);
          if (stat.isDirectory()) {
            const linkName = entry.name;
            if (linkName === '.cursor-plugin') {
              dirs.push(dir);
            } else if (!linkName.startsWith('.') && linkName !== 'node_modules' && linkName !== 'schemas' && linkName !== 'scripts' && linkName !== 'tests') {
              walk(realPath);
            }
          }
        } catch {
          // Ignore broken symlinks
        }
      }
    }
  }
  walk(root);
  return dirs;
}

function checkPathsExist(baseDir, pluginData) {
  const errors = [];
  const componentFields = [
    { field: 'skills', label: 'Skill' },
    { field: 'agents', label: 'Agent' },
    { field: 'commands', label: 'Command' },
    { field: 'rules', label: 'Rule' }
  ];
  for (const { field, label } of componentFields) {
    if (Array.isArray(pluginData[field])) {
      for (const relPath of pluginData[field]) {
        const fullPath = path.join(baseDir, relPath);
        if (!fs.existsSync(fullPath)) {
          errors.push(`${label} path does not exist: ${relPath}`);
        }
      }
    }
  }
  if (pluginData.hooks && typeof pluginData.hooks === 'string') {
    const fullPath = path.join(baseDir, pluginData.hooks);
    if (!fs.existsSync(fullPath)) {
      errors.push(`Hooks path does not exist: ${pluginData.hooks}`);
    }
  }
  if (pluginData.mcpServers && typeof pluginData.mcpServers === 'string') {
    const fullPath = path.join(baseDir, pluginData.mcpServers);
    if (!fs.existsSync(fullPath)) {
      errors.push(`MCP servers path does not exist: ${pluginData.mcpServers}`);
    }
  }
  if (pluginData.icon && typeof pluginData.icon === 'string') {
    const fullPath = path.join(baseDir, pluginData.icon);
    if (!fs.existsSync(fullPath)) {
      errors.push(`Icon path does not exist: ${pluginData.icon}`);
    }
  }
  return errors;
}

function validateFile(filePath, validator, schemaName) {
  const content = fs.readFileSync(filePath, 'utf8');
  let data;
  try {
    data = JSON.parse(content);
  } catch (e) {
    return { valid: false, errors: [`${schemaName}: Invalid JSON - ${e.message}`] };
  }
  const valid = validator(data);
  if (!valid) {
    const errors = validator.errors?.map(err => `${schemaName}: ${err.instancePath || '/'}: ${err.message}`) || [];
    return { valid: false, errors };
  }
  return { valid: true, data };
}

function parseYamlFrontmatter(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (!frontmatterMatch) {
    return { valid: false, errors: ['Missing frontmatter delimiter (---)'] };
  }
  try {
    const data = load(frontmatterMatch[1]);
    return { valid: true, data };
  } catch (e) {
    return { valid: false, errors: [`Invalid YAML frontmatter - ${e.message}`] };
  }
}

function validateSkillFile(baseDir, relPath) {
  const fullPath = path.join(baseDir, relPath);
  let skillFilePath = fullPath;
  if (fs.existsSync(fullPath) && fs.statSync(fullPath).isDirectory()) {
    skillFilePath = path.join(fullPath, 'SKILL.md');
  }
  if (!fs.existsSync(skillFilePath)) {
    return [{ file: relPath, message: `SKILL.md not found: ${relPath}/SKILL.md` }];
  }
  const result = parseYamlFrontmatter(skillFilePath);
  if (!result.valid) {
    return [{ file: relPath, message: result.errors.join('; ') }];
  }
  const skillData = result.data;
  const errors = [];
  const validSkill = validateSkillSchema(skillData);
  if (!validSkill) {
    for (const err of validateSkillSchema.errors || []) {
      errors.push(`${err.instancePath || '/'}: ${err.message}`);
    }
  }
  const folderName = path.basename(path.dirname(skillFilePath));
  if (skillData.name && skillData.name !== folderName) {
    errors.push(`name: must match parent folder name "${folderName}"`);
  }
  if (skillData.description && skillData.description.length > 1024) {
    errors.push('description: must not exceed 1024 characters');
  }
  if (errors.length > 0) {
    return [{ file: relPath, message: errors.join('; ') }];
  }
  return [];
}

function validateAgentFile(baseDir, relPath) {
  const fullPath = path.join(baseDir, relPath);
  if (!fs.existsSync(fullPath)) {
    return [{ file: relPath, message: `Agent file not found: ${relPath}` }];
  }
  const result = parseYamlFrontmatter(fullPath);
  if (!result.valid) {
    return [{ file: relPath, message: result.errors.join('; ') }];
  }
  const agentData = result.data;
  const errors = [];
  const validAgent = validateAgentSchema(agentData);
  if (!validAgent) {
    for (const err of validateAgentSchema.errors || []) {
      errors.push(`${err.instancePath || '/'}: ${err.message}`);
    }
  }
  const folderName = path.basename(path.dirname(fullPath));
  if (agentData.name && agentData.name !== folderName) {
    errors.push(`name: must match parent folder name "${folderName}"`);
  }
  if (agentData.description && agentData.description.length > 1024) {
    errors.push('description: must not exceed 1024 characters');
  }
  if (agentData.color && !/^#[0-9a-fA-F]{6}$/.test(agentData.color)) {
    errors.push('color: must be a valid hex color (e.g., #ff0000)');
  }
  if (errors.length > 0) {
    return [{ file: relPath, message: errors.join('; ') }];
  }
  return [];
}

function validateHooksFile(baseDir, relPath) {
  const fullPath = path.join(baseDir, relPath);
  if (!fs.existsSync(fullPath)) {
    return [{ file: relPath, message: `hooks.json not found: ${relPath}` }];
  }
  const result = validateFile(fullPath, validateHooksSchema, 'hooks.json');
  if (!result.valid) {
    return [{ file: relPath, message: result.errors.join('; ') }];
  }
  const hooksData = result.data;
  const errors = [];
  const knownEvents = [
    'pre-commit', 'prepare-commit-msg', 'commit-msg', 'post-commit',
    'pre-rebase', 'post-rewrite', 'post-checkout', 'post-merge',
    'pre-push', 'pre-receive', 'update', 'post-update', 'push-to-checkout',
    'pre-auto-gc', 'post-index-change'
  ];
  for (const hook of hooksData.hooks || []) {
    if (hook.script) {
      const scriptPath = path.join(baseDir, hook.script);
      if (!fs.existsSync(scriptPath)) {
        errors.push(`Script not found: ${hook.script}`);
      }
    }
    if (hook.event && !knownEvents.includes(hook.event)) {
      errors.push(`Unknown git hook event: ${hook.event}`);
    }
    if (hook.description && hook.description.length > 512) {
      errors.push('description: must not exceed 512 characters');
    }
  }
  if (errors.length > 0) {
    return [{ file: relPath, message: errors.join('; ') }];
  }
  return [];
}

function validateMcpFile(baseDir, relPath, pluginVariables = {}) {
  const fullPath = path.join(baseDir, relPath);
  if (!fs.existsSync(fullPath)) {
    return [{ file: relPath, message: `mcp.json not found: ${relPath}` }];
  }
  const result = validateFile(fullPath, validateMcpSchema, 'mcp.json');
  if (!result.valid) {
    return [{ file: relPath, message: result.errors.join('; ') }];
  }
  const mcpData = result.data;
  const errors = [];
  if (mcpData.mcpServers) {
    for (const [serverName, serverConfig] of Object.entries(mcpData.mcpServers)) {
      if (serverConfig.args && Array.isArray(serverConfig.args)) {
        for (const arg of serverConfig.args) {
          const placeholders = arg.match(/\$\{([^}]+)\}/g);
          if (placeholders) {
            for (const placeholder of placeholders) {
              const varName = placeholder.slice(2, -1);
              if (!pluginVariables[varName]) {
                errors.push(`Undefined variable "${varName}" used in mcp.json (server: ${serverName})`);
              }
            }
          }
        }
      }
      if (serverConfig.env) {
        for (const [, envValue] of Object.entries(serverConfig.env)) {
          if (typeof envValue === 'string') {
            const placeholders = envValue.match(/\$\{([^}]+)\}/g);
            if (placeholders) {
              for (const placeholder of placeholders) {
                const varName = placeholder.slice(2, -1);
                if (!pluginVariables[varName]) {
                  errors.push(`Undefined variable "${varName}" used in mcp.json (server: ${serverName})`);
                }
              }
            }
          }
        }
      }
    }
  }
  if (errors.length > 0) {
    return [{ file: relPath, message: errors.join('; ') }];
  }
  return [];
}

function validateRuleFile(baseDir, relPath) {
  const fullPath = path.join(baseDir, relPath);
  let ruleFilePath = fullPath;
  if (fs.existsSync(fullPath) && fs.statSync(fullPath).isDirectory()) {
    ruleFilePath = path.join(fullPath, 'rule.md');
  }
  if (!fs.existsSync(ruleFilePath)) {
    return [{ file: relPath, message: `rule.md not found: ${relPath}/rule.md` }];
  }
  const result = parseYamlFrontmatter(ruleFilePath);
  if (!result.valid) {
    return [{ file: relPath, message: result.errors.join('; ') }];
  }
  const ruleData = result.data;
  const errors = [];
  const validRule = validateRuleSchema(ruleData);
  if (!validRule) {
    for (const err of validateRuleSchema.errors || []) {
      errors.push(`${err.instancePath || '/'}: ${err.message}`);
    }
  }
  const folderName = path.basename(path.dirname(ruleFilePath));
  if (ruleData.name && ruleData.name !== folderName) {
    errors.push(`name: must match parent folder name "${folderName}"`);
  }
  if (ruleData.description && ruleData.description.length > 1024) {
    errors.push('description: must not exceed 1024 characters');
  }
  if (errors.length > 0) {
    return [{ file: relPath, message: errors.join('; ') }];
  }
  return [];
}

function validateCommandFile(baseDir, relPath) {
  const fullPath = path.join(baseDir, relPath);
  let commandFilePath = fullPath;
  if (fs.existsSync(fullPath) && fs.statSync(fullPath).isDirectory()) {
    commandFilePath = path.join(fullPath, 'command.json');
  }
  if (!fs.existsSync(commandFilePath)) {
    return [{ file: relPath, message: `command.json not found: ${relPath}/command.json` }];
  }
  const result = validateFile(commandFilePath, validateCommandSchema, 'command.json');
  if (!result.valid) {
    return [{ file: relPath, message: result.errors.join('; ') }];
  }
  const commandData = result.data;
  const errors = [];
  const folderName = path.basename(path.dirname(commandFilePath));
  if (commandData.name && commandData.name !== folderName) {
    errors.push(`name: must match parent folder name "${folderName}"`);
  }
  if (commandData.description && commandData.description.length > 1024) {
    errors.push('description: must not exceed 1024 characters');
  }
  if (errors.length > 0) {
    return [{ file: relPath, message: errors.join('; ') }];
  }
  return [];
}

function validateReferencedFiles(baseDir, pluginData) {
  const errors = [];
  
  if (Array.isArray(pluginData.skills)) {
    for (const skillPath of pluginData.skills) {
      const skillErrors = validateSkillFile(baseDir, skillPath);
      for (const err of skillErrors) {
        errors.push(`Skill (${err.file}): ${err.message}`);
      }
    }
  }
  
  if (Array.isArray(pluginData.agents)) {
    for (const agentPath of pluginData.agents) {
      const agentErrors = validateAgentFile(baseDir, agentPath);
      for (const err of agentErrors) {
        errors.push(`Agent (${err.file}): ${err.message}`);
      }
    }
  }
  
  if (pluginData.hooks && typeof pluginData.hooks === 'string') {
    const hooksErrors = validateHooksFile(baseDir, pluginData.hooks);
    for (const err of hooksErrors) {
      errors.push(`Hooks (${err.file}): ${err.message}`);
    }
  }
  
  if (pluginData.mcpServers && typeof pluginData.mcpServers === 'string') {
    const mcpErrors = validateMcpFile(baseDir, pluginData.mcpServers, pluginData.variables);
    for (const err of mcpErrors) {
      errors.push(`MCP (${err.file}): ${err.message}`);
    }
  }
  
  if (Array.isArray(pluginData.rules)) {
    for (const rulePath of pluginData.rules) {
      const ruleErrors = validateRuleFile(baseDir, rulePath);
      for (const err of ruleErrors) {
        errors.push(`Rule (${err.file}): ${err.message}`);
      }
    }
  }
  
  if (Array.isArray(pluginData.commands)) {
    for (const commandPath of pluginData.commands) {
      const commandErrors = validateCommandFile(baseDir, commandPath);
      for (const err of commandErrors) {
        errors.push(`Command (${err.file}): ${err.message}`);
      }
    }
  }
  
  return errors;
}

function printSummary(results, hasErrors) {
  console.log('\n┌────────────────────────────────────────────────────────────────────┐');
  console.log('│ Validation Summary                                                 │');
  console.log('├────────────────────────────────────────────────────────────────────┤');
  
  let totalPlugins = results.length;
  let validPlugins = results.filter(r => 
    r.pluginJson.valid && r.paths.valid && r.content.valid && r.marketplaceJson.valid
  ).length;
  let invalidPlugins = totalPlugins - validPlugins;
  
  console.log(`│ Plugins validated: ${String(totalPlugins).padStart(3)}  │  Valid: ${String(validPlugins).padStart(3)}  │  Invalid: ${String(invalidPlugins).padStart(3)}  │`);
  console.log('├────────────────────────────────────────────────────────────────────┤');
  
  for (const result of results) {
    const isValid = result.pluginJson.valid && result.paths.valid && result.content.valid && result.marketplaceJson.valid;
    const status = isValid ? '✓' : '✗';
    const displayPath = result.path || '(current directory)';
    const path = displayPath.length > 50 ? '...' + displayPath.slice(-47) : displayPath;
    console.log(`│ ${status}  ${path.padEnd(58)} │`);
    
    if (!isValid) {
      if (!result.pluginJson.valid) {
        const errMsg = result.pluginJson.errors.join('; ').slice(0, 56);
        console.log(`│     plugin.json: ${errMsg.padEnd(58)} │`);
      }
      if (!result.paths.valid) {
        const errMsg = result.paths.errors.join('; ').slice(0, 56);
        console.log(`│     paths: ${errMsg.padEnd(58)} │`);
      }
      if (!result.content.valid) {
        const errMsg = result.content.errors.join('; ').slice(0, 56);
        console.log(`│     content: ${errMsg.padEnd(58)} │`);
      }
      if (!result.marketplaceJson.valid) {
        const errMsg = result.marketplaceJson.errors.join('; ').slice(0, 56);
        console.log(`│     marketplace.json: ${errMsg.padEnd(58)} │`);
      }
    }
  }
  
  console.log('├────────────────────────────────────────────────────────────────────┤');
  console.log(`│ Overall: ${hasErrors ? 'FAILED'.padEnd(60) : 'PASSED'.padEnd(60)} │`);
  console.log('└────────────────────────────────────────────────────────────────────┘');
}

function main() {
  let hasErrors = false;
  const allErrors = [];
  
  const args = process.argv.slice(2).filter(arg => !arg.startsWith('--'));
  const TARGET_DIR = args[0] ? path.resolve(args[0]) : ROOT;
  const STRICT_MODE = process.argv.includes('--strict');
  const JSON_MODE = process.argv.includes('--json');
  const SUMMARY_MODE = process.argv.includes('--summary');
  
  const pluginDirs = findPluginDirs(TARGET_DIR);
  
  if (pluginDirs.length === 0) {
    if (!JSON_MODE) {
      console.log('No plugin directories found (looking for .cursor-plugin/plugin.json)');
    } else {
      console.log(JSON.stringify({ valid: true, plugins: [], errors: [] }));
    }
    return 0;
  }
  
  if (!JSON_MODE && STRICT_MODE) {
    console.log('Running in strict mode: validating content of referenced files');
  }
  
  const results = [];
  
  for (const pluginDir of pluginDirs) {
    const cursorPluginDir = path.join(pluginDir, '.cursor-plugin');
    const pluginJsonPath = path.join(cursorPluginDir, 'plugin.json');
    const marketplaceJsonPath = path.join(cursorPluginDir, 'marketplace.json');
    
    const pluginResult = {
      path: path.relative(TARGET_DIR === ROOT ? ROOT : TARGET_DIR, pluginDir),
      pluginJson: { valid: false, errors: [] },
      paths: { valid: false, errors: [] },
      content: { valid: false, errors: [] },
      marketplaceJson: { valid: false, errors: [] }
    };
    
    if (!JSON_MODE) {
      console.log(`\nValidating plugin in: ${pluginResult.path}`);
    }
    
    if (!fs.existsSync(pluginJsonPath)) {
      const err = `Missing plugin.json at ${path.relative(TARGET_DIR === ROOT ? ROOT : TARGET_DIR, pluginJsonPath)}`;
      pluginResult.pluginJson.errors.push(err);
      hasErrors = true;
      if (!JSON_MODE) console.error(`  ✗ ${err}`);
      results.push(pluginResult);
      continue;
    }
    
    const pluginValidation = validateFile(pluginJsonPath, validatePlugin, 'plugin.json');
    if (!pluginValidation.valid) {
      hasErrors = true;
      pluginResult.pluginJson.errors = pluginValidation.errors.map(e => String(e));
      if (!JSON_MODE) {
        for (const err of pluginValidation.errors) console.error(`  ✗ ${err}`);
      }
    } else {
      pluginResult.pluginJson.valid = true;
      pluginResult.pluginJson.data = pluginValidation.data;
      if (!JSON_MODE) console.log(`  ✓ plugin.json valid`);
      
      const pathErrors = checkPathsExist(pluginDir, pluginValidation.data);
      if (pathErrors.length > 0) {
        hasErrors = true;
        pluginResult.paths.errors = pathErrors;
        if (!JSON_MODE) {
          for (const err of pathErrors) console.error(`  ✗ ${err}`);
        }
      } else {
        pluginResult.paths.valid = true;
        if (!JSON_MODE) console.log(`  ✓ All component paths exist`);
      }
      
      if (STRICT_MODE && pluginValidation.valid && pathErrors.length === 0) {
        const contentErrors = validateReferencedFiles(pluginDir, pluginValidation.data);
        if (contentErrors.length > 0) {
          hasErrors = true;
          pluginResult.content.errors = contentErrors;
          if (!JSON_MODE) {
            for (const err of contentErrors) console.error(`  ✗ ${err}`);
          }
        } else {
          pluginResult.content.valid = true;
          if (!JSON_MODE) console.log(`  ✓ All referenced files valid`);
        }
      } else {
        pluginResult.content.valid = true;
      }
      
      if (fs.existsSync(marketplaceJsonPath)) {
        const marketplaceValidation = validateFile(marketplaceJsonPath, validateMarketplace, 'marketplace.json');
        if (!marketplaceValidation.valid) {
          hasErrors = true;
          pluginResult.marketplaceJson.errors = marketplaceValidation.errors.map(e => String(e));
          if (!JSON_MODE) {
            for (const err of marketplaceValidation.errors) console.error(`  ✗ ${err}`);
          }
        } else {
          pluginResult.marketplaceJson.valid = true;
          pluginResult.marketplaceJson.data = marketplaceValidation.data;
          if (!JSON_MODE) console.log(`  ✓ marketplace.json valid`);
          
          if (marketplaceValidation.data.name !== pluginValidation.data.name) {
            hasErrors = true;
            const err = `marketplace.json name "${marketplaceValidation.data.name}" does not match plugin.json name "${pluginValidation.data.name}"`;
            pluginResult.marketplaceJson.errors.push(err);
            if (!JSON_MODE) console.error(`  ✗ ${err}`);
          }
        }
      } else {
        if (!JSON_MODE) console.log(`  ⚠ marketplace.json not found (optional)`);
        pluginResult.marketplaceJson.valid = true;
      }
    }
    results.push(pluginResult);
  }
  
  if (SUMMARY_MODE && !JSON_MODE) {
    printSummary(results, hasErrors);
  }
  
  if (JSON_MODE) {
    console.log(JSON.stringify({ valid: !hasErrors, plugins: results, errors: allErrors }, null, 2));
  } else if (hasErrors && !SUMMARY_MODE) {
    console.error('\n✗ Validation failed with errors above');
  } else if (!hasErrors && !SUMMARY_MODE) {
    console.log('\n✓ All validations passed');
  }
  
  return hasErrors ? 1 : 0;
}

process.exit(main());
