import { diffChars, diffWordsWithSpace, diffArrays, diffSentences, Diff } from "diff";
import { diff_match_patch } from 'diff-match-patch';

// Enhanced comparison that provides precise line-by-line comparison with proper image handling
export const compareHtmlDocuments = (leftHtml, rightHtml) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      try {
        console.log('Starting enhanced line-by-line comparison with proper image handling...');
        
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

        console.log('Documents differ, performing enhanced line-by-line comparison...');
        
        // Parse documents into structured elements
        const leftDoc = parseDocumentStructure(leftHtml);
        const rightDoc = parseDocumentStructure(rightHtml);
        
        // Perform line-by-line comparison with proper alignment
        const comparisonResult = performLineByLineComparison(leftDoc, rightDoc);
        
        // Generate the final HTML with highlighting
        const leftHighlighted = generateHighlightedHtml(comparisonResult.leftElements);
        const rightHighlighted = generateHighlightedHtml(comparisonResult.rightElements);
        
        const detailed = generateEnhancedDetailedReport(comparisonResult);

        const result = {
          leftDiffs: [{ type: "modified", content: leftHighlighted }],
          rightDiffs: [{ type: "modified", content: rightHighlighted }],
          summary: {
            additions: comparisonResult.summary.additions,
            deletions: comparisonResult.summary.deletions,
            changes: comparisonResult.summary.additions + comparisonResult.summary.deletions
          },
          detailed
        };

        console.log('Enhanced line-by-line comparison completed successfully');
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

// Parse document into structured elements for line-by-line comparison
const parseDocumentStructure = (html) => {
  const div = document.createElement('div');
  div.innerHTML = html;
  
  const elements = [];
  let lineNumber = 1;
  
  // Process all elements in document order
  const walker = document.createTreeWalker(
    div,
    NodeFilter.SHOW_ELEMENT,
    {
      acceptNode: function(node) {
        const tagName = node.tagName.toLowerCase();
        // Include all block-level elements and images
        if (['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'div', 'li', 'img', 'table', 'tr', 'td', 'th', 'pre', 'blockquote'].includes(tagName)) {
          return NodeFilter.FILTER_ACCEPT;
        }
        return NodeFilter.FILTER_SKIP;
      }
    }
  );
  
  let node;
  while (node = walker.nextNode()) {
    const element = processElement(node, lineNumber);
    if (element) {
      elements.push(element);
      lineNumber++;
    }
  }
  
  return elements;
};

// Process individual elements into structured format
const processElement = (node, lineNumber) => {
  const tagName = node.tagName.toLowerCase();
  
  if (tagName === 'img') {
    return {
      type: 'image',
      lineNumber,
      content: node.outerHTML,
      text: `[Image: ${node.alt || 'No alt text'}]`,
      src: node.src || '',
      alt: node.alt || '',
      width: node.width || node.style.width || '',
      height: node.height || node.style.height || '',
      element: node.cloneNode(true),
      signature: generateImageSignature(node)
    };
  }
  
  if (tagName === 'table') {
    return {
      type: 'table',
      lineNumber,
      content: node.outerHTML,
      text: extractTableText(node),
      rows: node.rows ? node.rows.length : 0,
      cols: node.rows && node.rows[0] ? node.rows[0].cells.length : 0,
      element: node.cloneNode(true),
      signature: generateTableSignature(node)
    };
  }
  
  if (['tr', 'td', 'th'].includes(tagName)) {
    // Skip individual table elements as they're handled by table processing
    return null;
  }
  
  const text = node.textContent.trim();
  if (!text) return null;
  
  return {
    type: 'text',
    lineNumber,
    content: node.outerHTML,
    text,
    tagName,
    element: node.cloneNode(true),
    signature: generateTextSignature(node)
  };
};

// Generate signatures for matching elements
const generateImageSignature = (img) => {
  return {
    src: img.src || '',
    alt: img.alt || '',
    width: img.width || img.style.width || '',
    height: img.height || img.style.height || ''
  };
};

const generateTableSignature = (table) => {
  const firstCellText = table.rows && table.rows[0] && table.rows[0].cells[0] 
    ? table.rows[0].cells[0].textContent.trim().substring(0, 50) 
    : '';
  return {
    rows: table.rows ? table.rows.length : 0,
    cols: table.rows && table.rows[0] ? table.rows[0].cells.length : 0,
    firstCell: firstCellText
  };
};

const generateTextSignature = (element) => {
  return {
    text: element.textContent.trim(),
    tagName: element.tagName.toLowerCase(),
    className: element.className || ''
  };
};

// Perform line-by-line comparison with proper alignment
const performLineByLineComparison = (leftElements, rightElements) => {
  const leftResult = [];
  const rightResult = [];
  let additions = 0;
  let deletions = 0;
  
  // Create alignment using LCS algorithm
  const alignment = createOptimalAlignment(leftElements, rightElements);
  
  alignment.forEach(pair => {
    const [leftIdx, rightIdx] = pair;
    const leftElement = leftIdx !== null ? leftElements[leftIdx] : null;
    const rightElement = rightIdx !== null ? rightElements[rightIdx] : null;
    
    if (leftElement && rightElement) {
      // Both elements exist - compare them
      if (elementsAreEqual(leftElement, rightElement)) {
        // Elements are identical
        leftResult.push({
          ...leftElement,
          status: 'unchanged',
          highlightType: 'none'
        });
        rightResult.push({
          ...rightElement,
          status: 'unchanged',
          highlightType: 'none'
        });
      } else {
        // Elements are different - modified
        const comparison = compareElements(leftElement, rightElement);
        leftResult.push({
          ...leftElement,
          status: 'modified',
          highlightType: 'modified',
          comparison
        });
        rightResult.push({
          ...rightElement,
          status: 'modified',
          highlightType: 'modified',
          comparison
        });
        additions++;
        deletions++;
      }
    } else if (leftElement && !rightElement) {
      // Element removed
      leftResult.push({
        ...leftElement,
        status: 'removed',
        highlightType: 'removed'
      });
      rightResult.push(createPlaceholder(leftElement, 'removed'));
      deletions++;
    } else if (!leftElement && rightElement) {
      // Element added
      leftResult.push(createPlaceholder(rightElement, 'added'));
      rightResult.push({
        ...rightElement,
        status: 'added',
        highlightType: 'added'
      });
      additions++;
    }
  });
  
  return {
    leftElements: leftResult,
    rightElements: rightResult,
    summary: { additions, deletions }
  };
};

// Create optimal alignment using dynamic programming (LCS-based)
const createOptimalAlignment = (leftElements, rightElements) => {
  const m = leftElements.length;
  const n = rightElements.length;
  
  // Create DP table for LCS
  const dp = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));
  
  // Fill DP table
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (elementsAreEqual(leftElements[i - 1], rightElements[j - 1])) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }
  
  // Backtrack to create alignment
  const alignment = [];
  let i = m, j = n;
  
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && elementsAreEqual(leftElements[i - 1], rightElements[j - 1])) {
      alignment.unshift([i - 1, j - 1]);
      i--;
      j--;
    } else if (i > 0 && (j === 0 || dp[i - 1][j] >= dp[i][j - 1])) {
      alignment.unshift([i - 1, null]);
      i--;
    } else {
      alignment.unshift([null, j - 1]);
      j--;
    }
  }
  
  return alignment;
};

// Check if two elements are equal
const elementsAreEqual = (left, right) => {
  if (!left || !right) return false;
  if (left.type !== right.type) return false;
  
  switch (left.type) {
    case 'image':
      return left.signature.src === right.signature.src && 
             left.signature.alt === right.signature.alt;
    case 'table':
      return left.signature.rows === right.signature.rows &&
             left.signature.cols === right.signature.cols &&
             left.signature.firstCell === right.signature.firstCell;
    case 'text':
      return normalizeText(left.text) === normalizeText(right.text) &&
             left.tagName === right.tagName;
    default:
      return false;
  }
};

// Compare two different elements
const compareElements = (left, right) => {
  if (left.type === 'text' && right.type === 'text') {
    const dmp = new diff_match_patch();
    const diffs = dmp.diff_main(left.text, right.text);
    dmp.diff_cleanupSemantic(diffs);
    return {
      type: 'text_diff',
      diffs,
      leftText: left.text,
      rightText: right.text
    };
  }
  
  return {
    type: 'element_diff',
    leftType: left.type,
    rightType: right.type,
    leftContent: left.content,
    rightContent: right.content
  };
};

// Create placeholder for missing elements
const createPlaceholder = (originalElement, placeholderType) => {
  const placeholder = {
    type: 'placeholder',
    originalType: originalElement.type,
    placeholderType,
    lineNumber: originalElement.lineNumber,
    status: placeholderType,
    highlightType: placeholderType
  };
  
  switch (originalElement.type) {
    case 'image':
      placeholder.content = createImagePlaceholderHtml(originalElement, placeholderType);
      placeholder.text = `[${placeholderType.toUpperCase()} IMAGE: ${originalElement.alt || 'No alt text'}]`;
      break;
    case 'table':
      placeholder.content = createTablePlaceholderHtml(originalElement, placeholderType);
      placeholder.text = `[${placeholderType.toUpperCase()} TABLE: ${originalElement.rows}x${originalElement.cols}]`;
      break;
    case 'text':
      placeholder.content = createTextPlaceholderHtml(originalElement, placeholderType);
      placeholder.text = `[${placeholderType.toUpperCase()}: ${originalElement.text.substring(0, 50)}...]`;
      break;
    default:
      placeholder.content = `<div class="placeholder-${placeholderType}">[${placeholderType.toUpperCase()} ELEMENT]</div>`;
      placeholder.text = `[${placeholderType.toUpperCase()} ELEMENT]`;
  }
  
  return placeholder;
};

// Create HTML placeholders for different element types
const createImagePlaceholderHtml = (imageElement, type) => {
  const width = imageElement.width || '200px';
  const height = imageElement.height || '150px';
  const borderColor = type === 'removed' ? '#ef4444' : '#22c55e';
  const bgColor = type === 'removed' ? '#fef2f2' : '#f0fdf4';
  const textColor = type === 'removed' ? '#991b1b' : '#166534';
  const icon = type === 'removed' ? '🗑️' : '➕';
  const label = type === 'removed' ? 'Image Removed' : 'Image Added';
  
  return `
    <div class="image-placeholder placeholder-${type}" style="
      border: 2px dashed ${borderColor};
      background-color: ${bgColor};
      color: ${textColor};
      width: ${width};
      height: ${height};
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      margin: 16px 0;
      border-radius: 8px;
      font-weight: 600;
      text-align: center;
      box-sizing: border-box;
    ">
      <span style="font-size: 24px; margin-bottom: 8px;">${icon}</span>
      <span style="font-size: 14px; margin-bottom: 4px;">${label}</span>
      <span style="font-size: 12px; opacity: 0.8;">${imageElement.alt || 'Document Image'}</span>
    </div>
  `;
};

const createTablePlaceholderHtml = (tableElement, type) => {
  const borderColor = type === 'removed' ? '#ef4444' : '#22c55e';
  const bgColor = type === 'removed' ? '#fef2f2' : '#f0fdf4';
  const textColor = type === 'removed' ? '#991b1b' : '#166534';
  const icon = type === 'removed' ? '🗑️' : '➕';
  const label = type === 'removed' ? 'Table Removed' : 'Table Added';
  
  return `
    <div class="table-placeholder placeholder-${type}" style="
      border: 2px dashed ${borderColor};
      background-color: ${bgColor};
      color: ${textColor};
      min-height: 80px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      margin: 16px 0;
      border-radius: 8px;
      font-weight: 600;
      text-align: center;
      padding: 20px;
    ">
      <span style="font-size: 24px; margin-bottom: 8px;">${icon}</span>
      <span style="font-size: 14px; margin-bottom: 4px;">${label}</span>
      <span style="font-size: 12px; opacity: 0.8;">${tableElement.rows} rows × ${tableElement.cols} columns</span>
    </div>
  `;
};

const createTextPlaceholderHtml = (textElement, type) => {
  const borderColor = type === 'removed' ? '#ef4444' : '#22c55e';
  const bgColor = type === 'removed' ? '#fef2f2' : '#f0fdf4';
  const textColor = type === 'removed' ? '#991b1b' : '#166534';
  const icon = type === 'removed' ? '➖' : '➕';
  const label = type === 'removed' ? 'Text Removed' : 'Text Added';
  
  return `
    <div class="text-placeholder placeholder-${type}" style="
      border: 2px dashed ${borderColor};
      background-color: ${bgColor};
      color: ${textColor};
      min-height: 40px;
      display: flex;
      align-items: center;
      margin: 4px 0;
      border-radius: 6px;
      font-weight: 600;
      padding: 8px 12px;
      gap: 8px;
    ">
      <span>${icon}</span>
      <span style="font-size: 14px;">${label}: ${textElement.text.substring(0, 80)}${textElement.text.length > 80 ? '...' : ''}</span>
    </div>
  `;
};

// Generate highlighted HTML from processed elements
const generateHighlightedHtml = (elements) => {
  return elements.map(element => {
    if (element.type === 'placeholder') {
      return element.content;
    }
    
    let html = element.content;
    
    // Apply highlighting based on status
    switch (element.status) {
      case 'added':
        html = applyLineHighlighting(html, 'added');
        break;
      case 'removed':
        html = applyLineHighlighting(html, 'removed');
        break;
      case 'modified':
        if (element.comparison && element.comparison.type === 'text_diff') {
          html = applyInlineTextDiff(element.comparison.diffs, element.element);
        } else {
          html = applyLineHighlighting(html, 'modified');
        }
        break;
      case 'unchanged':
      default:
        // No highlighting for unchanged elements
        break;
    }
    
    return html;
  }).join('\n');
};

// Apply line-level highlighting
const applyLineHighlighting = (html, type) => {
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = html;
  const element = tempDiv.firstElementChild;
  
  if (!element) return html;
  
  element.classList.add(`git-line-${type}`);
  
  switch (type) {
    case 'added':
      element.style.backgroundColor = '#f0fdf4';
      element.style.borderLeft = '4px solid #22c55e';
      element.style.padding = '8px 12px';
      element.style.margin = '4px 0';
      element.style.borderRadius = '6px';
      element.style.boxShadow = '0 2px 8px rgba(34, 197, 94, 0.15)';
      break;
    case 'removed':
      element.style.backgroundColor = '#fef2f2';
      element.style.borderLeft = '4px solid #ef4444';
      element.style.padding = '8px 12px';
      element.style.margin = '4px 0';
      element.style.borderRadius = '6px';
      element.style.boxShadow = '0 2px 8px rgba(239, 68, 68, 0.15)';
      element.style.textDecoration = 'line-through';
      element.style.opacity = '0.8';
      break;
    case 'modified':
      element.style.backgroundColor = '#fffbeb';
      element.style.borderLeft = '4px solid #f59e0b';
      element.style.padding = '8px 12px';
      element.style.margin = '4px 0';
      element.style.borderRadius = '6px';
      element.style.boxShadow = '0 2px 8px rgba(245, 158, 11, 0.15)';
      break;
  }
  
  return tempDiv.innerHTML;
};

// Apply inline text differences
const applyInlineTextDiff = (diffs, originalElement) => {
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = originalElement.outerHTML;
  const element = tempDiv.firstElementChild;
  
  if (!element) return originalElement.outerHTML;
  
  // Apply modified line styling
  element.classList.add('git-line-modified');
  element.style.backgroundColor = '#fffbeb';
  element.style.borderLeft = '4px solid #f59e0b';
  element.style.padding = '8px 12px';
  element.style.margin = '4px 0';
  element.style.borderRadius = '6px';
  element.style.boxShadow = '0 2px 8px rgba(245, 158, 11, 0.15)';
  
  // Apply inline diff highlighting
  let diffHtml = '';
  diffs.forEach(([op, text]) => {
    const escaped = escapeHtml(text);
    if (op === 0) {
      diffHtml += escaped;
    } else if (op === 1) {
      diffHtml += `<span class="git-inline-added" style="background: linear-gradient(90deg, #dcfce7 0%, #bbf7d0 100%); color: #166534; padding: 2px 6px; border-radius: 4px; font-weight: 600; border: 1px solid #86efac;">${escaped}</span>`;
    } else if (op === -1) {
      diffHtml += `<span class="git-inline-removed" style="background: linear-gradient(90deg, #fecaca 0%, #fca5a5 100%); color: #991b1b; padding: 2px 6px; border-radius: 4px; font-weight: 600; border: 1px solid #f87171; text-decoration: line-through;">${escaped}</span>`;
    }
  });
  
  element.innerHTML = diffHtml;
  return tempDiv.innerHTML;
};

// Generate enhanced detailed report
const generateEnhancedDetailedReport = (comparisonResult) => {
  const lines = [];
  const tables = [];
  const images = [];
  
  let leftLineNum = 1;
  let rightLineNum = 1;
  
  // Process all elements for detailed report
  const maxElements = Math.max(
    comparisonResult.leftElements.length, 
    comparisonResult.rightElements.length
  );
  
  for (let i = 0; i < maxElements; i++) {
    const leftElement = comparisonResult.leftElements[i];
    const rightElement = comparisonResult.rightElements[i];
    
    if (leftElement && rightElement) {
      if (leftElement.type === 'placeholder' || rightElement.type === 'placeholder') {
        // Handle placeholder cases
        const realElement = leftElement.type !== 'placeholder' ? leftElement : rightElement;
        const isRemoved = leftElement.type !== 'placeholder';
        
        lines.push({
          v1: isRemoved ? leftLineNum++ : '',
          v2: isRemoved ? '' : rightLineNum++,
          status: isRemoved ? 'REMOVED' : 'ADDED',
          diffHtml: escapeHtml(realElement.text || ''),
          formatChanges: [isRemoved ? 'element removed' : 'element added']
        });
        
        if (realElement.type === 'image') {
          images.push({
            src: realElement.src || 'unknown',
            alt: realElement.alt || 'no alt',
            status: isRemoved ? 'REMOVED' : 'ADDED',
            index: images.length + 1
          });
        } else if (realElement.type === 'table') {
          tables.push({
            table: tables.length + 1,
            status: isRemoved ? 'REMOVED' : 'ADDED',
            rows: realElement.rows,
            cols: realElement.cols
          });
        }
      } else {
        // Both elements exist
        const status = leftElement.status === 'unchanged' ? 'UNCHANGED' : 
                      leftElement.status === 'modified' ? 'MODIFIED' : 'UNCHANGED';
        
        let diffHtml = escapeHtml(rightElement.text || '');
        if (rightElement.comparison && rightElement.comparison.type === 'text_diff') {
          diffHtml = generateInlineDiffHtml(rightElement.comparison.diffs);
        }
        
        lines.push({
          v1: leftLineNum++,
          v2: rightLineNum++,
          status,
          diffHtml,
          formatChanges: status === 'MODIFIED' ? ['content modified'] : []
        });
        
        if (leftElement.type === 'image' && rightElement.type === 'image') {
          if (status === 'MODIFIED') {
            images.push({
              src: rightElement.src || 'unknown',
              alt: rightElement.alt || 'no alt',
              status: 'MODIFIED',
              index: images.length + 1
            });
          }
        } else if (leftElement.type === 'table' && rightElement.type === 'table') {
          if (status === 'MODIFIED') {
            tables.push({
              table: tables.length + 1,
              status: 'MODIFIED',
              rows: rightElement.rows,
              cols: rightElement.cols
            });
          }
        }
      }
    }
  }
  
  return { lines, tables, images };
};

// Helper functions
const extractPlainText = (html) => {
  const div = document.createElement('div');
  if (html) div.innerHTML = html;
  return div.textContent || '';
};

const extractTableText = (table) => {
  const rows = Array.from(table.rows || []);
  return rows.map(row => {
    const cells = Array.from(row.cells || []);
    return cells.map(cell => cell.textContent.trim()).join(' | ');
  }).join('\n');
};

const normalizeText = (text) => {
  return text.trim().replace(/\s+/g, ' ').toLowerCase();
};

const escapeHtml = (text) => {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
};

const generateInlineDiffHtml = (diffs) => {
  return diffs.map(([op, text]) => {
    const escaped = escapeHtml(text);
    if (op === 0) return escaped;
    if (op === 1) return `<span class="git-inline-added">${escaped}</span>`;
    if (op === -1) return `<span class="git-inline-removed">${escaped}</span>`;
    return escaped;
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