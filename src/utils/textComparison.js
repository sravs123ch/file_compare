import { diffChars, diffWordsWithSpace, diffArrays, diffSentences, Diff } from "diff";
import { diff_match_patch } from 'diff-match-patch';

// Enhanced comparison that provides true line-by-line comparison
export const compareHtmlDocuments = (leftHtml, rightHtml) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      try {
        console.log('Starting line-by-line document comparison...');
        
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

        console.log('Documents differ, performing line-by-line comparison...');
        
        // Parse documents into line elements
        const leftLines = parseDocumentIntoLines(leftHtml);
        const rightLines = parseDocumentIntoLines(rightHtml);
        
        console.log(`Left document: ${leftLines.length} lines`);
        console.log(`Right document: ${rightLines.length} lines`);
        
        // Perform line-by-line comparison using LCS algorithm
        const comparison = performLineByLineComparison(leftLines, rightLines);
        
        // Generate aligned HTML with highlighting
        const leftAlignedHtml = generateAlignedHtml(comparison.leftResult, 'left');
        const rightAlignedHtml = generateAlignedHtml(comparison.rightResult, 'right');
        
        const detailed = generateDetailedLineReport(comparison.leftResult, comparison.rightResult);

        const result = {
          leftDiffs: [{ type: "modified", content: leftAlignedHtml }],
          rightDiffs: [{ type: "modified", content: rightAlignedHtml }],
          summary: {
            additions: comparison.stats.additions,
            deletions: comparison.stats.deletions,
            changes: comparison.stats.additions + comparison.stats.deletions
          },
          detailed
        };

        console.log('Line-by-line comparison completed successfully');
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

// Parse document into individual lines (elements)
const parseDocumentIntoLines = (html) => {
  const div = document.createElement('div');
  div.innerHTML = html;
  
  const lines = [];
  let lineNumber = 1;
  
  // Get all meaningful elements that represent "lines" in the document
  const walker = document.createTreeWalker(
    div,
    NodeFilter.SHOW_ELEMENT,
    {
      acceptNode: function(node) {
        const tagName = node.tagName.toLowerCase();
        // Include block elements, images, and table elements as separate lines
        if (['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'div', 'li', 'img', 'table', 'tr'].includes(tagName)) {
          // Skip if it's inside another line element (except for tr inside table)
          let parent = node.parentElement;
          while (parent && parent !== div) {
            const parentTag = parent.tagName.toLowerCase();
            if (['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'div', 'li'].includes(parentTag)) {
              return NodeFilter.FILTER_REJECT;
            }
            if (tagName === 'tr' && parentTag === 'table') {
              break; // Allow tr inside table
            }
            parent = parent.parentElement;
          }
          return NodeFilter.FILTER_ACCEPT;
        }
        return NodeFilter.FILTER_REJECT;
      }
    }
  );
  
  let node;
  while (node = walker.nextNode()) {
    const tagName = node.tagName.toLowerCase();
    let content = '';
    let type = 'text';
    
    if (tagName === 'img') {
      type = 'image';
      content = node.outerHTML;
    } else if (tagName === 'table') {
      type = 'table';
      content = node.outerHTML;
    } else if (tagName === 'tr') {
      type = 'table-row';
      content = node.outerHTML;
    } else {
      type = 'text';
      content = node.outerHTML;
    }
    
    // Only add non-empty lines
    const textContent = node.textContent?.trim() || '';
    if (textContent || type === 'image' || type === 'table') {
      lines.push({
        lineNumber: lineNumber++,
        type: type,
        content: content,
        textContent: textContent,
        tagName: tagName,
        element: node.cloneNode(true)
      });
    }
  }
  
  return lines;
};

// Perform line-by-line comparison using LCS algorithm
const performLineByLineComparison = (leftLines, rightLines) => {
  const leftResult = [];
  const rightResult = [];
  let stats = { additions: 0, deletions: 0, modifications: 0 };
  
  // Create text array for diff algorithm
  const leftTexts = leftLines.map(line => `${line.type}:${line.textContent}`);
  const rightTexts = rightLines.map(line => `${line.type}:${line.textContent}`);
  
  // Use diff library for optimal alignment
  const diff = diffArrays(leftTexts, rightTexts, {
    comparator: (left, right) => {
      // More sophisticated comparison
      if (left === right) return true;
      
      // Extract type and content
      const [leftType, leftContent] = left.split(':', 2);
      const [rightType, rightContent] = right.split(':', 2);
      
      // Same type and similar content
      if (leftType === rightType) {
        // For text, check similarity
        if (leftType === 'text') {
          return areSimilarTexts(leftContent, rightContent);
        }
        // For images, check src
        if (leftType === 'image') {
          return leftContent === rightContent;
        }
        // For tables, check structure
        if (leftType === 'table' || leftType === 'table-row') {
          return leftContent === rightContent;
        }
      }
      
      return false;
    }
  });
  
  let leftIndex = 0;
  let rightIndex = 0;
  let leftLineNum = 1;
  let rightLineNum = 1;
  
  diff.forEach(part => {
    if (part.added) {
      // Lines added in right document
      for (let i = 0; i < part.count; i++) {
        const rightLine = rightLines[rightIndex++];
        if (rightLine) {
          rightResult.push({
            ...rightLine,
            lineNumber: rightLineNum++,
            status: 'added',
            highlightType: 'git-line-added'
          });
          
          // Add placeholder in left
          leftResult.push({
            lineNumber: null,
            type: 'placeholder',
            content: createPlaceholder(rightLine, 'added'),
            textContent: '',
            status: 'placeholder-added',
            highlightType: 'placeholder-added'
          });
          
          stats.additions++;
        }
      }
    } else if (part.removed) {
      // Lines removed from left document
      for (let i = 0; i < part.count; i++) {
        const leftLine = leftLines[leftIndex++];
        if (leftLine) {
          leftResult.push({
            ...leftLine,
            lineNumber: leftLineNum++,
            status: 'removed',
            highlightType: 'git-line-removed'
          });
          
          // Add placeholder in right
          rightResult.push({
            lineNumber: null,
            type: 'placeholder',
            content: createPlaceholder(leftLine, 'removed'),
            textContent: '',
            status: 'placeholder-removed',
            highlightType: 'placeholder-removed'
          });
          
          stats.deletions++;
        }
      }
    } else {
      // Lines that exist in both (unchanged or modified)
      for (let i = 0; i < part.count; i++) {
        const leftLine = leftLines[leftIndex++];
        const rightLine = rightLines[rightIndex++];
        
        if (leftLine && rightLine) {
          const isIdentical = leftLine.content === rightLine.content;
          
          if (isIdentical) {
            // Completely unchanged
            leftResult.push({
              ...leftLine,
              lineNumber: leftLineNum++,
              status: 'unchanged',
              highlightType: 'unchanged'
            });
            
            rightResult.push({
              ...rightLine,
              lineNumber: rightLineNum++,
              status: 'unchanged',
              highlightType: 'unchanged'
            });
          } else {
            // Modified content
            const modifiedLeftContent = leftLine.type === 'text' ? 
              applyInlineHighlighting(leftLine.content, rightLine.content, 'left') : 
              leftLine.content;
              
            const modifiedRightContent = rightLine.type === 'text' ? 
              applyInlineHighlighting(leftLine.content, rightLine.content, 'right') : 
              rightLine.content;
            
            leftResult.push({
              ...leftLine,
              content: modifiedLeftContent,
              lineNumber: leftLineNum++,
              status: 'modified',
              highlightType: 'git-line-modified'
            });
            
            rightResult.push({
              ...rightLine,
              content: modifiedRightContent,
              lineNumber: rightLineNum++,
              status: 'modified',
              highlightType: 'git-line-modified'
            });
            
            stats.modifications++;
          }
        }
      }
    }
  });
  
  return {
    leftResult,
    rightResult,
    stats: {
      additions: stats.additions,
      deletions: stats.deletions,
      modifications: stats.modifications
    }
  };
};

// Create placeholder for missing lines
const createPlaceholder = (originalLine, type) => {
  const isRemoved = type === 'removed';
  const bgColor = isRemoved ? '#fef2f2' : '#f0fdf4';
  const borderColor = isRemoved ? '#ef4444' : '#22c55e';
  const textColor = isRemoved ? '#991b1b' : '#166534';
  const icon = isRemoved ? '🗑️' : '➕';
  const label = isRemoved ? 'Removed' : 'Added';
  
  let placeholderContent = '';
  
  if (originalLine.type === 'image') {
    // Extract image dimensions if available
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = originalLine.content;
    const img = tempDiv.querySelector('img');
    const width = img?.width || img?.style.width || 'auto';
    const height = img?.height || img?.style.height || '100px';
    
    placeholderContent = `
      <div class="image-placeholder placeholder-${type}" style="
        border: 2px dashed ${borderColor};
        background-color: ${bgColor};
        color: ${textColor};
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
      ">
        <span style="font-size: 24px; margin-bottom: 8px;">${icon}</span>
        <span style="font-size: 14px;">Image ${label}</span>
        <span style="font-size: 12px; opacity: 0.8; margin-top: 4px;">${img?.alt || 'Document Image'}</span>
      </div>
    `;
  } else if (originalLine.type === 'table') {
    // Extract table dimensions
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = originalLine.content;
    const table = tempDiv.querySelector('table');
    const rows = table?.rows?.length || 0;
    const cols = table?.rows?.[0]?.cells?.length || 0;
    
    placeholderContent = `
      <div class="table-placeholder placeholder-${type}" style="
        border: 2px dashed ${borderColor};
        background-color: ${bgColor};
        color: ${textColor};
        padding: 20px;
        margin: 16px 0;
        border-radius: 8px;
        text-align: center;
        font-weight: 600;
        min-height: ${Math.max(60, rows * 35)}px;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
      ">
        <span style="font-size: 24px; margin-bottom: 8px;">${icon}</span>
        <span style="font-size: 14px;">Table ${label}</span>
        <span style="font-size: 12px; opacity: 0.8; margin-top: 4px;">${rows} rows × ${cols} columns</span>
      </div>
    `;
  } else {
    // Text placeholder
    const preview = originalLine.textContent.substring(0, 100);
    placeholderContent = `
      <div class="text-placeholder placeholder-${type}" style="
        border: 2px dashed ${borderColor};
        background-color: ${bgColor};
        color: ${textColor};
        padding: 12px 16px;
        margin: 8px 0;
        border-radius: 8px;
        font-weight: 600;
        display: flex;
        align-items: center;
        gap: 8px;
        min-height: 48px;
      ">
        <span style="font-size: 16px;">${icon}</span>
        <span style="font-size: 14px;">Text ${label}: ${preview}${originalLine.textContent.length > 100 ? '...' : ''}</span>
      </div>
    `;
  }
  
  return placeholderContent;
};

// Apply inline highlighting for text differences
const applyInlineHighlighting = (leftContent, rightContent, side) => {
  if (!leftContent || !rightContent) return side === 'left' ? leftContent : rightContent;
  
  // Extract text content for comparison
  const leftDiv = document.createElement('div');
  leftDiv.innerHTML = leftContent;
  const leftText = leftDiv.textContent || '';
  
  const rightDiv = document.createElement('div');
  rightDiv.innerHTML = rightContent;
  const rightText = rightDiv.textContent || '';
  
  if (leftText === rightText) {
    return side === 'left' ? leftContent : rightContent;
  }
  
  // Use diff-match-patch for word-level highlighting
  const dmp = new diff_match_patch();
  const diffs = dmp.diff_main(leftText, rightText);
  dmp.diff_cleanupSemantic(diffs);
  
  // Apply highlighting based on side
  let highlightedText = '';
  diffs.forEach(([op, text]) => {
    const escaped = escapeHtml(text);
    if (op === 0) {
      // Unchanged text
      highlightedText += escaped;
    } else if (op === 1) {
      // Added text
      if (side === 'right') {
        highlightedText += `<span class="git-inline-added">${escaped}</span>`;
      } else {
        // Don't show additions in left side
        highlightedText += '';
      }
    } else if (op === -1) {
      // Removed text
      if (side === 'left') {
        highlightedText += `<span class="git-inline-removed">${escaped}</span>`;
      } else {
        // Don't show removals in right side
        highlightedText += '';
      }
    }
  });
  
  // Replace text content in original HTML structure
  const div = document.createElement('div');
  div.innerHTML = side === 'left' ? leftContent : rightContent;
  
  // Simple text replacement (for basic cases)
  if (div.children.length === 1 && div.children[0].tagName.toLowerCase() === 'p') {
    div.children[0].innerHTML = highlightedText;
    return div.innerHTML;
  }
  
  return side === 'left' ? leftContent : rightContent;
};

// Generate aligned HTML with proper highlighting
const generateAlignedHtml = (lines, side) => {
  let html = '<div class="line-by-line-comparison">';
  
  lines.forEach((line, index) => {
    const lineClass = line.highlightType || 'unchanged';
    const lineNumber = line.lineNumber || '';
    
    html += `
      <div class="comparison-line ${lineClass}" data-line="${lineNumber}" data-side="${side}">
        ${line.content}
      </div>
    `;
  });
  
  html += '</div>';
  return html;
};

// Helper functions
const extractPlainText = (html) => {
  const div = document.createElement('div');
  if (html) div.innerHTML = html;
  return div.textContent || '';
};

const areSimilarTexts = (text1, text2) => {
  if (!text1 || !text2) return false;
  const normalized1 = text1.trim().toLowerCase().replace(/\s+/g, ' ');
  const normalized2 = text2.trim().toLowerCase().replace(/\s+/g, ' ');
  
  // Consider texts similar if they have 80% similarity
  const similarity = calculateSimilarity(normalized1, normalized2);
  return similarity > 0.8;
};

const calculateSimilarity = (str1, str2) => {
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;
  
  if (longer.length === 0) return 1.0;
  
  const editDistance = levenshteinDistance(longer, shorter);
  return (longer.length - editDistance) / longer.length;
};

const levenshteinDistance = (str1, str2) => {
  const matrix = [];
  
  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  
  return matrix[str2.length][str1.length];
};

const escapeHtml = (text) => {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
};

// Generate detailed line report
const generateDetailedLineReport = (leftResult, rightResult) => {
  const lines = [];
  const maxLines = Math.max(leftResult.length, rightResult.length);
  
  for (let i = 0; i < maxLines; i++) {
    const leftLine = leftResult[i];
    const rightLine = rightResult[i];
    
    let status = 'UNCHANGED';
    let diffHtml = '';
    let formatChanges = [];
    
    if (leftLine && rightLine) {
      if (leftLine.status === 'unchanged') {
        status = 'UNCHANGED';
        diffHtml = escapeHtml(leftLine.textContent);
      } else if (leftLine.status === 'modified') {
        status = 'MODIFIED';
        diffHtml = `<span class="git-inline-modified">${escapeHtml(leftLine.textContent)} → ${escapeHtml(rightLine.textContent)}</span>`;
        formatChanges = ['content modified'];
      }
    } else if (leftLine && !rightLine) {
      status = 'REMOVED';
      diffHtml = `<span class="git-inline-removed">${escapeHtml(leftLine.textContent)}</span>`;
      formatChanges = ['line removed'];
    } else if (!leftLine && rightLine) {
      status = 'ADDED';
      diffHtml = `<span class="git-inline-added">${escapeHtml(rightLine.textContent)}</span>`;
      formatChanges = ['line added'];
    }
    
    lines.push({
      v1: leftLine?.lineNumber || '',
      v2: rightLine?.lineNumber || '',
      status,
      diffHtml,
      formatChanges
    });
  }
  
  return {
    lines,
    tables: [], // Simplified for now
    images: []  // Simplified for now
  };
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