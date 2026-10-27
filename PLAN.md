# Product development plan

Each round completes one feature or repair. Future items are planned, not implemented claims.

## Current round

diff-renderer-fix

## Roadmap

### plugin-manifest-core — Plugin Manifest Core (plugin.json schema + validation)

Status: done

Acceptance:
- JSON schema for plugin.json validates required fields (name, version, displayName, description, skills, agents, mcpServers, hooks, commands, logo)
- Validator script checks plugin.json against schema
- Name pattern enforced: ^[a-z0-9]([a-z0-9.-]*[a-z0-9])?$

Implementation: `schemas/plugin.schema.json`, `scripts/validate-plugin.mjs`

Tests: `tests/validate-plugin.test.mjs`

### skill-frontmatter — Skill Frontmatter Parsing & Validation

Status: done

Acceptance:
- SKILL.md frontmatter parsed (YAML)
- Required fields: name (lowercase/hyphen), description
- Name must match parent folder name
- Optional: paths, disable-model-invocation, icon, color, metadata, displayName

Implementation: `schemas/skill.schema.json`, `scripts/validate-skill.mjs`

Tests: `tests/validate-skill.test.mjs`

### local-plugin-symlink — Local Plugin Symlink Support

Status: done

Acceptance:
- Plugins in ~/.cursor/plugins/local/ load via symlinks
- Realpath resolution for plugin discovery
- Broken symlinks handled gracefully with error reporting
- Symlink status tracked in plugin metadata

Implementation: `scripts/load-plugins.mjs`, `scripts/validate-plugin.mjs (updated to work with discovered plugins)`

Tests: `tests/load-plugins.test.mjs`

### diff-renderer-fix — PR Review Canvas Diff Renderer Fix

Status: done

Acceptance:
- Line numbers computed from raw diff hunk headers before filtering
- Import filtering opt-in with visible collapsed rows
- Whitespace-only collapsing limited to trim-only comparison

Implementation: `cursor-team-kit/skills/pr-review-canvas/renderer.js`

Tests: `tests/renderer.test.mjs`

### oauth-auth-flow — OAuth Authentication Flow for Connectors

Status: planned

Acceptance:
- GitHub plugin provides sign-in link on Authenticate button
- Gmail plugin includes gmail.settings.basic scope
- Todoist/X plugins authenticate correctly

Implementation: `connectors/github/oauth.js`, `connectors/gmail/oauth.js`, `connectors/todoist/oauth.js`

Tests: `tests/oauth.test.mjs`

### ci-validation-extended — Extended CI Validation

Status: planned

Acceptance:
- CI triggers on all plugin files (SKILL.md, hooks.json, mcp.json, agents)
- Root package.json with pinned dependencies
- Validator checks path existence, frontmatter parse, mcp.json placeholders
- Script test suites run in CI (bun test, tsc)

Implementation: `.github/workflows/validate-plugins.yml`, `package.json`, `package-lock.json`, `scripts/validate-plugins.mjs`

Tests: `tests/ci-validation.test.mjs`

