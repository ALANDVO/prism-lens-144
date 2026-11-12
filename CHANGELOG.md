# Changelog

## 1.2.0 — work-in-progress checkpoint

Partial code published for continued development. Known issues: STATUS.md.

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- JSON output mode for Plugin Validator (`scripts/validate-plugins.mjs`)
  - Added `--json` flag for structured JSON output
  - Compatible with `--strict` mode (`--strict --json`)
  - Outputs validation results as structured JSON for CI/CD integration
  - Includes plugin paths, validation status, and detailed errors per component
  - Updated README with usage documentation
- Symlink support for plugin discovery (addresses Cursor plugins issue #35)
  - Updated `findPluginDirs` to follow symlinks to directories
  - Symlinked plugin directories are discovered and validated
  - Broken symlinks are ignored gracefully
  - Added unit test for symlink plugin discovery
- Strict mode and JSON output for individual validators (`validate-skills.mjs`, `validate-agents.mjs`, `validate-hooks.mjs`, `validate-mcp.mjs`)
  - Added `--strict` flag to validate against JSON schemas
  - Added `--json` flag for structured JSON output
  - Compatible with combining `--strict --json` for CI/CD integration
  - Updated README with usage documentation for individual validators
  - **Added comprehensive test coverage for `--strict` and `--json` flags on all individual validators**
    - Skill Validator: 4 new tests (strict mode schema validation, json output, strict+json combined, json error output)
    - Agent Validator: 3 new tests (json output, strict+json combined, json error output)
    - Hooks Validator: 3 new tests (json output, strict+json combined, json error output)
    - MCP Validator: 3 new tests (json output, strict+json combined, json error output)

### Fixed
- Fixed hooks validation in Plugin Validator strict mode
  - `validateHooksFile` now correctly iterates over `hooksData.hooks` array (per schema)
  - Previously attempted to iterate over the root object, causing TypeError
- Fixed strict mode validation tests in Plugin Validator
  - Added missing `runValidatorWithFlags` helper function in test suite
  - Fixed test fixture structure for agents and rules (subdirectories matching name)
  - Added missing icon.png creation in valid plugin test fixture
  - Corrected test assertion for strict mode output message
- Fixed summary mode to be mutually exclusive with JSON mode
- All ~67 unit tests now pass (Plugin: 20, Skill: 11, Agent: 14, MCP: 12, Hooks: 10)
### Changed
- Removed reference to non-existent manual test fixtures (tests create fixtures dynamically)
- Updated Plugin Validator strict mode to include command.json validation

## [0.1.0] - 2026-10-28

### Added
- Plugin manifest validator (`scripts/validate-plugins.mjs`)
  - Validates plugin.json and marketplace.json against JSON schemas
  - Checks path existence for component fields (skills, agents, hooks, mcpServers, icon, commands, rules)
  - CLI tool with non-zero exit on failure
- Skill validator (`scripts/validate-skills.mjs`)
  - Parses YAML frontmatter from SKILL.md files
  - Validates required fields: name, description
  - Validates name format (lowercase, hyphens only, matches folder name)
  - Validates description length (<= 1024 chars)
  - Parse error reporting with file context
- Agent validator (`scripts/validate-agents.mjs`)
  - Parses YAML frontmatter from agents/*.md files
  - Validates required fields: name, description
  - Validates name format (lowercase, hyphens only, matches folder name)
  - Validates description length (<= 1024 chars)
  - Validates optional fields: paths, disable-model-invocation, icon, color, metadata
  - Parse error reporting with file context
- MCP validator (`scripts/validate-mcp.mjs`)
  - Validates mcp.json structure against schema (mcpServers, command, args, env, cwd)
  - Validates ${VAR} placeholders in mcp.json are declared in plugin.json variables
  - Finds mcp.json files in nested directories
  - Parse error reporting with file context
- Hooks validator (`scripts/validate-hooks.mjs`)
  - Validates hooks.json against schema
  - Checks script paths exist
  - Validates required fields: event, script
  - Validates event name against known Git hook events
  - Validates optional description field (max 512 chars)
  - Parse error reporting with file context
- JSON schemas for all configuration types:
  - `schemas/plugin.schema.json`
  - `schemas/marketplace.schema.json`
  - `schemas/skill.schema.json`
  - `schemas/agent.schema.json`
  - `schemas/hooks.schema.json`
  - `schemas/mcp.schema.json`
- CI workflow (`.github/workflows/validate-plugins.yml`)
  - Triggers on all plugin-related file changes
  - Uses `npm ci` for reproducible dependency installation
  - Runs all validators and unit tests
  - Conditionally runs additional test suites (bun test, tsc) for packages that have them
- Unit tests for all validators (40 tests total)
  - Plugin Validator: 6 tests
  - Skill Validator: 7 tests
  - Agent Validator: 11 tests
  - MCP Validator: 9 tests
  - Hooks Validator: 7 tests
- Project dependencies pinned in `package-lock.json`

---

Alan Vo · [alanvo.net](https://alanvo.net) · [X: @alanvoasi](https://x.com/alanvoasi)
