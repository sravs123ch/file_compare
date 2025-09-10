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
        
        // Enhanced comparison focusing on right-side highlighting
        const { leftProcessed, rightProcessed, comparisonSummary } = 
          performEnhancedComparison(leftHtml, rightHtml);

        const detailed = generateDetailedReport(leftProcessed, rightProcessed);

        const result = {
          leftDiffs: [{ type: "modified", content: leftProcessed }],
          rightDiffs: [{ type: "modified", content: rightProcessed }],
          summary: comparisonSummary,
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

// Enhanced comparison function that focuses on right-side highlighting
const performEnhancedComparison = (leftHtml, rightHtml) => {
  const leftDiv = htmlToDiv(leftHtml);
  const rightDiv = htmlToDiv(rightHtml);
  
  let totalAdditions = 0;
  let totalDeletions = 0;
  
  // Step 1: Compare and highlight images
  const imageSummary = compareAndHighlightImages(leftDiv, rightDiv);
  totalAdditions += imageSummary.additions;
  totalDeletions += imageSummary.deletions;
  
  // Step 2: Compare and highlight tables
  const tableSummary = compareAndHighlightTables(leftDiv, rightDiv);
  totalAdditions += tableSummary.additions;
  totalDeletions += tableSummary.deletions;
  
  // Step 3: Compare and highlight text content
  const textSummary = compareAndHighlightText(leftDiv, rightDiv);
  totalAdditions += textSummary.additions;
  totalDeletions += textSummary.deletions;
  
  return {
    leftProcessed: leftDiv.innerHTML,
    rightProcessed: rightDiv.innerHTML,
    comparisonSummary: {
      additions: totalAdditions,
      deletions: totalDeletions,
      changes: totalAdditions + totalDeletions
    }
  };
};

// Enhanced image comparison with right-side highlighting
const compareAndHighlightImages = (leftDiv, rightDiv) => {
  const leftImages = Array.from(leftDiv.querySelectorAll('img'));
  const rightImages = Array.from(rightDiv.querySelectorAll('img'));
  
  let additions = 0;
  let deletions = 0;
  
  // Create image signatures for comparison
  const getImageSignature = (img) => ({
    src: img.src || '',
    alt: img.alt || '',
    width: img.width || img.style.width || '',
    height: img.height || img.style.height || '',
    className: img.className || ''
  });
  
  const leftImageSigs = leftImages.map(getImageSignature);
  const rightImageSigs = rightImages.map(getImageSignature);
  
  // Track matched images
  const rightMatched = new Set();
  const leftMatched = new Set();
  
  // Find exact matches first
  leftImages.forEach((leftImg, leftIndex) => {
    if (leftMatched.has(leftIndex)) return;
    
    const leftSig = leftImageSigs[leftIndex];
    
    rightImages.forEach((rightImg, rightIndex) => {
      if (rightMatched.has(rightIndex)) return;
      
      const rightSig = rightImageSigs[rightIndex];
      
      // Check for exact match
      if (leftSig.src === rightSig.src && 
          leftSig.alt === rightSig.alt &&
          leftSig.width === rightSig.width &&
          leftSig.height === rightSig.height) {
        leftMatched.add(leftIndex);
        rightMatched.add(rightIndex);
        return;
      }
    });
  });
  
  // Highlight unmatched images in right document
  rightImages.forEach((rightImg, rightIndex) => {
    if (!rightMatched.has(rightIndex)) {
      // This image is new in the right document
      rightImg.classList.add('git-image-added');
      rightImg.style.outline = '3px solid #22c55e';
      rightImg.style.outlineOffset = '3px';
      rightImg.style.backgroundColor = '#f0fdf4';
      rightImg.style.borderRadius = '4px';
      rightImg.style.padding = '4px';
      
      // Add a label
      const label = document.createElement('div');
      label.className = 'image-change-label';
      label.style.cssText = `
        position: absolute;
        top: -8px;
        left: -8px;
        background: #22c55e;
        color: white;
        padding: 2px 6px;
        border-radius: 4px;
        font-size: 10px;
        font-weight: bold;
        z-index: 10;
      `;
      label.textContent = 'NEW';
      
      // Wrap image in relative container for label positioning
      const wrapper = document.createElement('div');
      wrapper.style.position = 'relative';
      wrapper.style.display = 'inline-block';
      rightImg.parentNode.insertBefore(wrapper, rightImg);
      wrapper.appendChild(rightImg);
      wrapper.appendChild(label);
      
      additions++;
    }
  });
  
  // Add placeholders in right document for images that were removed
  leftImages.forEach((leftImg, leftIndex) => {
    if (!leftMatched.has(leftIndex)) {
      // This image was removed from the right document
      const placeholder = document.createElement('div');
      placeholder.className = 'image-placeholder placeholder-removed';
      placeholder.style.cssText = `
        border: 2px dashed #ef4444;
        background-color: #fef2f2;
        color: #991b1b;
        padding: 20px;
        margin: 16px 0;
        border-radius: 8px;
        text-align: center;
        font-weight: 600;
        min-height: 100px;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
      `;
      
      const icon = document.createElement('span');
      icon.style.fontSize = '24px';
      icon.style.marginBottom = '8px';
      icon.textContent = '🖼️';
      
      const text = document.createElement('span');
      text.textContent = 'Image Removed';
      text.style.fontSize = '14px';
      
      const detail = document.createElement('span');
      detail.textContent = leftImg.alt || 'Image';
      detail.style.fontSize = '12px';
      detail.style.opacity = '0.8';
      detail.style.marginTop = '4px';
      
      placeholder.appendChild(icon);
      placeholder.appendChild(text);
      placeholder.appendChild(detail);
      
      // Insert placeholder at appropriate position in right document
      if (leftIndex < rightImages.length) {
        rightImages[leftIndex].parentNode.insertBefore(placeholder, rightImages[leftIndex]);
      } else {
        rightDiv.appendChild(placeholder);
      }
      
      deletions++;
    }
  });
  
  return { additions, deletions };
};

// Enhanced table comparison with right-side highlighting
const compareAndHighlightTables = (leftDiv, rightDiv) => {
  const leftTables = Array.from(leftDiv.querySelectorAll('table'));
  const rightTables = Array.from(rightDiv.querySelectorAll('table'));
  
  let additions = 0;
  let deletions = 0;
  
  // Compare tables by structure and content
  const getTableSignature = (table) => {
    const rows = table.rows ? table.rows.length : 0;
    const cols = table.rows && table.rows[0] ? table.rows[0].cells.length : 0;
    const firstCellText = table.rows && table.rows[0] && table.rows[0].cells[0] 
      ? (table.rows[0].cells[0].textContent || '').trim().substring(0, 50)
      : '';
    
    return { rows, cols, firstCellText };
  };
  
  const rightMatched = new Set();
  const leftMatched = new Set();
  
  // Match tables by signature
  leftTables.forEach((leftTable, leftIndex) => {
    if (leftMatched.has(leftIndex)) return;
    
    const leftSig = getTableSignature(leftTable);
    
    rightTables.forEach((rightTable, rightIndex) => {
      if (rightMatched.has(rightIndex)) return;
      
      const rightSig = getTableSignature(rightTable);
      
      if (leftSig.rows === rightSig.rows && 
          leftSig.cols === rightSig.cols &&
          leftSig.firstCellText === rightSig.firstCellText) {
        
        // Tables match structurally, now compare content
        const cellChanges = compareTableCells(leftTable, rightTable);
        additions += cellChanges.additions;
        deletions += cellChanges.deletions;
        
        leftMatched.add(leftIndex);
        rightMatched.add(rightIndex);
        return;
      }
    });
  });
  
  // Highlight new tables in right document
  rightTables.forEach((rightTable, rightIndex) => {
    if (!rightMatched.has(rightIndex)) {
      rightTable.classList.add('git-table-added');
      rightTable.style.outline = '3px solid #22c55e';
      rightTable.style.outlineOffset = '2px';
      rightTable.style.backgroundColor = '#f0fdf4';
      
      // Add table label
      const label = document.createElement('div');
      label.className = 'table-change-label';
      label.style.cssText = `
        background: #22c55e;
        color: white;
        padding: 4px 8px;
        border-radius: 4px 4px 0 0;
        font-size: 12px;
        font-weight: bold;
        margin-bottom: -1px;
      `;
      label.textContent = 'NEW TABLE';
      
      rightTable.parentNode.insertBefore(label, rightTable);
      additions++;
    }
  });
  
  // Add placeholders for removed tables
  leftTables.forEach((leftTable, leftIndex) => {
    if (!leftMatched.has(leftIndex)) {
      const placeholder = createTablePlaceholder(leftTable, 'removed');
      
      // Insert at appropriate position
      if (leftIndex < rightTables.length) {
        rightTables[leftIndex].parentNode.insertBefore(placeholder, rightTables[leftIndex]);
      } else {
        rightDiv.appendChild(placeholder);
      }
      
      deletions++;
    }
  });
  
  return { additions, deletions };
};

// Enhanced table cell comparison
const compareTableCells = (leftTable, rightTable) => {
  const leftRows = Array.from(leftTable.rows || []);
  const rightRows = Array.from(rightTable.rows || []);
  
  let additions = 0;
  let deletions = 0;
  
  const maxRows = Math.max(leftRows.length, rightRows.length);
  
  for (let r = 0; r < maxRows; r++) {
    const leftRow = leftRows[r];
    const rightRow = rightRows[r];
    
    if (leftRow && !rightRow) {
      // Row was removed - add placeholder in right table
      const placeholderRow = rightTable.insertRow(r);
      placeholderRow.className = 'git-row-removed-placeholder';
      placeholderRow.style.cssText = `
        background-color: #fef2f2;
        border: 2px dashed #ef4444;
        opacity: 0.7;
      `;
      
      const cellCount = leftRow.cells.length;
      for (let c = 0; c < cellCount; c++) {
        const placeholderCell = placeholderRow.insertCell(c);
        placeholderCell.textContent = '[REMOVED]';
        placeholderCell.style.cssText = `
          color: #991b1b;
          font-style: italic;
          text-align: center;
          padding: 8px;
        `;
      }
      deletions++;
      
    } else if (!leftRow && rightRow) {
      // Row was added
      rightRow.classList.add('git-row-added');
      rightRow.style.backgroundColor = '#f0fdf4';
      rightRow.style.borderLeft = '4px solid #22c55e';
      additions++;
      
    } else if (leftRow && rightRow) {
      // Compare cells in the row
      const leftCells = Array.from(leftRow.cells || []);
      const rightCells = Array.from(rightRow.cells || []);
      const maxCells = Math.max(leftCells.length, rightCells.length);
      
      for (let c = 0; c < maxCells; c++) {
        const leftCell = leftCells[c];
        const rightCell = rightCells[c];
        
        if (leftCell && !rightCell) {
          // Cell was removed
          const placeholderCell = rightRow.insertCell(c);
          placeholderCell.className = 'git-cell-removed-placeholder';
          placeholderCell.textContent = '[REMOVED]';
          placeholderCell.style.cssText = `
            background-color: #fef2f2;
            border: 1px dashed #ef4444;
            color: #991b1b;
            font-style: italic;
            text-align: center;
            padding: 8px;
          `;
          deletions++;
          
        } else if (!leftCell && rightCell) {
          // Cell was added
          rightCell.classList.add('git-cell-added');
          rightCell.style.backgroundColor = '#f0fdf4';
          rightCell.style.border = '2px solid #22c55e';
          additions++;
          
        } else if (leftCell && rightCell) {
          const leftText = (leftCell.textContent || '').trim();
          const rightText = (rightCell.textContent || '').trim();
          
          if (!areTextsEqual(leftText, rightText)) {
            // Cell content was modified
            rightCell.classList.add('git-cell-modified');
            rightCell.style.backgroundColor = '#fffbeb';
            rightCell.style.border = '2px solid #f59e0b';
            
            // Apply word-level highlighting within the cell
            const dmp = new diff_match_patch();
            const diffs = dmp.diff_main(leftText, rightText);
            dmp.diff_cleanupSemantic(diffs);
            
            let highlightedHtml = '';
            diffs.forEach(diff => {
              const [operation, text] = diff;
              if (operation === 1) {
                highlightedHtml += `<span class="git-inline-added">${escapeHtml(text)}</span>`;
              } else if (operation === -1) {
                highlightedHtml += `<span class="git-inline-removed">${escapeHtml(text)}</span>`;
              } else {
                highlightedHtml += escapeHtml(text);
              }
            });
            
            rightCell.innerHTML = highlightedHtml;
            additions++;
            deletions++;
          }
        }
      }
    }
  }
  
  return { additions, deletions };
};

// Enhanced text comparison with right-side highlighting
const compareAndHighlightText = (leftDiv, rightDiv) => {
  const leftBlocks = getTextBlocks(leftDiv);
  const rightBlocks = getTextBlocks(rightDiv);
  
  let additions = 0;
  let deletions = 0;
  
  // Use diff algorithm to align text blocks
  const leftTexts = leftBlocks.map(block => block.text);
  const rightTexts = rightBlocks.map(block => block.text);
  
  const diff = diffArrays(leftTexts, rightTexts, {
    comparator: (left, right) => areTextsEqual(left, right)
  });
  
  let leftIndex = 0;
  let rightIndex = 0;
  
  diff.forEach(part => {
    if (part.added) {
      // Text blocks added in right document
      for (let i = 0; i < part.count; i++) {
        const rightBlock = rightBlocks[rightIndex++];
        if (rightBlock) {
          rightBlock.element.classList.add('git-line-added');
          rightBlock.element.style.cssText = `
            background: linear-gradient(90deg, #f0fdf4 0%, #dcfce7 100%);
            border-left: 4px solid #22c55e;
            padding: 8px 12px;
            margin: 4px 0;
            border-radius: 6px;
            box-shadow: 0 2px 8px rgba(34, 197, 94, 0.15);
            position: relative;
          `;
          
          // Add change indicator
          const indicator = document.createElement('span');
          indicator.style.cssText = `
            position: absolute;
            left: -2px;
            top: 50%;
            transform: translateY(-50%);
            background: #22c55e;
            color: white;
            width: 20px;
            height: 20px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 10px;
            font-weight: bold;
          `;
          indicator.textContent = '➕';
          rightBlock.element.appendChild(indicator);
          
          additions++;
        }
      }
    } else if (part.removed) {
      // Text blocks removed from right document - add placeholders
      for (let i = 0; i < part.count; i++) {
        const leftBlock = leftBlocks[leftIndex++];
        if (leftBlock) {
          const placeholder = document.createElement('div');
          placeholder.className = 'git-line-placeholder placeholder-removed';
          placeholder.style.cssText = `
            background: linear-gradient(135deg, #fef2f2 0%, #fecaca 100%);
            border: 2px dashed #ef4444;
            margin: 8px 0;
            border-radius: 8px;
            min-height: 48px;
            display: flex;
            align-items: center;
            justify-content: flex-start;
            padding: 12px 16px;
            font-style: italic;
            color: #991b1b;
            position: relative;
          `;
          
          const icon = document.createElement('span');
          icon.style.marginRight = '8px';
          icon.textContent = '🗑️';
          
          const text = document.createElement('span');
          text.textContent = `Removed: ${leftBlock.text.substring(0, 100)}${leftBlock.text.length > 100 ? '...' : ''}`;
          
          placeholder.appendChild(icon);
          placeholder.appendChild(text);
          
          // Insert placeholder at appropriate position
          if (rightIndex < rightBlocks.length) {
            rightBlocks[rightIndex].element.parentNode.insertBefore(placeholder, rightBlocks[rightIndex].element);
          } else {
            rightDiv.appendChild(placeholder);
          }
          
          deletions++;
        }
      }
    } else {
      // Equal blocks - check for word-level differences
      for (let i = 0; i < part.count; i++) {
        const leftBlock = leftBlocks[leftIndex++];
        const rightBlock = rightBlocks[rightIndex++];
        
        if (leftBlock && rightBlock && !areTextsEqual(leftBlock.text, rightBlock.text)) {
          // Apply word-level highlighting
          const dmp = new diff_match_patch();
          const diffs = dmp.diff_main(leftBlock.text, rightBlock.text);
          dmp.diff_cleanupSemantic(diffs);
          
          let highlightedHtml = '';
          let hasChanges = false;
          
          diffs.forEach(diff => {
            const [operation, text] = diff;
            if (operation === 1) {
              highlightedHtml += `<span class="git-inline-added">${escapeHtml(text)}</span>`;
              hasChanges = true;
              additions++;
            } else if (operation === -1) {
              highlightedHtml += `<span class="git-inline-removed">${escapeHtml(text)}</span>`;
              hasChanges = true;
              deletions++;
            } else {
              highlightedHtml += escapeHtml(text);
            }
          });
          
          if (hasChanges) {
            rightBlock.element.classList.add('git-line-modified');
            rightBlock.element.style.cssText = `
              background: linear-gradient(90deg, #fffbeb 0%, #fef3c7 100%);
              border-left: 4px solid #f59e0b;
              padding: 8px 12px;
              margin: 4px 0;
              border-radius: 6px;
              box-shadow: 0 2px 8px rgba(245, 158, 11, 0.15);
              position: relative;
            `;
            
            rightBlock.element.innerHTML = highlightedHtml;
            
            // Add change indicator
            const indicator = document.createElement('span');
            indicator.style.cssText = `
              position: absolute;
              left: -2px;
              top: 50%;
              transform: translateY(-50%);
              background: #f59e0b;
              color: white;
              width: 20px;
              height: 20px;
              border-radius: 50%;
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: 10px;
              font-weight: bold;
            `;
            indicator.textContent = '✏️';
            rightBlock.element.appendChild(indicator);
          }
        }
      }
    }
  });
  
  return { additions, deletions };
};

// Get text blocks for comparison
const getTextBlocks = (container) => {
  const blocks = [];
  const elements = container.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li, div');
  
  elements.forEach(element => {
    // Skip if inside table, already processed, or is a placeholder
    if (isInsideTable(element) || 
        element.classList.contains('git-line-added') ||
        element.classList.contains('git-line-removed') ||
        element.classList.contains('git-line-modified') ||
        element.classList.contains('placeholder-removed') ||
        element.classList.contains('placeholder-added') ||
        element.classList.contains('table-placeholder') ||
        element.classList.contains('image-placeholder')) {
      return;
    }
    
    const text = (element.textContent || '').trim();
    if (text) {
      blocks.push({
        element,
        text,
        tagName: element.tagName.toLowerCase()
      });
    }
  });
  
  return blocks;
};

// Main function to ensure structural alignment between documents
const ensureStructuralAlignment = (leftHtml, rightHtml) => {
  const leftDiv = htmlToDiv(leftHtml);
  const rightDiv = htmlToDiv(rightHtml);
  
  // Step 1: Align tables first (most important for structure)
  const { leftWithTables, rightWithTables, tableSummary } = 
    alignTablesWithPlaceholders(leftDiv, rightDiv);
  
  // Step 2: Align other major structural elements
  const { leftWithBlocks, rightWithBlocks, blockSummary } = 
    alignBlocksWithPlaceholders(leftWithTables, rightWithTables);
  
  return {
    leftAligned: leftWithBlocks.innerHTML,
    rightAligned: rightWithBlocks.innerHTML,
    structuralSummary: {
      additions: tableSummary.additions + blockSummary.additions,
      deletions: tableSummary.deletions + blockSummary.deletions
    }
  };
};

// Improved table alignment with proper placeholders
const alignTablesWithPlaceholders = (leftDiv, rightDiv) => {
  const leftTables = Array.from(leftDiv.querySelectorAll("table"));
  const rightTables = Array.from(rightDiv.querySelectorAll("table"));
  
  let additions = 0, deletions = 0;
  
  // Create a mapping of table positions and their placeholders
  const leftTableMap = new Map();
  const rightTableMap = new Map();
  
  // Map existing tables by their position and basic characteristics
  leftTables.forEach((table, index) => {
    leftTableMap.set(index, {
      table,
      index,
      signature: getTableSignature(table),
      matched: false
    });
  });
  
  rightTables.forEach((table, index) => {
    rightTableMap.set(index, {
      table,
      index,
      signature: getTableSignature(table),
      matched: false
    });
  });
  
  // Phase 1: Match identical tables
  for (const [leftIndex, leftInfo] of leftTableMap) {
    if (leftInfo.matched) continue;
    
    for (const [rightIndex, rightInfo] of rightTableMap) {
      if (rightInfo.matched) continue;
      
      if (areTablesIdentical(leftInfo.table, rightInfo.table)) {
        leftInfo.matched = true;
        rightInfo.matched = true;
        break;
      }
    }
  }
  
  // Phase 2: Match similar tables
  for (const [leftIndex, leftInfo] of leftTableMap) {
    if (leftInfo.matched) continue;
    
    let bestMatch = null;
    let bestSimilarity = 0;
    
    for (const [rightIndex, rightInfo] of rightTableMap) {
      if (rightInfo.matched) continue;
      
      const similarity = getTableSimilarity(leftInfo.table, rightInfo.table);
      if (similarity > bestSimilarity && similarity > 0.5) {
        bestMatch = rightInfo;
        bestSimilarity = similarity;
      }
    }
    
    if (bestMatch) {
      leftInfo.matched = true;
      bestMatch.matched = true;
      
      // Apply detailed table comparison for matched tables
      const { tableAdditions, tableDeletions } = 
        compareTableContents(leftInfo.table, bestMatch.table);
      additions += tableAdditions;
      deletions += tableDeletions;
    }
  }
  
  // Phase 3: Insert placeholders for unmatched tables
  const maxTableCount = Math.max(leftTables.length, rightTables.length);
  
  for (let i = 0; i < maxTableCount; i++) {
    const leftInfo = leftTableMap.get(i);
    const rightInfo = rightTableMap.get(i);
    
    if (leftInfo && !leftInfo.matched) {
      // Table exists in left but not matched in right - add placeholder to right
      const placeholder = createTablePlaceholder(leftInfo.table, 'removed');
      insertPlaceholderAtTablePosition(rightDiv, placeholder, i);
      leftInfo.table.classList.add("structural-removed");
      deletions++;
    }
    
    if (rightInfo && !rightInfo.matched) {
      // Table exists in right but not matched in left - add placeholder to left
      const placeholder = createTablePlaceholder(rightInfo.table, 'added');
      insertPlaceholderAtTablePosition(leftDiv, placeholder, i);
      rightInfo.table.classList.add("structural-added");
      additions++;
    }
  }
  
  return {
    leftWithTables: leftDiv,
    rightWithTables: rightDiv,
    tableSummary: { additions, deletions }
  };
};

// Get table signature for matching
const getTableSignature = (table) => {
  const rows = table.rows ? table.rows.length : 0;
  const cols = table.rows && table.rows[0] ? table.rows[0].cells.length : 0;
  const firstCellText = table.rows && table.rows[0] && table.rows[0].cells[0] 
    ? (table.rows[0].cells[0].textContent || '').trim().substring(0, 50)
    : '';
  
  return {
    rows,
    cols,
    firstCellText,
    totalCells: rows * cols
  };
};

// Check if tables are identical
const areTablesIdentical = (table1, table2) => {
  const sig1 = getTableSignature(table1);
  const sig2 = getTableSignature(table2);
  
  if (sig1.rows !== sig2.rows || sig1.cols !== sig2.cols) return false;
  
  // Compare all cell contents
  for (let r = 0; r < sig1.rows; r++) {
    const row1 = table1.rows[r];
    const row2 = table2.rows[r];
    
    if (!row1 || !row2) return false;
    
    for (let c = 0; c < sig1.cols; c++) {
      const cell1 = row1.cells[c];
      const cell2 = row2.cells[c];
      
      if (!cell1 || !cell2) return false;
      
      const text1 = (cell1.textContent || '').trim();
      const text2 = (cell2.textContent || '').trim();
      
      if (!areTextsEqual(text1, text2)) return false;
    }
  }
  
  return true;
};

// Get table similarity score
const getTableSimilarity = (table1, table2) => {
  const sig1 = getTableSignature(table1);
  const sig2 = getTableSignature(table2);
  
  // Structure similarity
  const structureSimilarity = 
    (sig1.rows === sig2.rows ? 0.3 : 0) + 
    (sig1.cols === sig2.cols ? 0.3 : 0);
  
  // Content similarity
  let contentSimilarity = 0;
  const minRows = Math.min(sig1.rows, sig2.rows);
  const minCols = Math.min(sig1.cols, sig2.cols);
  
  if (minRows > 0 && minCols > 0) {
    let matchingCells = 0;
    let totalCells = 0;
    
    for (let r = 0; r < minRows; r++) {
      const row1 = table1.rows[r];
      const row2 = table2.rows[r];
      
      if (row1 && row2) {
        for (let c = 0; c < minCols; c++) {
          const cell1 = row1.cells[c];
          const cell2 = row2.cells[c];
          
          if (cell1 && cell2) {
            totalCells++;
            const text1 = (cell1.textContent || '').trim();
            const text2 = (cell2.textContent || '').trim();
            
            if (areTextsEqual(text1, text2) || getTextSimilarity(text1, text2) > 0.8) {
              matchingCells++;
            }
          }
        }
      }
    }
    
    contentSimilarity = totalCells > 0 ? (matchingCells / totalCells) * 0.4 : 0;
  }
  
  return structureSimilarity + contentSimilarity;
};

// Insert placeholder at specific table position
const insertPlaceholderAtTablePosition = (container, placeholder, targetIndex) => {
  const allTables = Array.from(container.querySelectorAll('table, .table-placeholder'));
  
  if (targetIndex < allTables.length) {
    // Insert before the target position
    allTables[targetIndex].parentNode.insertBefore(placeholder, allTables[targetIndex]);
  } else if (allTables.length > 0) {
    // Insert after the last table
    const lastTable = allTables[allTables.length - 1];
    lastTable.parentNode.insertBefore(placeholder, lastTable.nextSibling);
  } else {
    // No tables exist, append to container
    container.appendChild(placeholder);
  }
};

// Create improved table placeholder that maintains document structure
const createTablePlaceholder = (originalTable, type) => {
  const placeholder = document.createElement('div');
  placeholder.className = `table-placeholder placeholder-${type}`;
  
  // Calculate approximate dimensions
  let height = '100px';
  let width = '100%';
  
  try {
    const rows = originalTable.rows ? originalTable.rows.length : 3;
    const estimatedRowHeight = 35; // approximate row height
    height = `${Math.max(60, rows * estimatedRowHeight)}px`;
    
    if (originalTable.style.width) {
      width = originalTable.style.width;
    }
  } catch (e) {
    console.warn('Error calculating table dimensions:', e);
  }
  
  // Style the placeholder to maintain layout
  Object.assign(placeholder.style, {
    width,
    minHeight: height,
    border: `2px dashed ${type === 'added' ? '#22c55e' : '#ef4444'}`,
    backgroundColor: type === 'added' ? '#f0fdf4' : '#fef2f2',
    borderRadius: '6px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    margin: originalTable.style.margin || '16px 0',
    padding: '20px',
    opacity: '0.8',
    boxSizing: 'border-box'
  });
  
  // Add descriptive content
  const iconSpan = document.createElement('span');
  iconSpan.style.cssText = `
    font-size: 24px; 
    margin-bottom: 8px;
    color: ${type === 'added' ? '#166534' : '#991b1b'};
  `;
  iconSpan.textContent = type === 'added' ? '📋' : '🗑️';
  
  const textSpan = document.createElement('span');
  textSpan.style.cssText = `
    color: ${type === 'added' ? '#166534' : '#991b1b'};
    font-size: 14px;
    font-weight: 600;
    text-align: center;
  `;
  textSpan.textContent = type === 'added' ? 'Table Added' : 'Table Removed';
  
  const detailSpan = document.createElement('span');
  detailSpan.style.cssText = `
    color: ${type === 'added' ? '#166534' : '#991b1b'};
    font-size: 12px;
    margin-top: 4px;
    opacity: 0.8;
    text-align: center;
  `;
  
  try {
    const rows = originalTable.rows ? originalTable.rows.length : 0;
    const cols = originalTable.rows && originalTable.rows[0] ? originalTable.rows[0].cells.length : 0;
    detailSpan.textContent = `${rows} rows × ${cols} columns`;
  } catch (e) {
    detailSpan.textContent = 'Table structure';
  }
  
  placeholder.appendChild(iconSpan);
  placeholder.appendChild(textSpan);
  placeholder.appendChild(detailSpan);
  
  return placeholder;
};

// Apply content-level comparisons after structural alignment
const applyContentComparison = (leftHtml, rightHtml) => {
  const leftDiv = htmlToDiv(leftHtml);
  const rightDiv = htmlToDiv(rightHtml);
  
  // Apply word-level comparison to text blocks
  const { leftWithText, rightWithText, textSummary } =
    applyMutualWordLevelComparison(leftDiv, rightDiv);
  
  return {
    leftFinal: leftWithText,
    rightFinal: rightWithText,
    contentSummary: textSummary
  };
};

// Block alignment with placeholders (for non-table elements)
const alignBlocksWithPlaceholders = (leftDiv, rightDiv) => {
  const leftBlocks = extractBlocks(leftDiv);
  const rightBlocks = extractBlocks(rightDiv);
  
  let additions = 0, deletions = 0;
  
  // Simple block alignment using diffArrays
  const blockTexts = (blocks) => blocks.map(b => b.text);
  const diff = diffArrays(blockTexts(leftBlocks), blockTexts(rightBlocks));
  
  let leftIndex = 0, rightIndex = 0;
  
  diff.forEach(part => {
    if (part.added) {
      // Blocks added in right - add placeholders to left
      for (let i = 0; i < part.count; i++) {
        const rightBlock = rightBlocks[rightIndex++];
        if (rightBlock) {
          const placeholder = createBlockPlaceholder(rightBlock, 'added');
          insertBlockPlaceholder(leftDiv, placeholder, leftIndex);
          rightBlock.element.classList.add("structural-added");
          additions++;
        }
      }
    } else if (part.removed) {
      // Blocks removed from right - add placeholders to right
      for (let i = 0; i < part.count; i++) {
        const leftBlock = leftBlocks[leftIndex++];
        if (leftBlock) {
          const placeholder = createBlockPlaceholder(leftBlock, 'removed');
          insertBlockPlaceholder(rightDiv, placeholder, rightIndex);
          leftBlock.element.classList.add("structural-removed");
          deletions++;
        }
      }
    } else {
      // Equal blocks - advance both indices
      for (let i = 0; i < part.count; i++) {
        leftIndex++;
        rightIndex++;
      }
    }
  });
  
  return {
    leftWithBlocks: leftDiv,
    rightWithBlocks: rightDiv,
    blockSummary: { additions, deletions }
  };
};

// Create block placeholder
const createBlockPlaceholder = (originalBlock, type) => {
  const placeholder = document.createElement('div');
  placeholder.className = `block-placeholder placeholder-${type}`;
  
  Object.assign(placeholder.style, {
    minHeight: '1.5em',
    border: `1px dashed ${type === 'added' ? '#22c55e' : '#ef4444'}`,
    backgroundColor: type === 'added' ? '#f0fdf4' : '#fef2f2',
    borderRadius: '3px',
    padding: '4px 8px',
    margin: '4px 0',
    opacity: '0.7',
    fontSize: '12px',
    fontStyle: 'italic',
    color: type === 'added' ? '#166534' : '#991b1b'
  });
  
  placeholder.textContent = `[${type === 'added' ? 'Block Added' : 'Block Removed'}: ${originalBlock.tagName.toUpperCase()}]`;
  
  return placeholder;
};

// Insert block placeholder
const insertBlockPlaceholder = (container, placeholder, index) => {
  const blocks = extractBlocks(container);
  if (index < blocks.length) {
    blocks[index].element.parentNode.insertBefore(placeholder, blocks[index].element);
  } else if (blocks.length > 0) {
    const lastBlock = blocks[blocks.length - 1];
    lastBlock.element.parentNode.insertBefore(placeholder, lastBlock.element.nextSibling);
  } else {
    container.appendChild(placeholder);
  }
};

// Rest of the utility functions (keeping existing ones that work well)
const htmlToDiv = (html) => {
  if (!html) return document.createElement("div");
  
  const d = document.createElement("div");
  try {
    d.innerHTML = html;
  } catch (error) {
    console.warn('Error parsing HTML:', error);
  }
  return d;
};

const extractPlainText = (html) => {
  if (!html) return "";
  
  const tempDiv = document.createElement("div");
  try {
    tempDiv.innerHTML = html;
  } catch (error) {
    console.warn('Error extracting plain text:', error);
    return "";
  }
  return tempDiv.textContent || "";
};

const areTextsEqual = (text1, text2) => {
  const normalize = (text) => text.trim().replace(/\s+/g, ' ').toLowerCase();
  return normalize(text1) === normalize(text2);
};

const getTextSimilarity = (text1, text2) => {
  if (!text1 && !text2) return 1;
  if (!text1 || !text2) return 0;
  
  const dmp = new diff_match_patch();
  const diffs = dmp.diff_main(text1, text2);
  
  let totalLength = Math.max(text1.length, text2.length);
  let unchangedLength = 0;
  
  diffs.forEach(diff => {
    if (diff[0] === 0) {
      unchangedLength += diff[1].length;
    }
  });
  
  return totalLength > 0 ? unchangedLength / totalLength : 0;
};

const escapeHtml = (text) => {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
};

// Extract blocks for comparison
const extractBlocks = (container) => {
  const blocks = [];
  const blockElements = container.querySelectorAll('p, h1, h2, h3, h4, h5, h6, div, li');
  
  blockElements.forEach((element, index) => {
    // Skip if element is inside a table, already processed, or is a placeholder
    if (isInsideTable(element) || 
        element.closest('.placeholder-block') ||
        element.classList.contains('table-placeholder') ||
        element.classList.contains('block-placeholder')) {
      return;
    }
    
    const text = (element.textContent || '').trim();
    const tagName = element.tagName.toLowerCase();
    
    if (text) { // Only include blocks with content
      blocks.push({
        element,
        text,
        tagName,
        index,
        id: generateBlockId(element, text, index)
      });
    }
  });
  
  return blocks;
};

const isInsideTable = (node) => {
  let p = node.parentNode;
  while (p) {
    if (p.nodeType === 1) {
      const tag = p.tagName && p.tagName.toLowerCase();
      if (tag === "table" || tag === "thead" || tag === "tbody" || 
          tag === "tr" || tag === "td" || tag === "th") {
        return true;
      }
    }
    p = p.parentNode;
  }
  return false;
};

const generateBlockId = (element, text, index) => {
  const tagName = element.tagName.toLowerCase();
  const textHash = text.substring(0, 50);
  return `${tagName}-${textHash}-${index}`;
};

// Compare table contents cell by cell
const compareTableContents = (leftTable, rightTable) => {
  const leftRows = Array.from(leftTable.rows || []);
  const rightRows = Array.from(rightTable.rows || []);
  
  let additions = 0, deletions = 0;
  
  const maxRows = Math.max(leftRows.length, rightRows.length);
  
  for (let r = 0; r < maxRows; r++) {
    const leftRow = leftRows[r];
    const rightRow = rightRows[r];
    
    if (leftRow && !rightRow) {
      leftRow.classList.add("git-row-removed");
      deletions++;
    } else if (!leftRow && rightRow) {
      rightRow.classList.add("git-row-added");
      additions++;
    } else if (leftRow && rightRow) {
      const leftCells = Array.from(leftRow.cells || []);
      const rightCells = Array.from(rightRow.cells || []);
      const maxCells = Math.max(leftCells.length, rightCells.length);
      
      for (let c = 0; c < maxCells; c++) {
        const leftCell = leftCells[c];
        const rightCell = rightCells[c];
        
        if (leftCell && !rightCell) {
          leftCell.classList.add("git-cell-removed");
          deletions++;
        } else if (!leftCell && rightCell) {
          rightCell.classList.add("git-cell-added");
          additions++;
        } else if (leftCell && rightCell) {
          const leftText = (leftCell.textContent || '').trim();
          const rightText = (rightCell.textContent || '').trim();
          
          if (!areTextsEqual(leftText, rightText)) {
            leftCell.classList.add("git-cell-modified");
            rightCell.classList.add("git-cell-modified");
            
            // Apply word-level highlighting within cells
            applyWordLevelCellDiff(leftCell, leftText, rightText, "left");
            applyWordLevelCellDiff(rightCell, leftText, rightText, "right");
            
            additions++;
            deletions++;
          }
        }
      }
    }
  }
  
  return { tableAdditions: additions, tableDeletions: deletions };
};

// Apply word-level highlighting to table cells
const applyWordLevelCellDiff = (cell, leftText, rightText, side) => {
  const dmp = new diff_match_patch();
  const diffs = dmp.diff_main(leftText || "", rightText || "");
  dmp.diff_cleanupSemantic(diffs);
  
  const highlighted = applyDiffHighlighting(diffs, side);
  cell.innerHTML = highlighted;
};

// Apply diff highlighting for mutual comparison
const applyDiffHighlighting = (diffs, side) => {
  let html = '';
  
  diffs.forEach(diff => {
    const [operation, text] = diff;
    
    if (operation === 0) {
      // Unchanged text
      html += escapeHtml(text);
    } else if (operation === 1) {
      // Added text
      if (side === 'right') {
        html += `<span class="git-inline-added">${escapeHtml(text)}</span>`;
      } else {
        html += `<span class="git-inline-placeholder" style="color: #22c55e; font-style: italic; opacity: 0.7; background: #f0fdf4; padding: 1px 3px; border-radius: 2px;">[+${escapeHtml(text)}]</span>`;
      }
    } else if (operation === -1) {
      // Removed text
      if (side === 'left') {
        html += `<span class="git-inline-removed">${escapeHtml(text)}</span>`;
      } else {
        html += `<span class="git-inline-placeholder" style="color: #ef4444; font-style: italic; opacity: 0.7; background: #fef2f2; padding: 1px 3px; border-radius: 2px;">[-${escapeHtml(text)}]</span>`;
      }
    }
  });
  
  return html;
};

// Mutual word-level comparison using diff-match-patch
const applyMutualWordLevelComparison = (leftDiv, rightDiv) => {
  // Get all text blocks that aren't already highlighted
  const leftBlocks = getTextBlocksForWordComparison(leftDiv);
  const rightBlocks = getTextBlocksForWordComparison(rightDiv);

  let additions = 0, deletions = 0;

  // Align blocks for word-level comparison
  const blockAlignment = alignTextBlocks(leftBlocks, rightBlocks);

  blockAlignment.forEach(({ left, right, type }) => {
    if (type === 'modified' && left && right) {
      const leftText = left.text;
      const rightText = right.text;
      
      // Use diff-match-patch for precise word-level comparison
      const dmp = new diff_match_patch();
      const diffs = dmp.diff_main(leftText, rightText);
      dmp.diff_cleanupSemantic(diffs);
      
      // Apply highlighting to both elements
      const leftHighlighted = applyDiffHighlighting(diffs, 'left');
      const rightHighlighted = applyDiffHighlighting(diffs, 'right');
      
      left.element.innerHTML = leftHighlighted;
      right.element.innerHTML = rightHighlighted;
      
      // Count changes
      diffs.forEach(diff => {
        if (diff[0] === 1) additions++; // Added
        if (diff[0] === -1) deletions++; // Removed
      });
    }
  });

  return {
    leftWithText: leftDiv.innerHTML,
    rightWithText: rightDiv.innerHTML,
    textSummary: { additions, deletions }
  };
};

// Get text blocks suitable for word-level comparison
const getTextBlocksForWordComparison = (container) => {
  const blocks = [];
  const elements = container.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li');
  
  elements.forEach(element => {
    // Skip if already highlighted or inside table or is a placeholder
    if (element.classList.contains('git-line-added') ||
        element.classList.contains('git-line-removed') ||
        element.classList.contains('git-line-modified') ||
        element.classList.contains('placeholder-block') ||
        element.classList.contains('table-placeholder') ||
        element.classList.contains('block-placeholder') ||
        isInsideTable(element)) {
      return;
    }
    
    const text = (element.textContent || '').trim();
    if (text) {
      blocks.push({
        element,
        text,
        tagName: element.tagName.toLowerCase()
      });
    }
  });
  
  return blocks;
};

// Align text blocks for word-level comparison
const alignTextBlocks = (leftBlocks, rightBlocks) => {
  const alignment = [];
  const leftUsed = new Set();
  const rightUsed = new Set();

  // Match blocks by content similarity
  leftBlocks.forEach((leftBlock, leftIndex) => {
    let bestMatch = null;
    let bestSimilarity = 0;
    
    rightBlocks.forEach((rightBlock, rightIndex) => {
      if (rightUsed.has(rightIndex)) return;
      
      if (leftBlock.tagName === rightBlock.tagName) {
        const similarity = getTextSimilarity(leftBlock.text, rightBlock.text);
        if (similarity > bestSimilarity && similarity > 0.3) {
          bestMatch = { block: rightBlock, index: rightIndex, similarity };
          bestSimilarity = similarity;
        }
      }
    });
    
    if (bestMatch) {
      const type = bestMatch.similarity === 1 ? 'equal' : 'modified';
      alignment.push({
        left: leftBlock,
        right: bestMatch.block,
        type
      });
      leftUsed.add(leftIndex);
      rightUsed.add(bestMatch.index);
    }
  });

  return alignment;
};

// Keep existing detailed report generation functions
export const renderHtmlDifferences = (diffs) => {
  return diffs.map((d) => d.content).join("");
};

export const highlightDifferences = (diffs) => {
  return diffs
    .map((diff) => {
      switch (diff.type) {
        case "insert":
          return `<span class=\"diff-insert\">${escapeHtml(
            diff.content
          )}</span>`;
        case "delete":
          return `<span class=\"diff-delete\">${escapeHtml(
            diff.content
          )}</span>`;
        default:
          return escapeHtml(diff.content);
      }
    })
    .join("");
};

// Detailed report generation functions
export const generateDetailedReport = (leftHtml, rightHtml) => {
  const L = htmlToDiv(leftHtml);
  const R = htmlToDiv(rightHtml);

  const leftLines = collectBlockLinesWithFormat(L);
  const rightLines = collectBlockLinesWithFormat(R);

  const leftTexts = leftLines.map((l) => l.text || "");
  const rightTexts = rightLines.map((l) => l.text || "");
  const parts = diffArrays(leftTexts, rightTexts, {
    comparator: (a, b) => areWordsEquivalent(a, b),
  });

  const lines = [];
  let iL = 0,
    iR = 0,
    v1 = 1,
    v2 = 1;

  for (const part of parts) {
    const count = part.count || (part.value ? part.value.length : 0);
    if (part.added) {
      for (let k = 0; k < count; k++) {
        const r = rightLines[iR++];
        if (r && r.text.trim()) {
          lines.push({
            v1: "",
            v2: String(v2++),
            status: "ADDED",
            diffHtml: inlineDiffHtml("", r.text),
            formatChanges: [`added line`],
          });
        }
      }
      continue;
    }
    if (part.removed) {
      for (let k = 0; k < count; k++) {
        const l = leftLines[iL++];
        if (l && l.text.trim()) {
          lines.push({
            v1: String(v1++),
            v2: "",
            status: "REMOVED",
            diffHtml: inlineDiffHtml(l.text, ""),
            formatChanges: [`removed line`],
          });
        }
      }
      continue;
    }
    // unchanged block - may still be formatting-only differences when synced positions differ in formatting
    for (let k = 0; k < count; k++) {
      const l = leftLines[iL++];
      const r = rightLines[iR++];
      if (!l || !r) continue;

      const textEqual = areWordsEquivalent(l.text || "", r.text || "");
      const fmtChanges = compareFormat(l.fmt, r.fmt);

      if (textEqual && fmtChanges.length > 0) {
        lines.push({
          v1: String(v1++),
          v2: String(v2++),
          status: "FORMATTING-ONLY",
          diffHtml: visibleSpaces(escapeHtml(l.text || "")),
          formatChanges: fmtChanges,
        });
      } else if (textEqual) {
        lines.push({
          v1: String(v1++),
          v2: String(v2++),
          status: "UNCHANGED",
          diffHtml: visibleSpaces(escapeHtml(l.text || "")),
          formatChanges: [],
        });
      } else if (l.text.trim() || r.text.trim()) {
        lines.push({
          v1: String(v1++),
          v2: String(v2++),
          status: "MODIFIED",
          diffHtml: inlineDiffHtml(l.text, r.text),
          formatChanges: fmtChanges,
        });
      }
    }
  }

  // Tables report
  const tableReport = [];
  const Lt = Array.from(L.querySelectorAll("table"));
  const Rt = Array.from(R.querySelectorAll("table"));
  const tcount = Math.max(Lt.length, Rt.length);
  for (let ti = 0; ti < tcount; ti++) {
    const TL = Lt[ti],
      TR = Rt[ti];
    if (!TL && TR) {
      tableReport.push({ table: ti + 1, status: "ADDED" });
      continue;
    }
    if (TL && !TR) {
      tableReport.push({ table: ti + 1, status: "REMOVED" });
      continue;
    }
    if (!(TL && TR)) continue;
    const rL = Array.from(TL.rows || []);
    const rR = Array.from(TR.rows || []);
    const rcount = Math.max(rL.length, rR.length);
    for (let ri = 0; ri < rcount; ri++) {
      const rowL = rL[ri],
        rowR = rR[ri];
      if (!rowL && rowR) {
        tableReport.push({ table: ti + 1, row: ri + 1, status: "ADDED" });
        continue;
      }
      if (rowL && !rowR) {
        tableReport.push({ table: ti + 1, row: ri + 1, status: "REMOVED" });
        continue;
      }
      const cL = Array.from(rowL.cells || []);
      const cR = Array.from(rowR.cells || []);
      const ccount = Math.max(cL.length, cR.length);
      for (let ci = 0; ci < ccount; ci++) {
        const cellL = cL[ci],
          cellR = cR[ci];
        if (!cellL && cellR) {
          tableReport.push({
            table: ti + 1,
            row: ri + 1,
            col: ci + 1,
            status: "ADDED",
          });
          continue;
        }
        if (cellL && !cellR) {
          tableReport.push({
            table: ti + 1,
            row: ri + 1,
            col: ci + 1,
            status: "REMOVED",
          });
          continue;
        }
        const a = (cellL.textContent || "").trim();
        const b = (cellR.textContent || "").trim();
        if (a && b && !areWordsEquivalent(a, b)) {
          tableReport.push({
            table: ti + 1,
            row: ri + 1,
            col: ci + 1,
            status: "MODIFIED",
            diffHtml: inlineDiffHtml(a, b),
          });
        }
      }
    }
  }

  // Images report
  const Li = Array.from(L.querySelectorAll("img")).map(
    (i) => i.getAttribute("src") || ""
  );
  const Ri = Array.from(R.querySelectorAll("img")).map(
    (i) => i.getAttribute("src") || ""
  );
  const imgReport = [];
  const imax = Math.max(Li.length, Ri.length);
  for (let i = 0; i < imax; i++) {
    const a = Li[i],
      b = Ri[i];
    if (a && !b) imgReport.push({ index: i + 1, status: "REMOVED", src: a });
    else if (!a && b) imgReport.push({ index: i + 1, status: "ADDED", src: b });
    else if (a && b && a !== b)
      imgReport.push({ index: i + 1, status: "REPLACED", from: a, to: b });
  }

  return { lines, tables: tableReport, images: imgReport };
};

// Simplified detailed report generation
export const generateSimpleDetailedReport = (leftLines, rightLines) => {
  try {
    const lines = [];
    const maxLines = Math.max(leftLines.length, rightLines.length);
    
    for (let i = 0; i < maxLines; i++) {
      const leftLine = leftLines[i];
      const rightLine = rightLines[i];
      
      if (leftLine && rightLine) {
        if (areTextsEqual(leftLine.text, rightLine.text)) {
          lines.push({
            v1: String(i + 1),
            v2: String(i + 1),
            status: "UNCHANGED",
            diffHtml: escapeHtml(leftLine.text),
            formatChanges: []
          });
        } else {
          const diffHtml = createInlineDiff(leftLine.text, rightLine.text);
          lines.push({
            v1: String(i + 1),
            v2: String(i + 1),
            status: "MODIFIED",
            diffHtml,
            formatChanges: ["Content modified"]
          });
        }
      } else if (leftLine && !rightLine) {
        lines.push({
          v1: String(i + 1),
          v2: "",
          status: "REMOVED",
          diffHtml: `<span class="git-inline-removed">${escapeHtml(leftLine.text)}</span>`,
          formatChanges: ["Line removed"]
        });
      } else if (!leftLine && rightLine) {
        lines.push({
          v1: "",
          v2: String(i + 1),
          status: "ADDED",
          diffHtml: `<span class="git-inline-added">${escapeHtml(rightLine.text)}</span>`,
          formatChanges: ["Line added"]
        });
      }
    }

    return { lines, tables: [], images: [] };
  } catch (error) {
    console.error('Error generating detailed report:', error);
    return { lines: [], tables: [], images: [] };
  }
};

// Helper functions for detailed reports
const BLOCK_TAGS = new Set([
  "p", "h1", "h2", "h3", "h4", "h5", "h6", "li", "pre", "div",
]);

const BLOCK_SELECTOR = Array.from(BLOCK_TAGS).join(",");

const extractLineFeatures = (element) => {
  const hasBold = !!element.querySelector("b,strong");
  const hasItalic = !!element.querySelector("i,em");
  const hasUnderline = !!element.querySelector("u");
  const inlineFont =
    element.style && element.style.fontSize ? element.style.fontSize : "";
  let fontSize = inlineFont || "";
  let textAlign =
    element.style && element.style.textAlign ? element.style.textAlign : "";
  
  if (!textAlign) {
    const alignAttr = element.getAttribute && element.getAttribute("align");
    if (alignAttr) textAlign = alignAttr;
  }
  
  return { hasBold, hasItalic, hasUnderline, fontSize, textAlign };
};

const areWordsEquivalent = (word1, word2) => {
  const normalize = (word) => {
    return word
      .replace(/[""'']/g, '"')
      .replace(/[–—]/g, '-')
      .trim()
      .toLowerCase();
  };
  
  return normalize(word1) === normalize(word2);
};

const compareFormat = (fa, fb) => {
  const changes = [];
  if (!!fa.hasBold !== !!fb.hasBold)
    changes.push(
      `bold: ${fa.hasBold ? "on" : "off"} → ${fb.hasBold ? "on" : "off"}`
    );
  if (!!fa.hasItalic !== !!fb.hasItalic)
    changes.push(
      `italic: ${fa.hasItalic ? "on" : "off"} → ${fb.hasItalic ? "on" : "off"}`
    );
  if (!!fa.hasUnderline !== !!fb.hasUnderline)
    changes.push(
      `underline: ${fa.hasUnderline ? "on" : "off"} → ${
        fb.hasUnderline ? "on" : "off"
      }`
    );
  if ((fa.fontSize || "") !== (fb.fontSize || ""))
    changes.push(
      `font-size: ${fa.fontSize || "auto"} → ${fb.fontSize || "auto"}`
    );
  if ((fa.textAlign || "") !== (fb.textAlign || ""))
    changes.push(
      `alignment: ${fa.textAlign || "auto"} → ${fb.textAlign || "auto"}`
    );
  return changes;
};

const visibleSpaces = (s) => {
  if (!s) return "";
  return s
    .replace(/ /g, '<span class="ws">·</span>')
    .replace(/\t/g, '<span class="ws">→</span>');
};

const inlineDiffHtml = (a, b) => {
  const dmp = new diff_match_patch();
  const diffs = dmp.diff_main(a || "", b || "");
  dmp.diff_cleanupSemantic(diffs);
  
  return diffs.map(diff => {
    const [operation, text] = diff;
    const val = visibleSpaces(escapeHtml(text));
    
    if (operation === 1) return `<span class="git-inline-added">${val}</span>`;
    if (operation === -1) return `<span class="git-inline-removed">${val}</span>`;
    return val;
  }).join("");
};

const createInlineDiff = (leftText, rightText) => {
  const dmp = new diff_match_patch();
  const diffs = dmp.diff_main(leftText || "", rightText || "");
  dmp.diff_cleanupSemantic(diffs);
  
  return diffs.map(diff => {
    const [operation, text] = diff;
    const escaped = escapeHtml(text);
    
    if (operation === 1) return `<span class="git-inline-added">${escaped}</span>`;
    if (operation === -1) return `<span class="git-inline-removed">${escaped}</span>`;
    return escaped;
  }).join("");
};

const collectBlockLinesWithFormat = (root) => {
  const blocks = Array.from(root.querySelectorAll(BLOCK_SELECTOR));
  return blocks
    .filter((b) => !isInsideTable(b) && 
                   !b.classList.contains('table-placeholder') && 
                   !b.classList.contains('block-placeholder'))
    .map((el, idx) => {
      const text = el.textContent || "";
      const fmt = extractLineFeatures(el);
      return { index: idx, text, fmt, element: el };
    });
};