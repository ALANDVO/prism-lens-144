/**
 * PR Review Canvas Diff Renderer
 * Fixed version addressing issue #472:
 * - Line numbers computed from raw diff hunk headers BEFORE filtering
 * - Import filtering is opt-in with visible collapsed rows
 * - Whitespace-only collapsing limited to trim-only comparison
 */

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function isImportLine(line) {
  const trimmed = line.trim();
  return (
    trimmed.startsWith('import ') ||
    trimmed.startsWith('import{') ||
    trimmed.startsWith('} from ')
  );
}

function isWhitespaceOnlyChange(oldLine, newLine) {
  // Only trim leading/trailing whitespace, preserve internal whitespace
  const oldTrimmed = oldLine.trimStart().trimEnd();
  const newTrimmed = newLine.trimStart().trimEnd();
  return oldTrimmed === newTrimmed;
}

function parseDiff(diffText) {
  const lines = diffText.split('\n');
  const hunks = [];
  let currentHunk = null;
  let oldLineNum = 0;
  let newLineNum = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.startsWith('@@')) {
      if (currentHunk) {
        hunks.push(currentHunk);
      }

      const headerMatch = line.match(/@@\s+-(\d+),?(\d*)\s+\+(\d+),?(\d*)\s+@@/);
      if (!headerMatch) {
        continue;
      }

      oldLineNum = parseInt(headerMatch[1], 10);
      newLineNum = parseInt(headerMatch[3], 10);

      currentHunk = {
        header: line,
        oldStart: oldLineNum,
        newStart: newLineNum,
        lines: [],
        oldLineCount: headerMatch[2] ? parseInt(headerMatch[2], 10) : 1,
        newLineCount: headerMatch[4] ? parseInt(headerMatch[4], 10) : 1,
      };
      continue;
    }

    if (!currentHunk) {
      continue;
    }

    let type = 'context';
    let content = line;

    if (line.startsWith('-')) {
      type = 'delete';
      content = line.slice(1);
    } else if (line.startsWith('+')) {
      type = 'add';
      content = line.slice(1);
    } else if (line.startsWith(' ')) {
      type = 'context';
      content = line.slice(1);
    } else if (line.startsWith('\\')) {
      type = 'noop';
      content = line;
    } else {
      type = 'context';
      content = line;
    }

    const lineData = {
      type,
      content,
      oldLineNum: type === 'delete' || type === 'context' ? oldLineNum : null,
      newLineNum: type === 'add' || type === 'context' ? newLineNum : null,
      raw: line,
    };

    currentHunk.lines.push(lineData);

    if (type === 'delete') {
      oldLineNum++;
    } else if (type === 'add') {
      newLineNum++;
    } else if (type === 'context') {
      oldLineNum++;
      newLineNum++;
    }
  }

  if (currentHunk) {
    hunks.push(currentHunk);
  }

  return { hunks };
}

function renderDiff(parsedDiff, options = {}) {
  const {
    showImports = false,
    collapseImports = false,
    collapseWhitespace = false,
  } = options;

  let html = '<div class="diff-container">';

  for (const hunk of parsedDiff.hunks) {
    html += '<div class="diff-hunk">';
    html += `<div class="diff-hunk-header">${escapeHtml(hunk.header)}</div>`;
    html += '<table class="diff-table"><tbody>';

    let importHiddenCount = 0;
    let whitespaceCollapsedCount = 0;

    for (let i = 0; i < hunk.lines.length; i++) {
      const line = hunk.lines[i];

      if (line.type === 'noop') {
        continue;
      }

      const isImport = isImportLine(line.content);

      if (isImport && !showImports) {
        importHiddenCount++;
        if (collapseImports && importHiddenCount === 1) {
          html += '<tr class="diff-collapsed-imports"><td colspan="4">';
          html += '<button class="diff-expand-imports" data-count="0">Show hidden imports</button>';
          html += '</td></tr>';
        }
        continue;
      }

      const prevLine = hunk.lines[i - 1];
      const nextLine = hunk.lines[i + 1];

      const isWsCollapse =
        collapseWhitespace &&
        line.type === 'delete' &&
        nextLine &&
        nextLine.type === 'add' &&
        isWhitespaceOnlyChange(line.content, nextLine.content);

      if (isWsCollapse) {
        whitespaceCollapsedCount++;
        html += '<tr class="diff-collapsed-whitespace"><td colspan="4">';
        html += `<span class="diff-whitespace-notice">${whitespaceCollapsedCount} whitespace-only change${whitespaceCollapsedCount > 1 ? 's' : ''} collapsed</span>`;
        html += '</td></tr>';
        i++; // Skip the add line
        continue;
      }

      const oldLineDisplay = line.oldLineNum !== null ? String(line.oldLineNum) : '';
      const newLineDisplay = line.newLineNum !== null ? String(line.newLineNum) : '';

      let rowClass = 'diff-line';
      if (line.type === 'delete') rowClass += ' diff-delete';
      else if (line.type === 'add') rowClass += ' diff-add';
      else rowClass += ' diff-context';

      html += `<tr class="${rowClass}">`;
      html += `<td class="diff-line-num diff-old-num">${escapeHtml(oldLineDisplay)}</td>`;
      html += `<td class="diff-line-num diff-new-num">${escapeHtml(newLineDisplay)}</td>`;
      html += `<td class="diff-line-content">${escapeHtml(line.content)}</td>`;
      html += '</tr>';
    }

    if (importHiddenCount > 0 && collapseImports) {
      html = html.replace(
        'data-count="0"',
        `data-count="${importHiddenCount}"`
      );
      html = html.replace(
        'Show hidden imports',
        `${importHiddenCount} import line${importHiddenCount > 1 ? 's' : ''} hidden - click to show`
      );
    }

    html += '</tbody></table>';
    html += '</div>';
  }

  html += '</div>';
  return html;
}

// Export for both CommonJS and ES modules

export { parseDiff, renderDiff, isImportLine, isWhitespaceOnlyChange };

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { parseDiff, renderDiff, isImportLine, isWhitespaceOnlyChange };
} else if (typeof exports !== 'undefined') {
  exports.parseDiff = parseDiff;
  exports.renderDiff = renderDiff;
  exports.isImportLine = isImportLine;
  exports.isWhitespaceOnlyChange = isWhitespaceOnlyChange;
}
