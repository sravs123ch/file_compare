
import { diffChars, diffWordsWithSpace, diffArrays, diffSentences, Diff } from "diff";
import { diff_match_patch } from 'diff-match-patch';

// Enhanced comparison that focuses on highlighting differences in the right document
export const compareHtmlDocuments = (leftHtml, rightHtml) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      try {
        console.log('Starting enhanced right-side focused comparison...');
        
        // Quick text comparison first
        const leftText = extractPlainText(leftHtml);
        const rightText = extractPlainText(rightHtml);

        if (leftText.trim() === rightText.trim()) {
          console.log('Documents are identical');
          resolve({
            leftDiffs: [{ type: "equal", content: leftHtml }],
            rightDiffs: [{ type: "equal", content: rightHtml }],
            summary: { additions: 0, deletions: 0, changes: 0 },
            detailed: { lines: [], tables: [], images: [] }
          });
          return;
        }

        console.log('Documents differ, performing right-side focused comparison...');
        
        // Ensure structural alignment first
        const { leftAligned, rightAligned, structuralSummary } = ensureStructuralAlignment(leftHtml, rightHtml);
        
        // Perform enhanced comparison on aligned documents
        const leftDiv = htmlToDiv(leftAligned);
        const rightDiv = htmlToDiv(rightAligned);
        
        let totalAdditions = structuralSummary.additions;
        let totalDeletions = structuralSummary.deletions;
        
        // Step 1: Compare and highlight images (line-by-line alignment with placeholders)
        const imageSummary = compareAndHighlightImages(leftDiv, rightDiv);
        totalAdditions += imageSummary.additions;
        totalDeletions += imageSummary.deletions;
        
        // Step 2: Compare and highlight tables (row/column/cell level)
        const tableSummary = compareAndHighlightTables(leftDiv, rightDiv);
        totalAdditions += tableSummary.additions;
        totalDeletions += tableSummary.deletions;
        
        // Step 3: Compare and highlight text content (line-by-line)
        const textSummary = compareAndHighlightText(leftDiv, rightDiv);
        totalAdditions += textSummary.additions;
        totalDeletions += textSummary.deletions;
        
        const detailed = generateDetailedReport(leftDiv.innerHTML, rightDiv.innerHTML);

        const result = {
          leftDiffs: [{ type: "modified", content: leftDiv.innerHTML }],
          rightDiffs: [{ type: "modified", content: rightDiv.innerHTML }],
          summary: {
            additions: totalAdditions,
            deletions: totalDeletions,
            changes: totalAdditions + totalDeletions
          },
          detailed
        };

        console.log('Enhanced right-side comparison completed successfully');
        resolve(result);
        
      } catch (error) {
        console.error("Error during document comparison:", error);
        resolve({
          leftDiffs: [{ type: "equal", content: leftHtml }],
          rightDiffs: [{ type: "equal", content: rightHtml }],
          summary: { additions: 0, deletions: 0, changes: 0 },
          detailed: { lines: [], tables: [], images: [] },
        });
      }
    }, 10);
  });
};

// Main function to ensure structural alignment between documents (line-by-line with placeholders in right)
const ensureStructuralAlignment = (leftHtml, rightHtml) => {
  const leftDiv = htmlToDiv(leftHtml);
  const rightDiv = htmlToDiv(rightHtml);
  
  let additions = 0;
  let deletions = 0;
  
  // Step 1: Align images (insert placeholders in right for missing)
  const imageAlignment = alignImagesWithPlaceholders(leftDiv, rightDiv);
  additions += imageAlignment.additions;
  deletions += imageAlignment.deletions;
  
  // Step 2: Align tables (insert placeholders in right for missing)
  const tableAlignment = alignTablesWithPlaceholders(leftDiv, rightDiv);
  additions += tableAlignment.additions;
  deletions += tableAlignment.deletions;
  
  // Step 3: Align text blocks (line-by-line, insert placeholders in right for missing)
  const blockAlignment = alignBlocksWithPlaceholders(leftDiv, rightDiv);
  additions += blockAlignment.additions;
  deletions += blockAlignment.deletions;
  
  return {
    leftAligned: leftDiv.innerHTML,
    rightAligned: rightDiv.innerHTML,
    structuralSummary: { additions, deletions }
  };
};

// Image alignment: Insert placeholders in right for missing images to maintain line space
const alignImagesWithPlaceholders = (leftDiv, rightDiv) => {
  const leftImages = Array.from(leftDiv.querySelectorAll('img'));
  const rightImages = Array.from(rightDiv.querySelectorAll('img'));
  
  let additions = 0;
  let deletions = 0;
  
  const getImageSignature = (img) => ({
    src: img.src || '',
    alt: img.alt || '',
    width: img.width || img.style.width || '',
    height: img.height || img.style.height || '',
    className: img.className || ''
  });
  
  const leftSigs = leftImages.map(getImageSignature);
  const rightSigs = rightImages.map(getImageSignature);
  
  const matchedLeft = new Set();
  const matchedRight = new Set();
  
  // Match similar images by src and alt
  leftImages.forEach((leftImg, leftIdx) => {
    if (matchedLeft.has(leftIdx)) return;
    rightImages.forEach((rightImg, rightIdx) => {
      if (matchedRight.has(rightIdx)) return;
      const leftSig = leftSigs[leftIdx];
      const rightSig = rightSigs[rightIdx];
      if (leftSig.src === rightSig.src && leftSig.alt === rightSig.alt) {
        matchedLeft.add(leftIdx);
        matchedRight.add(rightIdx);
        console.log(`Matched image: ${leftSig.src} (present in both)`);
      }
    });
  });
  
  // For unmatched left images: insert placeholder in right at corresponding position (removed)
  leftImages.forEach((leftImg, leftIdx) => {
    if (!matchedLeft.has(leftIdx)) {
      console.log(`Removed image: ${leftImg.src || 'unknown'} (alt: ${leftImg.alt || 'no alt'})`);
      const placeholder = createImagePlaceholder(leftImg, 'removed');
      const insertPos = Math.min(leftIdx, rightImages.length);
      if (insertPos < rightImages.length) {
        rightImages[insertPos].parentNode.insertBefore(placeholder, rightImages[insertPos]);
      } else {
        rightDiv.appendChild(placeholder);
      }
      deletions++;
    }
  });
  
  // For added images in right: highlight them (present only in right)
  rightImages.forEach((rightImg, rightIdx) => {
    if (!matchedRight.has(rightIdx)) {
      console.log(`Added image: ${rightImg.src || 'unknown'} (alt: ${rightImg.alt || 'no alt'})`);
      rightImg.classList.add('git-image-added');
      rightImg.style.outline = '3px solid #22c55e';
      rightImg.style.outlineOffset = '3px';
      rightImg.style.backgroundColor = '#f0fdf4';
      rightImg.style.borderRadius = '4px';
      rightImg.style.padding = '4px';
      additions++;
    }
  });
  
  return { additions, deletions };
};

// Create image placeholder for missing in right with same height and width
const createImagePlaceholder = (originalImg, type) => {
  const placeholder = document.createElement('div');
  placeholder.className = `image-placeholder placeholder-${type}`;
  
  // Extract dimensions from original image
  let width = originalImg.width || originalImg.style.width || 'auto';
  let height = originalImg.height || originalImg.style.height || '100px';
  
  // Ensure dimensions are valid
  if (width && !isNaN(parseInt(width))) {
    width = typeof width === 'string' && width.includes('px') ? width : `${parseInt(width)}px`;
  } else {
    width = 'auto';
  }
  if (height && !isNaN(parseInt(height))) {
    height = typeof height === 'string' && height.includes('px') ? height : `${parseInt(height)}px`;
  } else {
    height = '100px';
  }
  
  placeholder.style.cssText = `
    border: 2px dashed #ef4444;
    background-color: #fef2f2;
    color: #991b1b;
    padding: 20px;
    margin: 16px 0;
    border-radius: 8px;
    text-align: center;
    font-weight: 600;
    width: ${width};
    height: ${height};
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    box-sizing: border-box;
  `;
  
  const icon = document.createElement('span');
  icon.style.fontSize = '24px';
  icon.style.marginBottom = '8px';
  icon.textContent = '🖼️';
  
  const text = document.createElement('span');
  text.textContent = 'Image Removed';
  text.style.fontSize = '14px';
  
  const detail = document.createElement('span');
  detail.textContent = originalImg.alt || 'Document Image';
  detail.style.fontSize = '12px';
  detail.style.opacity = '0.8';
  detail.style.marginTop = '4px';
  
  placeholder.appendChild(icon);
  placeholder.appendChild(text);
  placeholder.appendChild(detail);
  
  return placeholder;
};

// Enhanced image comparison (post-alignment highlighting)
const compareAndHighlightImages = (leftDiv, rightDiv) => {
  const leftImages = Array.from(leftDiv.querySelectorAll('img:not(.placeholder)'));
  const rightImages = Array.from(rightDiv.querySelectorAll('img:not(.placeholder)'));
  const placeholders = rightDiv.querySelectorAll('.image-placeholder');
  
  return {
    additions: rightImages.filter(img => img.classList.contains('git-image-added')).length,
    deletions: placeholders.length
  };
};

// Table alignment: Insert placeholders in right for missing tables/rows/cells
const alignTablesWithPlaceholders = (leftDiv, rightDiv) => {
  const leftTables = Array.from(leftDiv.querySelectorAll('table'));
  const rightTables = Array.from(rightDiv.querySelectorAll('table'));
  
  let additions = 0;
  let deletions = 0;
  
  const getTableSignature = (table) => ({
    rows: table.rows ? table.rows.length : 0,
    cols: table.rows && table.rows[0] ? table.rows[0].cells.length : 0,
    firstCell: table.rows && table.rows[0] && table.rows[0].cells[0] ? table.rows[0].cells[0].textContent.trim().substring(0, 50) : ''
  });
  
  const leftSigs = leftTables.map(getTableSignature);
  const rightSigs = rightTables.map(getTableSignature);
  
  const matchedLeft = new Set();
  const matchedRight = new Set();
  
  // Match tables
  leftTables.forEach((leftTable, leftIdx) => {
    if (matchedLeft.has(leftIdx)) return;
    rightTables.forEach((rightTable, rightIdx) => {
      if (matchedRight.has(rightIdx)) return;
      const leftSig = leftSigs[leftIdx];
      const rightSig = rightSigs[rightIdx];
      if (leftSig.rows === rightSig.rows && leftSig.cols === rightSig.cols && leftSig.firstCell === rightSig.firstCell) {
        matchedLeft.add(leftIdx);
        matchedRight.add(rightIdx);
        alignTableRowsAndCells(leftTable, rightTable);
      }
    });
  });
  
  // Unmatched left tables: placeholder in right
  leftTables.forEach((leftTable, leftIdx) => {
    if (!matchedLeft.has(leftIdx)) {
      const placeholder = createTablePlaceholder(leftTable, 'removed');
      const insertPos = Math.min(leftIdx, rightTables.length);
      if (insertPos < rightTables.length) {
        rightTables[insertPos].parentNode.insertBefore(placeholder, rightTables[insertPos]);
      } else {
        rightDiv.appendChild(placeholder);
      }
      deletions++;
    }
  });
  
  // Added tables in right: highlight
  rightTables.forEach((rightTable, rightIdx) => {
    if (!matchedRight.has(rightIdx)) {
      rightTable.classList.add('git-table-added');
      rightTable.style.outline = '3px solid #22c55e';
      rightTable.style.outlineOffset = '2px';
      rightTable.style.backgroundColor = '#f0fdf4';
      additions++;
    }
  });
  
  return { additions, deletions };
};

// Align rows and cells within matched tables (line-by-line)
const alignTableRowsAndCells = (leftTable, rightTable) => {
  const leftRows = Array.from(leftTable.rows || []);
  const rightRows = Array.from(rightTable.rows || []);
  const maxRows = Math.max(leftRows.length, rightRows.length);
  
  for (let r = 0; r < maxRows; r++) {
    let leftRow = leftRows[r];
    let rightRow = rightRows[r];
    
    if (leftRow && !rightRow) {
      rightRow = rightTable.insertRow(r);
      rightRow.className = 'git-row-removed-placeholder';
      rightRow.style.backgroundColor = '#fef2f2';
      rightRow.style.border = '2px dashed #ef4444';
      leftRow.cells.forEach((cell, c) => {
        const phCell = rightRow.insertCell(c);
        phCell.textContent = '[REMOVED CELL]';
        phCell.style.color = '#991b1b';
        phCell.style.fontStyle = 'italic';
      });
    } else if (!leftRow && rightRow) {
      rightRow.classList.add('git-row-added');
      rightRow.style.backgroundColor = '#f0fdf4';
      rightRow.style.borderLeft = '4px solid #22c55e';
    } else if (leftRow && rightRow) {
      const leftCells = Array.from(leftRow.cells || []);
      const rightCells = Array.from(rightRow.cells || []);
      const maxCells = Math.max(leftCells.length, rightCells.length);
      
      for (let c = 0; c < maxCells; c++) {
        let leftCell = leftCells[c];
        let rightCell = rightCells[c];
        
        if (leftCell && !rightCell) {
          rightCell = rightRow.insertCell(c);
          rightCell.className = 'git-cell-removed-placeholder';
          rightCell.textContent = '[REMOVED]';
          rightCell.style.backgroundColor = '#fef2f2';
          rightCell.style.border = '1px dashed #ef4444';
          rightCell.style.color = '#991b1b';
        } else if (!leftCell && rightCell) {
          rightCell.classList.add('git-cell-added');
          rightCell.style.backgroundColor = '#f0fdf4';
          rightCell.style.border = '2px solid #22c55e';
        } else if (leftCell && rightCell) {
          const leftText = leftCell.textContent.trim();
          const rightText = rightCell.textContent.trim();
          if (!areTextsEqual(leftText, rightText)) {
            rightCell.classList.add('git-cell-modified');
            rightCell.style.backgroundColor = '#fffbeb';
            rightCell.style.border = '2px solid #f59e0b';
            const dmp = new diff_match_patch();
            const diffs = dmp.diff_main(leftText, rightText);
            dmp.diff_cleanupSemantic(diffs);
            rightCell.innerHTML = applyDiffHighlighting(diffs, 'right');
          }
        }
      }
    }
  }
};

// Enhanced table comparison (post-alignment)
const compareAndHighlightTables = (leftDiv, rightDiv) => {
  const addedTables = rightDiv.querySelectorAll('.git-table-added').length;
  const removedPlaceholders = rightDiv.querySelectorAll('.table-placeholder.placeholder-removed').length;
  const addedRows = rightDiv.querySelectorAll('.git-row-added').length;
  const removedRowPh = rightDiv.querySelectorAll('.git-row-removed-placeholder').length;
  const addedCells = rightDiv.querySelectorAll('.git-cell-added').length;
  const removedCellPh = rightDiv.querySelectorAll('.git-cell-removed-placeholder').length;
  const modifiedCells = rightDiv.querySelectorAll('.git-cell-modified').length * 2;
  
  return {
    additions: addedTables + addedRows + addedCells + (modifiedCells / 2),
    deletions: removedPlaceholders + removedRowPh + removedCellPh + (modifiedCells / 2)
  };
};

// Text alignment: Line-by-line with placeholders in right
const alignBlocksWithPlaceholders = (leftDiv, rightDiv) => {
  const leftBlocks = extractBlocks(leftDiv);
  const rightBlocks = extractBlocks(rightDiv);
  
  let additions = 0;
  let deletions = 0;
  
  const leftTexts = leftBlocks.map(b => b.text);
  const rightTexts = rightBlocks.map(b => b.text);
  
  const diff = diffArrays(leftTexts, rightTexts, {
    comparator: (a, b) => areTextsEqual(a, b)
  });
  
  let leftIdx = 0;
  let rightIdx = 0;
  
  diff.forEach(part => {
    if (part.added) {
      for (let i = 0; i < part.count; i++) {
        const rightBlock = rightBlocks[rightIdx++];
        if (rightBlock) {
          rightBlock.element.classList.add('git-line-added');
          rightBlock.element.style.backgroundColor = '#f0fdf4';
          rightBlock.element.style.borderLeft = '4px solid #22c55e';
          additions++;
        }
      }
    } else if (part.removed) {
      for (let i = 0; i < part.count; i++) {
        const leftBlock = leftBlocks[leftIdx++];
        if (leftBlock) {
          const placeholder = createBlockPlaceholder(leftBlock, 'removed');
          if (rightIdx < rightBlocks.length) {
            rightBlocks[rightIdx].element.parentNode.insertBefore(placeholder, rightBlocks[rightIdx].element);
          } else {
            rightDiv.appendChild(placeholder);
          }
          deletions++;
        }
      }
    } else {
      for (let i = 0; i < part.count; i++) {
        const leftBlock = leftBlocks[leftIdx++];
        const rightBlock = rightBlocks[rightIdx++];
        if (leftBlock && rightBlock && !areTextsEqual(leftBlock.text, rightBlock.text)) {
          rightBlock.element.classList.add('git-line-modified');
          rightBlock.element.style.backgroundColor = '#fffbeb';
          rightBlock.element.style.borderLeft = '4px solid #f59e0b';
          const dmp = new diff_match_patch();
          const diffs = dmp.diff_main(leftBlock.text, rightBlock.text);
          dmp.diff_cleanupSemantic(diffs);
          rightBlock.element.innerHTML = applyDiffHighlighting(diffs, 'right');
          additions++;
          deletions++;
        }
      }
    }
  });
  
  return { additions, deletions };
};

// Enhanced text comparison (post-alignment)
const compareAndHighlightText = (leftDiv, rightDiv) => {
  const addedLines = rightDiv.querySelectorAll('.git-line-added').length;
  const removedPh = rightDiv.querySelectorAll('.block-placeholder.placeholder-removed').length;
  const modifiedLines = rightDiv.querySelectorAll('.git-line-modified').length * 2;
  
  return {
    additions: addedLines + (modifiedLines / 2),
    deletions: removedPh + (modifiedLines / 2)
  };
};

// Apply diff highlighting (for right side focus)
const applyDiffHighlighting = (diffs, side = 'right') => {
  let html = '';
  diffs.forEach(diff => {
    const [op, text] = diff;
    let escaped = escapeHtml(text);
    if (op === 0) {
      html += escaped;
    } else if (op === 1) {
      if (side === 'right') {
        html += `<span class="git-inline-added">${escaped}</span>`;
      } else {
        html += `<span style="background: #f0fdf4; color: #166534;">[+${escaped}]</span>`;
      }
    } else if (op === -1) {
      if (side === 'right') {
        html += `<span class="git-inline-removed">${escaped}</span>`;
      } else {
        html += `<span style="background: #fef2f2; color: #991b1b;">[-${escaped}]</span>`;
      }
    }
  });
  return html;
};

// Create block placeholder
const createBlockPlaceholder = (block, type) => {
  const placeholder = document.createElement('div');
  placeholder.className = `block-placeholder placeholder-${type}`;
  placeholder.style.cssText = `
    background: #fef2f2;
    border: 2px dashed #ef4444;
    margin: 8px 0;
    border-radius: 8px;
    min-height: 48px;
    display: flex;
    align-items: center;
    padding: 12px 16px;
    font-style: italic;
    color: #991b1b;
  `;
  placeholder.innerHTML = `<span>🗑️ Removed: ${block.text.substring(0, 100)}${block.text.length > 100 ? '...' : ''}</span>`;
  return placeholder;
};

// Create table placeholder
const createTablePlaceholder = (table, type) => {
  const placeholder = document.createElement('div');
  placeholder.className = `table-placeholder placeholder-${type}`;
  const rows = table.rows ? table.rows.length : 0;
  const cols = table.rows && table.rows[0] ? table.rows[0].cells.length : 0;
  placeholder.style.minHeight = `${Math.max(60, rows * 35)}px`;
  placeholder.style.border = `2px dashed ${type === 'removed' ? '#ef4444' : '#22c55e'}`;
  placeholder.style.backgroundColor = type === 'removed' ? '#fef2f2' : '#f0fdf4';
  placeholder.style.borderRadius = '6px';
  placeholder.style.display = 'flex';
  placeholder.style.flexDirection = 'column';
  placeholder.style.alignItems = 'center';
  placeholder.style.justifyContent = 'center';
  placeholder.style.margin = '16px 0';
  placeholder.style.padding = '20px';
  placeholder.innerHTML = `
    <span style="font-size: 24px; margin-bottom: 8px; color: ${type === 'removed' ? '#991b1b' : '#166534'};">${type === 'removed' ? '🗑️' : '📋'}</span>
    <span style="color: ${type === 'removed' ? '#991b1b' : '#166534'}; font-size: 14px; font-weight: 600;">${type === 'removed' ? 'Table Removed' : 'Table Added'}</span>
    <span style="color: ${type === 'removed' ? '#991b1b' : '#166534'}; font-size: 12px; opacity: 0.8;">${rows} rows × ${cols} columns</span>
  `;
  return placeholder;
};

// Extract blocks (line-like elements)
const extractBlocks = (container) => {
  const blocks = [];
  const elements = container.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li, div:not(.placeholder)');
  elements.forEach(el => {
    if (!isInsideTable(el) && !el.classList.contains('placeholder')) {
      const text = el.textContent.trim();
      if (text) {
        blocks.push({ element: el, text, tagName: el.tagName.toLowerCase() });
      }
    }
  });
  return blocks;
};

// Utility functions
const htmlToDiv = (html) => {
  const div = document.createElement('div');
  if (html) div.innerHTML = html;
  return div;
};

const extractPlainText = (html) => {
  const div = htmlToDiv(html);
  return div.textContent || '';
};

const areTextsEqual = (t1, t2) => {
  return t1.trim().replace(/\s+/g, ' ').toLowerCase() === t2.trim().replace(/\s+/g, ' ').toLowerCase();
};

const escapeHtml = (text) => {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
};

const isInsideTable = (el) => {
  let parent = el.parentElement;
  while (parent) {
    const tag = parent.tagName.toLowerCase();
    if (['table', 'tr', 'td', 'th'].includes(tag)) return true;
    parent = parent.parentElement;
  }
  return false;
};

// Detailed report generation (line-by-line summary)
const generateDetailedReport = (leftHtml, rightHtml) => {
  const leftDiv = htmlToDiv(leftHtml);
  const rightDiv = htmlToDiv(rightHtml);
  
  // Lines (text blocks)
  const leftLines = collectBlockLinesWithFormat(leftDiv);
  const rightLines = collectBlockLinesWithFormat(rightDiv);
  
  const leftTexts = leftLines.map(l => l.text);
  const rightTexts = rightLines.map(l => l.text);
  const parts = diffArrays(leftTexts, rightTexts, { comparator: areTextsEqual });
  
  const lines = [];
  let leftIdx = 0, rightIdx = 0, v1 = 1, v2 = 1;
  
  parts.forEach(part => {
    const count = part.value ? part.value.length : part.count || 0;
    if (part.added) {
      for (let k = 0; k < count; k++) {
        const rLine = rightLines[rightIdx++];
        lines.push({
          v1: '',
          v2: v2++,
          status: 'ADDED',
          diffHtml: `<span class="git-inline-added">${escapeHtml(rLine.text)}</span>`,
          formatChanges: ['added line']
        });
      }
    } else if (part.removed) {
      for (let k = 0; k < count; k++) {
        const lLine = leftLines[leftIdx++];
        lines.push({
          v1: v1++,
          v2: '',
          status: 'REMOVED',
          diffHtml: `<span class="git-inline-removed">${escapeHtml(lLine.text)}</span>`,
          formatChanges: ['removed line']
        });
      }
    } else {
      for (let k = 0; k < count; k++) {
        const lLine = leftLines[leftIdx++];
        const rLine = rightLines[rightIdx++];
        const equal = areTextsEqual(lLine.text, rLine.text);
        const fmtChanges = compareFormat(lLine.fmt, rLine.fmt);
        
        if (equal && fmtChanges.length === 0) {
          lines.push({
            v1: v1++,
            v2: v2++,
            status: 'UNCHANGED',
            diffHtml: escapeHtml(lLine.text),
            formatChanges: []
          });
        } else {
          const status = equal ? 'FORMATTING-ONLY' : 'MODIFIED';
          const diffHtml = equal ? escapeHtml(lLine.text) : inlineDiffHtml(lLine.text, rLine.text);
          lines.push({
            v1: v1++,
            v2: v2++,
            status,
            diffHtml,
            formatChanges: fmtChanges.length > 0 ? fmtChanges : ['content changed']
          });
        }
      }
    }
  });
  
  // Tables report (row/col level)
  const tableReport = [];
  const leftTables = Array.from(leftDiv.querySelectorAll('table'));
  const rightTables = Array.from(rightDiv.querySelectorAll('table'));
  const maxTables = Math.max(leftTables.length, rightTables.length);
  for (let t = 0; t < maxTables; t++) {
    const lTable = leftTables[t];
    const rTable = rightTables[t];
    if (!lTable && rTable) {
      tableReport.push({ table: t + 1, status: 'ADDED' });
      continue;
    }
    if (lTable && !rTable) {
      tableReport.push({ table: t + 1, status: 'REMOVED' });
      continue;
    }
    const lRows = Array.from(lTable.rows);
    const rRows = Array.from(rTable.rows);
    const maxRows = Math.max(lRows.length, rRows.length);
    for (let row = 0; row < maxRows; row++) {
      const lRow = lRows[row];
      const rRow = rRows[row];
      if (!lRow && rRow) {
        tableReport.push({ table: t + 1, row: row + 1, status: 'ADDED' });
      } else if (lRow && !rRow) {
        tableReport.push({ table: t + 1, row: row + 1, status: 'REMOVED' });
      } else {
        const lCells = Array.from(lRow.cells);
        const rCells = Array.from(rRow.cells);
        const maxCells = Math.max(lCells.length, rCells.length);
        for (let col = 0; col < maxCells; col++) {
          const lCell = lCells[col];
          const rCell = rCells[col];
          if (!lCell && rCell) {
            tableReport.push({ table: t + 1, row: row + 1, col: col + 1, status: 'ADDED' });
          } else if (lCell && !rCell) {
            tableReport.push({ table: t + 1, row: row + 1, col: col + 1, status: 'REMOVED' });
          } else {
            const lText = lCell.textContent.trim();
            const rText = rCell.textContent.trim();
            if (!areTextsEqual(lText, rText)) {
              tableReport.push({
                table: t + 1,
                row: row + 1,
                col: col + 1,
                status: 'MODIFIED',
                diffHtml: inlineDiffHtml(lText, rText)
              });
            }
          }
        }
      }
    }
  }
  
  // Images report - Enhanced to identify present/removed by src and alt
  const leftImgs = Array.from(leftDiv.querySelectorAll('img')).map(img => ({
    src: img.src || 'unknown',
    alt: img.alt || 'no alt'
  }));
  const rightImgs = Array.from(rightDiv.querySelectorAll('img:not(.placeholder)')).map(img => ({
    src: img.src || 'unknown',
    alt: img.alt || 'no alt'
  }));
  const imgReport = [];
  
  // Track matched images for reporting
  const matched = new Map();
  leftImgs.forEach((leftImg, idx) => {
    let isMatched = false;
    rightImgs.forEach((rightImg, rIdx) => {
      if (!isMatched && leftImg.src === rightImg.src && leftImg.alt === rightImg.alt) {
        matched.set(leftImg.src, { status: 'PRESENT', alt: leftImg.alt });
        isMatched = true;
      }
    });
    if (!isMatched) {
      imgReport.push({ 
        src: leftImg.src, 
        alt: leftImg.alt, 
        status: 'REMOVED',
        index: idx + 1 
      });
    } else {
      console.log(`Image present: ${leftImg.src} (alt: ${leftImg.alt})`);
    }
  });
  
  // Added images (present only in right)
  rightImgs.forEach((rightImg, rIdx) => {
    let isAdded = true;
    leftImgs.forEach(leftImg => {
      if (rightImg.src === leftImg.src && rightImg.alt === leftImg.alt) {
        isAdded = false;
      }
    });
    if (isAdded) {
      imgReport.push({ 
        src: rightImg.src, 
        alt: rightImg.alt, 
        status: 'ADDED',
        index: rIdx + 1 
      });
    }
  });
  
  return { lines, tables: tableReport, images: imgReport };
};

// Helper functions for detailed report
const BLOCK_SELECTOR = 'p, h1, h2, h3, h4, h5, h6, li, div, pre';
const collectBlockLinesWithFormat = (root) => {
  const blocks = Array.from(root.querySelectorAll(BLOCK_SELECTOR));
  return blocks
    .filter(b => !isInsideTable(b) && !b.classList.contains('placeholder'))
    .map(el => ({
      text: el.textContent || '',
      fmt: extractLineFeatures(el),
      element: el
    }));
};

const extractLineFeatures = (el) => ({
  hasBold: !!el.querySelector('b, strong'),
  hasItalic: !!el.querySelector('i, em'),
  hasUnderline: !!el.querySelector('u'),
  fontSize: el.style.fontSize || '',
  textAlign: el.style.textAlign || el.getAttribute('align') || ''
});

const compareFormat = (fa, fb) => {
  const changes = [];
  if (!!fa.hasBold !== !!fb.hasBold) changes.push(`bold: ${fa.hasBold ? 'on' : 'off'} → ${fb.hasBold ? 'on' : 'off'}`);
  if (!!fa.hasItalic !== !!fb.hasItalic) changes.push(`italic: ${fa.hasItalic ? 'on' : 'off'} → ${fb.hasItalic ? 'on' : 'off'}`);
  if (!!fa.hasUnderline !== !!fb.hasUnderline) changes.push(`underline: ${fa.hasUnderline ? 'on' : 'off'} → ${fb.hasUnderline ? 'on' : 'off'}`);
  if (fa.fontSize !== fb.fontSize) changes.push(`font-size: ${fa.fontSize || 'auto'} → ${fb.fontSize || 'auto'}`);
  if (fa.textAlign !== fb.textAlign) changes.push(`alignment: ${fa.textAlign || 'auto'} → ${fb.textAlign || 'auto'}`);
  return changes;
};

const inlineDiffHtml = (a, b) => {
  const dmp = new diff_match_patch();
  const diffs = dmp.diff_main(a || '', b || '');
  dmp.diff_cleanupSemantic(diffs);
  return diffs.map(([op, text]) => {
    const val = escapeHtml(text);
    if (op === 1) return `<span class="git-inline-added">${val}</span>`;
    if (op === -1) return `<span class="git-inline-removed">${val}</span>`;
    return val;
  }).join('');
};

// Additional exports for rendering
export const renderHtmlDifferences = (diffs) => diffs.map(d => d.content).join('');

export const highlightDifferences = (diffs) => 
  diffs.map(diff => {
    switch (diff.type) {
      case 'insert': return `<span class="diff-insert">${escapeHtml(diff.content)}</span>`;
      case 'delete': return `<span class="diff-delete">${escapeHtml(diff.content)}</span>`;
      default: return escapeHtml(diff.content);
    }
  }).join('');