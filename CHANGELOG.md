# Changelog

## 1.0.0 — work-in-progress checkpoint

Partial code published for continued development. Known issues: STATUS.md.

## 1.0.0 — work-in-progress checkpoint

Partial code published for continued development. Known issues: STATUS.md.

# Changelog

## 1.0.0 - 2026-10-26

### Added
- Plugin manifest JSON schema
- Plugin validation script
- Test suite for validator
- Test plugin fixture
- Package configuration
- README, PLAN, STATUS

### Technical
- AJV + AJV-formats for schema validation
- ES modules for modern Node.js
- Non-zero exit codes for CI

## 1.1.0 - 2026-10-26

### Added
- Skill frontmatter JSON schema (addresses issue #237)
- Skill validation script with YAML frontmatter parsing
- Name/folder matching enforcement for skills
- `displayName` field for human-readable skill labels
- Description length validation (max 1024 chars)
- Test suite for skill validator (7 tests)

### Added
- Local plugin discovery with symlink support (addresses issue #35)
- `scripts/load-plugins.mjs` for plugin discovery in `~/.cursor/plugins/local/` and `~/.cursor/plugins/marketplace/`
- Symlink resolution via `fs.realpathSync()` with `isSymbolicLink()` tracking
- Broken symlink handling with error reporting
- Plugin metadata includes `isSymlink`, `originalPath`, `realPath`
- Test suite for plugin loading (12 tests)

### Technical
- js-yaml for YAML frontmatter parsing
- Comprehensive test coverage (23 tests total)
