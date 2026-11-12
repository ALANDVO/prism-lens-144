# Prism Lens - Cursor Plugin Validator

> Work in progress. This checkpoint may be incomplete or fail tests. See PLAN.md and STATUS.md before use.


Validator for Cursor plugin manifests and marketplace entries. Checks JSON schemas and verifies that referenced component paths exist.

## Installation

```bash
npm install
```

## Usage

Validate all plugins in the repository:
```bash
npm run validate
# or
node scripts/validate-plugins.mjs
## Symlink Support

The validator automatically follows symlinks to directories when discovering plugins, enabling local development workflows where plugins are symlinked into the repository (addresses [Cursor plugins issue #35](https://github.com/cursor/plugins/issues/35)). Broken symlinks are ignored gracefully.

```bash
ln -s /path/to/my-plugin ./my-plugin
node scripts/validate-plugins.mjs --strict .
```

Validate a specific plugin directory:
```bash
node scripts/validate-plugins.mjs path/to/plugin
```

Strict mode (also validates content of referenced skill, agent, hooks, MCP, and rules files):
```bash
node scripts/validate-plugins.mjs --strict path/to/plugin
```

JSON output mode (for CI/CD integration):
```bash
node scripts/validate-plugins.mjs --json [path/to/plugin]
Combine strict mode with JSON output:
```bash
node scripts/validate-plugins.mjs --strict --json path/to/plugin
```

Summary mode (concise validation overview):
```bash
node scripts/validate-plugins.mjs --summary [path/to/plugin]
```

Combine with strict mode:
```bash
node scripts/validate-plugins.mjs --strict --summary path/to/plugin
```

Run individual validators:
```bash
# Validate skills (SKILL.md files)
node scripts/validate-skills.mjs [path]
node scripts/validate-skills.mjs --strict [path]  # Validate against JSON schema
node scripts/validate-skills.mjs --json [path]    # JSON output for CI/CD

# Validate agents (agents/*.md files)
node scripts/validate-agents.mjs [path]
node scripts/validate-agents.mjs --strict [path]  # Validate against JSON schema
node scripts/validate-agents.mjs --json [path]    # JSON output for CI/CD

# Validate hooks (hooks.json files)
node scripts/validate-hooks.mjs [path]
node scripts/validate-hooks.mjs --strict [path]  # Validate against JSON schema
node scripts/validate-hooks.mjs --json [path]    # JSON output for CI/CD

# Validate MCP configurations (mcp.json files)
node scripts/validate-mcp.mjs [path]
node scripts/validate-mcp.mjs --strict [path]  # Validate against JSON schema and placeholders
node scripts/validate-mcp.mjs --json [path]    # JSON output for CI/CD
```

Run tests:
```bash
npm test
```

## Validation Rules

### plugin.json
- Required fields: `name`, `version`, `description`, `author`
- `name`: lowercase letters, numbers, hyphens, dots only
- `version`: semantic version (x.y.z)
- `description`: max 1024 characters
- Component paths must exist: `skills`, `agents`, `commands`, `rules`, `hooks`, `mcpServers`, `icon`

### marketplace.json
- Required fields: `name`, `publisher`, `version`, `description`, `repository`
- `name`: must match plugin.json name
- `repository`: valid URI
- `version`: semantic version

### SKILL.md (Skill Frontmatter)
- Required fields: `name`, `description`
- `name`: lowercase letters, numbers, hyphens only; must match parent folder name
- `description`: max 1024 characters
- Optional: `paths`, `disable-model-invocation`, `icon`, `color`, `metadata`

### Agent Frontmatter (agents/*.md)
- Required fields: `name`, `description`
- `name`: lowercase letters, numbers, hyphens only; must match parent folder name
- `description`: max 1024 characters
- Optional: `paths`, `disable-model-invocation`, `icon`, `color`, `metadata`

### hooks.json
- Required fields: `event`, `script`
- `event`: valid Git hook event name (pre-commit, commit-msg, etc.)
- `script`: path to executable script (must exist)
- Optional: `description` (max 512 characters)

### mcp.json
- Required: `mcpServers` object with server configurations
- Each server: `command` (required), `args` (required array), optional `env`, `cwd`
- `${VAR}` placeholders must be declared in plugin.json `variables` field

## Project Structure

```
├── schemas/
│   ├── plugin.schema.json       # plugin.json schema
│   ├── marketplace.schema.json  # marketplace.json schema
│   ├── skill.schema.json        # SKILL.md frontmatter schema
│   ├── agent.schema.json        # Agent frontmatter schema
│   ├── hooks.schema.json        # hooks.json schema
│   ├── mcp.schema.json          # mcp.json schema
│   └── rule.schema.json         # rule frontmatter schema
├── scripts/
│   ├── validate-plugins.mjs     # Main plugin validator CLI
│   ├── validate-skills.mjs      # Skill validator CLI
│   ├── validate-agents.mjs      # Agent validator CLI
│   ├── validate-hooks.mjs       # Hooks validator CLI
│   └── validate-mcp.mjs         # MCP validator CLI
├── tests/
│   ├── validate-plugins.test.mjs
│   ├── validate-skills.test.mjs
│   ├── validate-agents.test.mjs
│   ├── validate-hooks.test.mjs
│   └── validate-mcp.test.mjs
├── package.json
├── package-lock.json
├── PLAN.md
└── STATUS.md
```

## Testing

Tests create temporary fixtures dynamically and clean them up after running. Run the test suite:

```bash
npm test
```

## Example Plugin Structure

```
my-plugin/
├── .cursor-plugin/
│   ├── plugin.json
│   └── marketplace.json
├── skills/
│   └── my-skill/
│       └── SKILL.md
├── agents/
│   └── my-agent/
│       └── agent.md
├── hooks.json
├── mcp.json
├── icon.png
└── ...
```

## License

MIT

---

Alan Vo · [alanvo.net](https://alanvo.net) · [X: @alanvoasi](https://x.com/alanvoasi)

Maintainer: Alan Vo <alanvo@gmail.com>
