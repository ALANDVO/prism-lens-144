# Product development plan

Each round completes one feature or repair. Future items are planned, not implemented claims.

## Current round

individual-validator-enhancements

## Roadmap

### plugin-validator-core — Plugin manifest validator with JSON schema

Status: done

Acceptance:
- Validates plugin.json against schema
- Validates marketplace.json against schema
- Reports path existence for component fields (skills, agents, hooks, mcpServers, logo/icon, commands, rules)
- CLI tool exits non-zero on validation failure

Implementation: `schemas/plugin.schema.json`, `schemas/marketplace.schema.json`, `scripts/validate-plugins.mjs`, `package.json`

Tests: `tests/validate-plugins.test.mjs`

### skill-validator — SKILL.md frontmatter validator

Status: done

Acceptance:
- Parses YAML frontmatter from SKILL.md files
- Validates required fields: name, description
- Validates name format (lowercase, hyphens only, matches folder name)
- Validates description length (<= 1024 chars)
- Reports parse errors with file context
- CLI tool exits non-zero on validation failure

Implementation: `schemas/skill.schema.json`, `scripts/validate-skills.mjs`

Tests: `tests/validate-skills.test.mjs`

### ci-workflow — CI workflow for plugin validation

Status: done

Acceptance:
- Triggers on all plugin-related file changes (.cursor-plugin/**, **/plugin.json, **/marketplace.json, **/SKILL.md, **/hooks.json, **/mcp.json, **/agents/**/*.md, schemas/**, scripts/**, package.json, package-lock.json)
- Uses `npm ci` for reproducible dependency installation
- Runs plugin manifest validator (`npm run validate`)
- Runs skill validator (`npm run validate:skills`)
- Runs agent validator (`npm run validate:agents`)
- Runs hooks validator (`npm run validate:hooks`)
- Runs MCP validator (`npm run validate:mcp`)
- Runs unit tests (`npm test`)
- Conditionally runs additional test suites (bun test, tsc) for packages that have them

Implementation: `.github/workflows/validate-plugins.yml`, `package-lock.json`

### agent-validator — Agent frontmatter validator

Status: done

Acceptance:
- Parses YAML frontmatter from agents/*.md files
- Validates required fields: name, description
- Validates name format (lowercase, hyphens only, matches folder name)
- Validates description length (<= 1024 chars)
- Validates optional fields: paths, disable-model-invocation, icon, color, metadata
- Reports parse errors with file context
- CLI tool exits non-zero on validation failure

Implementation: `schemas/agent.schema.json`, `scripts/validate-agents.mjs`

Tests: `tests/validate-agents.test.mjs`

### mcp-validator — MCP configuration validator

Status: done

Acceptance:
- Validates mcp.json structure against schema (mcpServers, command, args, env, cwd)
- Validates ${VAR} placeholders in mcp.json are declared in plugin.json variables
- Finds mcp.json files in nested directories
- Reports parse errors with file context
- CLI tool exits non-zero on validation failure

Implementation: `schemas/mcp.schema.json`, `scripts/validate-mcp.mjs`

Tests: `tests/validate-mcp.test.mjs`

### hooks-validator — Hooks configuration validator

Status: done

Acceptance:
- Validates hooks.json against schema
- Checks script paths exist
- Validates required fields: event, script
- Validates event name against known Git hook events
- Validates optional description field (max 512 chars)
- Reports parse errors with file context
- CLI tool exits non-zero on validation failure

Implementation: `schemas/hooks.schema.json`, `scripts/validate-hooks.mjs`

Tests: `tests/validate-hooks.test.mjs`

### rules-validator — Rules frontmatter validator

Status: done

Acceptance:
- Validates rules frontmatter (name, description)
- Validates name format (lowercase, hyphens only, matches folder name)
- Validates description length (<= 1024 chars)
- Reports parse errors with file context
- Integrated into strict mode validation

Implementation: `schemas/rule.schema.json`, `scripts/validate-plugins.mjs (validateRuleFile, validateReferencedFiles)`

Tests: `tests/validate-plugins.test.mjs (5 strict mode tests for rules validation)`

### command-validator — Command configuration validator

Status: done

Acceptance:
- Validates command.json against schema (name, displayName, description, icon, arguments)
- Validates required fields: name, description
- Validates name format (lowercase, hyphens only, matches folder name)
- Validates description length (<= 1024 chars)
- Validates optional fields: displayName, icon, arguments (object schema)
- Reports parse errors with file context
- Integrated into strict mode validation
- Non-strict mode preserves path-only checking (backward compatible)

Implementation: `schemas/command.schema.json`, `scripts/validate-plugins.mjs (validateCommandFile, validateReferencedFiles)`

Tests: `tests/validate-plugins.test.mjs (8 strict mode tests for command validation)`

### strict-mode — Strict mode for integrated plugin validation

Status: done

Acceptance:
- Added --strict flag to validate-plugins.mjs
- Validates SKILL.md frontmatter content when strict mode enabled
- Validates agent frontmatter content when strict mode enabled
- Validates hooks.json content and script paths when strict mode enabled
- Validates mcp.json content and variable placeholders when strict mode enabled
- Validates rules frontmatter content when strict mode enabled
- Validates command.json content when strict mode enabled
- Non-strict mode preserves original behavior (path existence only)
- Backward compatible with existing workflows

Implementation: `scripts/validate-plugins.mjs (STRICT_MODE flag, validateReferencedFiles function)`

Tests: `tests/validate-plugins.test.mjs (13 strict mode tests total: 5 rules + 8 commands, plus existing non-strict tests)`

### json-output-mode — JSON output mode for CI/CD integration

Status: done

Acceptance:
- Added --json flag to validate-plugins.mjs
- Outputs structured JSON with plugin paths, validation status, and detailed errors per component
- Compatible with --strict mode (--strict --json)
- Updated README with usage documentation
- Backward compatible - default behavior unchanged

Implementation: `scripts/validate-plugins.mjs (JSON_MODE flag, structured output in main function)`

Tests: `tests/validate-plugins.test.mjs (existing tests cover CLI behavior)`

### symlink-support — Symlink support for plugin discovery

Status: done

Acceptance:
- findPluginDirs follows symlinks to directories
- Symlinked plugin directories are discovered and validated
- Broken symlinks are ignored gracefully
- Unit test validates symlink plugin discovery

Implementation: `scripts/validate-plugins.mjs (findPluginDirs function updated to handle symlinks)`

Tests: `tests/validate-plugins.test.mjs (symlink discovery test)`

### individual-validator-enhancements — Strict mode and JSON output for individual validators

Status: done

Acceptance:
- Added --strict flag to validate-skills.mjs, validate-agents.mjs, validate-hooks.mjs, validate-mcp.mjs
- Added --json flag to validate-skills.mjs, validate-agents.mjs, validate-hooks.mjs, validate-mcp.mjs
- Strict mode validates content against JSON schemas
- JSON output provides structured results for CI/CD integration
- Compatible with combining --strict --json flags
- Updated README with usage documentation for individual validators
- All existing tests pass

Implementation: `scripts/validate-skills.mjs`, `scripts/validate-agents.mjs`, `scripts/validate-hooks.mjs`, `scripts/validate-mcp.mjs`

Tests: `tests/validate-skills.test.mjs`, `tests/validate-agents.test.mjs`, `tests/validate-hooks.test.mjs`, `tests/validate-mcp.test.mjs`

---

Alan Vo · [alanvo.net](https://alanvo.net) · [X: @alanvoasi](https://x.com/alanvoasi)
