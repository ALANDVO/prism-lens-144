import { describe, it } from 'node:test';
import assert from 'node:assert';
import { parseDiff, renderDiff, isImportLine, isWhitespaceOnlyChange } from '../cursor-team-kit/skills/pr-review-canvas/renderer.js';

describe('parseDiff', () => {
  it('parses a simple diff with correct line numbers', () => {
    const diff = `@@ -1,3 +1,3 @@
 import a from 'a'
-import b from 'b'
+import c from 'c'
 const x = 1`;

    const parsed = parseDiff(diff);

    assert.strictEqual(parsed.hunks.length, 1);
    const hunk = parsed.hunks[0];

    assert.strictEqual(hunk.oldStart, 1);
    assert.strictEqual(hunk.newStart, 1);

    const lines = hunk.lines;
    assert.strictEqual(lines.length, 4);

    assert.strictEqual(lines[0].type, 'context');
    assert.strictEqual(lines[0].content, "import a from 'a'");
    assert.strictEqual(lines[0].oldLineNum, 1);
    assert.strictEqual(lines[0].newLineNum, 1);

    assert.strictEqual(lines[1].type, 'delete');
    assert.strictEqual(lines[1].content, "import b from 'b'");
    assert.strictEqual(lines[1].oldLineNum, 2);
    assert.strictEqual(lines[1].newLineNum, null);

    assert.strictEqual(lines[2].type, 'add');
    assert.strictEqual(lines[2].content, "import c from 'c'");
    assert.strictEqual(lines[2].oldLineNum, null);
    assert.strictEqual(lines[2].newLineNum, 2);

    assert.strictEqual(lines[3].type, 'context');
    assert.strictEqual(lines[3].content, 'const x = 1');
    assert.strictEqual(lines[3].oldLineNum, 3);
    assert.strictEqual(lines[3].newLineNum, 3);
  });

  it('parses multi-hunk diff', () => {
    const diff = `@@ -1,2 +1,2 @@
-foo
+bar
@@ -10,2 +10,2 @@
-baz
+qux`;

    const parsed = parseDiff(diff);

    assert.strictEqual(parsed.hunks.length, 2);
    assert.strictEqual(parsed.hunks[0].oldStart, 1);
    assert.strictEqual(parsed.hunks[1].oldStart, 10);
  });

  it('handles lines without leading space (context)', () => {
    const diff = `@@ -1,2 +1,2 @@
 const a = 1
 const b = 2`;

    const parsed = parseDiff(diff);
    const hunk = parsed.hunks[0];

    assert.strictEqual(hunk.lines.length, 2);
    assert.strictEqual(hunk.lines[0].type, 'context');
    assert.strictEqual(hunk.lines[0].oldLineNum, 1);
    assert.strictEqual(hunk.lines[0].newLineNum, 1);
  });
});

describe('isImportLine', () => {
  it('detects standard import statements', () => {
    assert.ok(isImportLine("import a from 'a'"));
    assert.ok(isImportLine("import { foo } from 'bar'"));
    assert.ok(isImportLine("import './polyfill'"));
  });

  it('detects import without space', () => {
    assert.ok(isImportLine("import{ foo } from 'bar'"));
  });

  it('detects } from pattern', () => {
    assert.ok(isImportLine("} from 'module'"));
  });

  it('does not match non-import lines', () => {
    assert.ok(!isImportLine("const x = 1"));
    assert.ok(!isImportLine("export default foo"));
    assert.ok(!isImportLine("require('foo')"));
  });
});

describe('isWhitespaceOnlyChange', () => {
  it('detects whitespace-only changes', () => {
    // Only leading/trailing whitespace differences should be detected
    assert.ok(isWhitespaceOnlyChange('  return "a b"  ', '  return "a b"'));
    assert.ok(isWhitespaceOnlyChange('\tconst x = 1', '  const x = 1'));
    // Identical lines after trim are considered whitespace-only changes
    assert.ok(isWhitespaceOnlyChange('a b', 'a b'));
  });

  it('does not match non-whitespace changes', () => {
    // Internal whitespace changes should NOT be considered whitespace-only
    assert.ok(!isWhitespaceOnlyChange('  return "a b"', '  return "ab"'));
    assert.ok(!isWhitespaceOnlyChange('const x = 1', 'const y = 1'));
    assert.ok(!isWhitespaceOnlyChange('foo', 'bar'));
  });

  it('returns true for identical lines (considered whitespace-only for collapsing)', () => {
    assert.ok(isWhitespaceOnlyChange('const x = 1', 'const x = 1'));
  });
});

describe('renderDiff', () => {
  it('renders diff with line numbers from hunk headers', () => {
    const diff = `@@ -1,3 +1,3 @@
 import a from 'a'
-import b from 'b'
+import c from 'c'
 const x = 1`;

    const parsed = parseDiff(diff);
    const html = renderDiff(parsed);

    // Line numbers from hunk headers preserved on visible lines
    // Imports filtered out by default, so only line 3 (const x = 1) is visible
    assert.match(html, /diff-old-num[^>]*>3</);
    assert.match(html, /diff-new-num[^>]*>3</);
    assert.ok(html.includes('const x = 1'));
  });

  it('renders diff with correct line numbers when showImports is true', () => {
    const diff = `@@ -1,3 +1,3 @@
 import a from 'a'
-import b from 'b'
+import c from 'c'
 const x = 1`;

    const parsed = parseDiff(diff);
    const html = renderDiff(parsed, { showImports: true });

    // All lines visible with correct line numbers from hunk headers
    assert.match(html, /diff-old-num[^>]*>1</);
    assert.match(html, /diff-new-num[^>]*>1</);
    assert.match(html, /diff-old-num[^>]*>2</);
    assert.match(html, /diff-new-num[^>]*>2</);
    assert.match(html, /diff-old-num[^>]*>3</);
    assert.match(html, /diff-new-num[^>]*>3</);
  });

  it('hides import lines by default', () => {
    const diff = `@@ -1,3 +1,3 @@
 import a from 'a'
-import b from 'b'
+import c from 'c'
 const x = 1`;

    const parsed = parseDiff(diff);
    const html = renderDiff(parsed);

    assert.ok(!html.includes("import b from 'b'"));
    assert.ok(!html.includes("import c from 'c'"));
    assert.ok(html.includes('const x = 1'));
  });

  it('shows import lines when showImports is true', () => {
    const diff = `@@ -1,3 +1,3 @@
 import a from 'a'
-import b from 'b'
+import c from 'c'
 const x = 1`;

    const parsed = parseDiff(diff);
    const html = renderDiff(parsed, { showImports: true });

    // HTML escapes single quotes to &#39;
    assert.match(html, /import b from &#39;b&#39;/);
    assert.match(html, /import c from &#39;c&#39;/);
  });

  it('shows collapsed import row when collapseImports is true', () => {
    const diff = `@@ -1,3 +1,3 @@
 import a from 'a'
-import b from 'b'
+import c from 'c'
 const x = 1`;

    const parsed = parseDiff(diff);
    const html = renderDiff(parsed, { collapseImports: true });

    assert.match(html, /diff-collapsed-imports/);
    assert.match(html, /import line/);
    assert.match(html, /hidden/);
  });

  it('collapses whitespace-only changes when collapseWhitespace is true', () => {
    const diff = `@@ -1,2 +1,2 @@
-  return "a b"
+  return "a b"
 const x = 1`;

    const parsed = parseDiff(diff);
    const html = renderDiff(parsed, { collapseWhitespace: true });

    assert.match(html, /diff-collapsed-whitespace/);
    assert.match(html, /whitespace-only change/);
  });

  it('does not collapse non-whitespace changes', () => {
    const diff = `@@ -1,2 +1,2 @@
-  return "a b"
+  return "a c"
 const x = 1`;

    const parsed = parseDiff(diff);
    const html = renderDiff(parsed, { collapseWhitespace: true });

    assert.ok(!html.includes('diff-collapsed-whitespace'));
    assert.match(html, /return &quot;a b&quot;/);
    assert.match(html, /return &quot;a c&quot;/);
  });

  it('escapes HTML in output', () => {
    const diff = `@@ -1,1 +1,1 @@
-<script>alert(1)</script>
+&lt;script&gt;alert(1)&lt;/script&gt;`;

    const parsed = parseDiff(diff);
    const html = renderDiff(parsed);

    assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
    assert.ok(!html.includes('<script>'));
  });
});
