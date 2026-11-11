# Changelog

## 1.1.0 — work-in-progress checkpoint

Partial code published for continued development. Known issues: STATUS.md.

## 1.2.0 - 2026-11-11

### Added
- Diff renderer fix for PR Review Canvas (addresses issue #472)
  - Line numbers computed from raw diff hunk headers BEFORE filtering
  - Import filtering made opt-in with visible collapsed rows
  - Whitespace-only collapsing limited to trim-only comparison (preserves internal whitespace)
- Comprehensive test suite for diff renderer (18 tests)

### Fixed
- Import lines were silently dropped before line numbering, causing incorrect line numbers
- Whitespace-only detection used `replace(/\s/g, '')` which stripped internal whitespace

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

---

Alan Vo · [alanvo.net](https://alanvo.net) · [X: @alanvoasi](https://x.com/alanvoasi)
