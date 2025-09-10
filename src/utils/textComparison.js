import DiffMatchPatch from 'diff-match-patch';

// Enhanced comparison function that creates detailed diff with proper image and text handling
export const compareHtmlDocuments = async (leftHtml, rightHtml) => {
  console.log("Starting enhanced comparison with proper image and text handling...");
  
  try {
    // Parse HTML documents
    const leftDoc = parseHtmlDocument(leftHtml);
    const rightDoc = parseHtmlDocument(rightHtml);
    
    // Compare images first
    const imageComparison = compareImages(leftDoc.images, rightDoc.images);
    
    // Compare tables
    const tableComparison = compareTables(leftDoc.tables, rightDoc.tables);
    
    // Compare text content line by line
    const textComparison = compareTextLineByLine(leftDoc.textContent, rightDoc.textContent);
    
    // Create enhanced diffs for both documents
    const leftDiffs = createLeftDocumentDiffs(leftDoc, imageComparison, tableComparison, textComparison);
    const rightDiffs = createRightDocumentDiffs(rightDoc, imageComparison, tableComparison, textComparison);
    
    // Calculate summary statistics
    const summary = calculateSummary(imageComparison, tableComparison, textComparison);
    
    console.log("Comparison completed successfully");
    
    return {
      leftDiffs,
      rightDiffs,
      summary,
      detailed: {
        lines: textComparison.detailedLines,
        tables: tableComparison.changes,
        images: imageComparison.changes
      }
    };
  } catch (error) {
    console.error("Comparison failed:", error);
    throw error;
  }
};

// Parse HTML document into structured components
const parseHtmlDocument = (html) => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  
  // Extract images with their dimensions and positions
  const images = Array.from(doc.querySelectorAll('img')).map((img, index) => ({
    index,
    src: img.src,
    alt: img.alt || 'Document image',
    width: img.style.width || img.getAttribute('width') || 'auto',
    height: img.style.height || img.getAttribute('height') || 'auto',
    style: img.getAttribute('style') || '',
    outerHTML: img.outerHTML,
    position: getElementPosition(img)
  }));
  
  // Extract tables with their structure
  const tables = Array.from(doc.querySelectorAll('table')).map((table, index) => ({
    index,
    outerHTML: table.outerHTML,
    rows: Array.from(table.querySelectorAll('tr')).map(row => 
      Array.from(row.querySelectorAll('td, th')).map(cell => cell.textContent.trim())
    ),
    position: getElementPosition(table)
  }));
  
  // Extract text content line by line, preserving structure
  const textContent = extractTextLines(doc.body);
  
  return {
    images,
    tables,
    textContent,
    originalHtml: html
  };
};

// Get element position in document
const getElementPosition = (element) => {
  let position = 0;
  let current = element;
  while (current.previousSibling) {
    current = current.previousSibling;
    position++;
  }
  return position;
};

// Extract text content line by line
const extractTextLines = (element) => {
  const lines = [];
  const walker = document.createTreeWalker(
    element,
    NodeFilter.SHOW_TEXT,
    null,
    false
  );
  
  let node;
  while (node = walker.nextNode()) {
    const text = node.textContent.trim();
    if (text) {
      const textLines = text.split('\n').filter(line => line.trim());
      lines.push(...textLines);
    }
  }
  
  return lines;
};

// Compare images between documents
const compareImages = (leftImages, rightImages) => {
  const changes = [];
  const matched = new Set();
  
  // Find matching images (same src or similar alt text)
  leftImages.forEach((leftImg, leftIndex) => {
    const matchIndex = rightImages.findIndex((rightImg, rightIndex) => 
      !matched.has(rightIndex) && (
        leftImg.src === rightImg.src || 
        (leftImg.alt === rightImg.alt && leftImg.alt !== 'Document image')
      )
    );
    
    if (matchIndex !== -1) {
      matched.add(matchIndex);
      const rightImg = rightImages[matchIndex];
      
      // Check if image properties changed
      if (leftImg.width !== rightImg.width || 
          leftImg.height !== rightImg.height || 
          leftImg.style !== rightImg.style) {
        changes.push({
          type: 'modified',
          leftIndex,
          rightIndex: matchIndex,
          leftImage: leftImg,
          rightImage: rightImg
        });
      } else {
        changes.push({
          type: 'unchanged',
          leftIndex,
          rightIndex: matchIndex,
          leftImage: leftImg,
          rightImage: rightImg
        });
      }
    } else {
      changes.push({
        type: 'removed',
        leftIndex,
        leftImage: leftImg
      });
    }
  });
  
  // Find new images in right document
  rightImages.forEach((rightImg, rightIndex) => {
    if (!matched.has(rightIndex)) {
      changes.push({
        type: 'added',
        rightIndex,
        rightImage: rightImg
      });
    }
  });
  
  return { changes };
};

// Compare tables between documents
const compareTables = (leftTables, rightTables) => {
  const changes = [];
  const matched = new Set();
  
  leftTables.forEach((leftTable, leftIndex) => {
    const matchIndex = rightTables.findIndex((rightTable, rightIndex) => 
      !matched.has(rightIndex) && tablesAreSimilar(leftTable, rightTable)
    );
    
    if (matchIndex !== -1) {
      matched.add(matchIndex);
      const rightTable = rightTables[matchIndex];
      const tableDiff = compareTableContent(leftTable, rightTable);
      
      changes.push({
        type: tableDiff.hasChanges ? 'modified' : 'unchanged',
        leftIndex,
        rightIndex: matchIndex,
        leftTable,
        rightTable,
        cellChanges: tableDiff.cellChanges
      });
    } else {
      changes.push({
        type: 'removed',
        leftIndex,
        leftTable
      });
    }
  });
  
  rightTables.forEach((rightTable, rightIndex) => {
    if (!matched.has(rightIndex)) {
      changes.push({
        type: 'added',
        rightIndex,
        rightTable
      });
    }
  });
  
  return { changes };
};

// Check if tables are similar enough to be considered the same table
const tablesAreSimilar = (table1, table2) => {
  if (table1.rows.length !== table2.rows.length) return false;
  if (table1.rows[0]?.length !== table2.rows[0]?.length) return false;
  
  // Check if at least 50% of cells are similar
  let similarCells = 0;
  let totalCells = 0;
  
  for (let i = 0; i < table1.rows.length; i++) {
    for (let j = 0; j < table1.rows[i].length; j++) {
      totalCells++;
      if (table1.rows[i][j] === table2.rows[i][j]) {
        similarCells++;
      }
    }
  }
  
  return (similarCells / totalCells) >= 0.5;
};

// Compare table content cell by cell
const compareTableContent = (leftTable, rightTable) => {
  const cellChanges = [];
  let hasChanges = false;
  
  const maxRows = Math.max(leftTable.rows.length, rightTable.rows.length);
  
  for (let i = 0; i < maxRows; i++) {
    const leftRow = leftTable.rows[i] || [];
    const rightRow = rightTable.rows[i] || [];
    const maxCols = Math.max(leftRow.length, rightRow.length);
    
    for (let j = 0; j < maxCols; j++) {
      const leftCell = leftRow[j] || '';
      const rightCell = rightRow[j] || '';
      
      if (leftCell !== rightCell) {
        hasChanges = true;
        cellChanges.push({
          row: i,
          col: j,
          leftContent: leftCell,
          rightContent: rightCell,
          type: !leftCell ? 'added' : !rightCell ? 'removed' : 'modified'
        });
      }
    }
  }
  
  return { hasChanges, cellChanges };
};

// Compare text content line by line with word-level precision
const compareTextLineByLine = (leftLines, rightLines) => {
  const dmp = new DiffMatchPatch();
  const detailedLines = [];
  const changes = [];
  
  const maxLines = Math.max(leftLines.length, rightLines.length);
  
  for (let i = 0; i < maxLines; i++) {
    const leftLine = leftLines[i] || '';
    const rightLine = rightLines[i] || '';
    
    if (leftLine === rightLine) {
      detailedLines.push({
        v1: i + 1,
        v2: i + 1,
        status: 'UNCHANGED',
        leftContent: leftLine,
        rightContent: rightLine,
        diffHtml: leftLine
      });
    } else {
      // Create word-level diff for the line
      const diff = dmp.diff_main(leftLine, rightLine);
      dmp.diff_cleanupSemantic(diff);
      
      const diffHtml = diff.map(([operation, text]) => {
        switch (operation) {
          case 1: // Insert
            return `<span class="git-inline-added">${escapeHtml(text)}</span>`;
          case -1: // Delete
            return `<span class="git-inline-removed">${escapeHtml(text)}</span>`;
          default: // Equal
            return escapeHtml(text);
        }
      }).join('');
      
      const status = !leftLine ? 'ADDED' : !rightLine ? 'REMOVED' : 'MODIFIED';
      
      detailedLines.push({
        v1: leftLine ? i + 1 : null,
        v2: rightLine ? i + 1 : null,
        status,
        leftContent: leftLine,
        rightContent: rightLine,
        diffHtml
      });
      
      changes.push({
        lineNumber: i + 1,
        type: status.toLowerCase(),
        leftContent: leftLine,
        rightContent: rightLine,
        diffHtml
      });
    }
  }
  
  return { detailedLines, changes };
};

// Create diffs for left document (original)
const createLeftDocumentDiffs = (leftDoc, imageComparison, tableComparison, textComparison) => {
  let html = leftDoc.originalHtml;
  
  // Apply image highlighting
  imageComparison.changes.forEach(change => {
    if (change.type === 'removed' && change.leftImage) {
      const placeholder = createImagePlaceholder(change.leftImage, 'removed');
      html = html.replace(change.leftImage.outerHTML, placeholder);
    }
  });
  
  // Apply text line highlighting
  textComparison.changes.forEach(change => {
    if (change.type === 'removed' || change.type === 'modified') {
      // Highlight removed or modified lines in left document
      const lineRegex = new RegExp(escapeRegex(change.leftContent), 'g');
      html = html.replace(lineRegex, `<div class="git-line-removed">${change.leftContent}</div>`);
    }
  });
  
  return html;
};

// Create diffs for right document (modified) with enhanced highlighting
const createRightDocumentDiffs = (rightDoc, imageComparison, tableComparison, textComparison) => {
  let html = rightDoc.originalHtml;
  
  // Apply image highlighting
  imageComparison.changes.forEach(change => {
    if (change.type === 'added' && change.rightImage) {
      const highlightedImage = `<div class="git-line-added">
        <div class="git-line-added::before"></div>
        ${change.rightImage.outerHTML}
        <div class="image-change-label">NEW IMAGE</div>
      </div>`;
      html = html.replace(change.rightImage.outerHTML, highlightedImage);
    } else if (change.type === 'removed' && change.leftImage) {
      // Show placeholder for removed image with same dimensions
      const placeholder = createImagePlaceholder(change.leftImage, 'removed');
      // Insert placeholder at appropriate position
      html = insertPlaceholderAtPosition(html, placeholder, change.leftImage.position);
    } else if (change.type === 'unchanged' && change.rightImage) {
      // Don't highlight unchanged images
      // Keep original image as is
    }
  });
  
  // Apply table highlighting
  tableComparison.changes.forEach(change => {
    if (change.type === 'added' && change.rightTable) {
      const highlightedTable = `<div class="git-line-added">
        <div class="table-change-label">NEW TABLE</div>
        ${change.rightTable.outerHTML}
      </div>`;
      html = html.replace(change.rightTable.outerHTML, highlightedTable);
    } else if (change.type === 'removed' && change.leftTable) {
      const placeholder = createTablePlaceholder(change.leftTable, 'removed');
      html = insertPlaceholderAtPosition(html, placeholder, change.leftTable.position);
    } else if (change.type === 'modified' && change.rightTable) {
      // Highlight modified table with cell-level changes
      let modifiedTable = change.rightTable.outerHTML;
      change.cellChanges.forEach(cellChange => {
        // Apply cell-level highlighting based on change type
        const cellClass = `cell-${cellChange.type}`;
        // This would require more complex DOM manipulation
      });
      html = html.replace(change.rightTable.outerHTML, 
        `<div class="git-line-modified">${modifiedTable}</div>`);
    }
  });
  
  // Apply text line highlighting with word-level precision
  textComparison.changes.forEach(change => {
    if (change.type === 'added') {
      const highlightedLine = `<div class="git-line-added">${change.rightContent}</div>`;
      const lineRegex = new RegExp(escapeRegex(change.rightContent), 'g');
      html = html.replace(lineRegex, highlightedLine);
    } else if (change.type === 'removed') {
      // Show placeholder for removed line
      const placeholder = createTextPlaceholder(change.leftContent, 'removed');
      html = insertPlaceholderAtPosition(html, placeholder, change.lineNumber);
    } else if (change.type === 'modified') {
      // Show modified line with word-level highlighting
      const highlightedLine = `<div class="git-line-modified">${change.diffHtml}</div>`;
      const lineRegex = new RegExp(escapeRegex(change.rightContent), 'g');
      html = html.replace(lineRegex, highlightedLine);
    }
  });
  
  return html;
};

// Create image placeholder with same dimensions
const createImagePlaceholder = (originalImage, type) => {
  const typeClass = type === 'removed' ? 'placeholder-removed' : 'placeholder-added';
  const icon = type === 'removed' ? '🗑️' : '➕';
  const text = type === 'removed' ? 'Image Removed' : 'Image Added';
  
  return `<div class="git-line-placeholder ${typeClass}" style="
    width: ${originalImage.width};
    height: ${originalImage.height};
    min-height: 100px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    border: 2px dashed;
    border-radius: 8px;
    margin: 8px 0;
    padding: 16px;
    text-align: center;
    font-weight: 600;
    gap: 8px;
  ">
    <div style="font-size: 24px;">${icon}</div>
    <div style="font-size: 14px; font-weight: 600;">${text}</div>
    <div style="font-size: 12px; opacity: 0.8;">${originalImage.alt}</div>
    <div style="font-size: 11px; opacity: 0.6;">
      Original size: ${originalImage.width} × ${originalImage.height}
    </div>
  </div>`;
};

// Create table placeholder
const createTablePlaceholder = (originalTable, type) => {
  const typeClass = type === 'removed' ? 'placeholder-removed' : 'placeholder-added';
  const icon = type === 'removed' ? '🗑️' : '➕';
  const text = type === 'removed' ? 'Table Removed' : 'Table Added';
  
  return `<div class="git-line-placeholder ${typeClass}" style="
    min-height: 80px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    border: 2px dashed;
    border-radius: 8px;
    margin: 8px 0;
    padding: 16px;
    text-align: center;
    font-weight: 600;
    gap: 8px;
  ">
    <div style="font-size: 24px;">${icon}</div>
    <div style="font-size: 14px; font-weight: 600;">${text}</div>
    <div style="font-size: 12px; opacity: 0.8;">
      ${originalTable.rows.length} rows × ${originalTable.rows[0]?.length || 0} columns
    </div>
  </div>`;
};

// Create text placeholder
const createTextPlaceholder = (originalText, type) => {
  const typeClass = type === 'removed' ? 'placeholder-removed' : 'placeholder-added';
  const icon = type === 'removed' ? '🗑️' : '➕';
  const text = type === 'removed' ? 'Text Removed' : 'Text Added';
  const preview = originalText.length > 50 ? originalText.substring(0, 50) + '...' : originalText;
  
  return `<div class="git-line-placeholder ${typeClass}" style="
    min-height: 40px;
    display: flex;
    align-items: center;
    border: 2px dashed;
    border-radius: 6px;
    margin: 4px 0;
    padding: 8px 12px;
    font-weight: 600;
    gap: 8px;
  ">
    <div style="font-size: 16px;">${icon}</div>
    <div style="flex: 1;">
      <div style="font-size: 12px; font-weight: 600;">${text}</div>
      <div style="font-size: 11px; opacity: 0.8; font-style: italic;">"${preview}"</div>
    </div>
  </div>`;
};

// Insert placeholder at specific position
const insertPlaceholderAtPosition = (html, placeholder, position) => {
  // This is a simplified implementation
  // In a real scenario, you'd need more sophisticated DOM manipulation
  return html + placeholder;
};

// Calculate summary statistics
const calculateSummary = (imageComparison, tableComparison, textComparison) => {
  const imageChanges = imageComparison.changes.filter(c => c.type !== 'unchanged').length;
  const tableChanges = tableComparison.changes.filter(c => c.type !== 'unchanged').length;
  const textChanges = textComparison.changes.length;
  
  const additions = imageComparison.changes.filter(c => c.type === 'added').length +
                   tableComparison.changes.filter(c => c.type === 'added').length +
                   textComparison.changes.filter(c => c.type === 'added').length;
                   
  const deletions = imageComparison.changes.filter(c => c.type === 'removed').length +
                   tableComparison.changes.filter(c => c.type === 'removed').length +
                   textComparison.changes.filter(c => c.type === 'removed').length;
  
  return {
    changes: imageChanges + tableChanges + textChanges,
    additions,
    deletions
  };
};

// Render HTML differences for display
export const renderHtmlDifferences = (diffsHtml) => {
  return diffsHtml || '';
};

// Utility functions
const escapeHtml = (text) => {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
};

const escapeRegex = (string) => {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};