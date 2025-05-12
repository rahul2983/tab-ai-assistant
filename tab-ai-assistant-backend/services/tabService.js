const vectorService = require('./vectorService');

/**
 * Process and index a tab's content
 * @param {Object} tabData - Tab data to index
 * @returns {Promise<Object>} - Result of indexing operation
 */
async function indexTab(tabData) {
  try {
    console.log(`Processing tab: ${tabData.title}`);
    
    // Clean and prepare content for indexing
    const processedContent = processTabContent(tabData.content);
    
    // Check if content is substantial enough to index
    if (processedContent.text.length < 50) {
      return { 
        success: false, 
        message: 'Content too short to index',
        id: null
      };
    }

    // Enhance tab content with summaries and reading time
    const enhancedTabData = await enhanceTabContent({
      ...tabData,
      content: processedContent
    });
    
    // If content is very large, split into chunks
    let indexResults = [];
    
    if (processedContent.text.length > 5000) {
      const chunks = chunkText(processedContent.text);
      
      for (let i = 0; i < chunks.length; i++) {
        const chunkData = {
          id: `${tabData.id || generateTabId(tabData.url)}-chunk-${i}`,
          parentId: tabData.id || generateTabId(tabData.url),
          url: tabData.url,
          title: tabData.title,
          content: { text: chunks[i] },
          chunkIndex: i,
          totalChunks: chunks.length,
          timestamp: tabData.timestamp || new Date().toISOString()
        };
        
        const result = await vectorService.indexTabContent(chunkData);
        indexResults.push(result);
      }
      
      return {
        success: true,
        message: `Indexed tab in ${chunks.length} chunks`,
        id: tabData.id || generateTabId(tabData.url),
        chunkCount: chunks.length
      };
    } else {
      // Index as a single document
      const result = await vectorService.indexTabContent({
        ...tabData,
        content: processedContent,
        id: tabData.id || generateTabId(tabData.url),
        timestamp: tabData.timestamp || new Date().toISOString()
      });
      
      return {
        success: true,
        message: 'Tab indexed successfully',
        id: result.id
      };
    }
  } catch (error) {
    console.error('Error indexing tab:', error);
    throw error;
  }
}

/**
 * Process and index multiple tabs
 * @param {Array} tabs - Array of tab data to index
 * @returns {Promise<Array>} - Results of indexing operations
 */
async function syncTabs(tabs) {
  try {
    const results = [];
    
    for (const tab of tabs) {
      try {
        const result = await indexTab(tab);
        results.push({
          url: tab.url,
          title: tab.title,
          success: result.success,
          id: result.id
        });
      } catch (error) {
        results.push({
          url: tab.url,
          title: tab.title,
          success: false,
          error: error.message
        });
      }
    }
    
    return results;
  } catch (error) {
    console.error('Error syncing tabs:', error);
    throw error;
  }
}

/**
 * Remove a tab from the index
 * @param {string} id - ID of the tab to remove
 * @returns {Promise<Object>} - Result of removal operation
 */
async function removeTab(id) {
  try {
    const result = await vectorService.removeTabFromIndex(id);
    
    return {
      success: true,
      message: 'Tab removed from index',
      id: id
    };
  } catch (error) {
    console.error('Error removing tab:', error);
    throw error;
  }
}

/**
 * Clean and process tab content
 * @param {Object} content - Raw tab content
 * @returns {Object} - Processed content
 */
function processTabContent(content) {
  // Extract text content
  let text = '';
  
  if (typeof content === 'string') {
    text = content;
  } else if (content.text) {
    text = content.text;
  } else if (content.html) {
    // If we have HTML, we could use a library to extract text
    // For simplicity, we'll just use the raw HTML text
    text = content.html;
  }
  
  // Clean the text - remove extra whitespace, normalize, etc.
  text = text
    .replace(/\s+/g, ' ')
    .replace(/\n+/g, ' ')
    .trim();
  
  // Get metadata if available
  const meta = content.meta || {};
  
  return {
    text,
    meta
  };
}

/**
 * Split text into smaller chunks for better indexing
 * @param {string} text - Text to chunk
 * @param {number} maxChunkSize - Maximum size of each chunk
 * @param {number} overlap - Number of characters to overlap between chunks
 * @returns {Array} - Array of text chunks
 */
function chunkText(text, maxChunkSize = 1000, overlap = 100) {
  const chunks = [];
  let startPos = 0;
  
  while (startPos < text.length) {
    let endPos = Math.min(startPos + maxChunkSize, text.length);
    
    // If we're not at the end, try to find a good break point
    if (endPos < text.length) {
      // Look for a period, question mark, or exclamation point followed by a space
      const match = text.substring(Math.max(endPos - 50, startPos), Math.min(endPos + 50, text.length)).match(/[.!?]\s/);
      
      if (match) {
        // Adjust endPos to include the punctuation and space
        endPos = Math.max(endPos - 50, startPos) + match.index + 2;
      }
    }
    
    chunks.push(text.substring(startPos, endPos));
    
    // Move start position with overlap
    startPos = Math.max(endPos - overlap, startPos + 1);
  }
  
  return chunks;
}

/**
 * Generate a consistent ID for a tab based on its URL
 * @param {string} url - URL of the tab
 * @returns {string} - Generated ID
 */
function generateTabId(url) {
  // Simple hash function
  let hash = 0;
  for (let i = 0; i < url.length; i++) {
    const char = url.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  
  // Convert to hex string and ensure positive
  return Math.abs(hash).toString(16);
}

// / Add this new function to tabService.js to generate summaries and calculate reading time

/**
 * Enhance tab content with summaries and reading time estimates
 * @param {Object} tabData - Tab data to enhance
 * @returns {Promise<Object>} - Enhanced tab data
 */
async function enhanceTabContent(tabData) {
  try {
    console.log(`Enhancing content for tab: ${tabData.title}`);
    
    // Get the text content
    const text = tabData.content.text || '';
    
    // Calculate reading time (average reading speed is about 200-250 words per minute)
    // We'll use a conservative 200 wpm
    const wordCount = text.split(/\s+/).filter(Boolean).length;
    const readingTimeMinutes = Math.ceil(wordCount / 200);
    
    // Prepare enhanced metadata
    const enhancedMeta = {
      ...(tabData.content.meta || {}),
      wordCount,
      readingTimeMinutes,
      readingTimeText: readingTimeMinutes === 1 
        ? '1 minute read' 
        : `${readingTimeMinutes} minute read`
    };
    
    // If the content is very long, generate a summary using OpenAI
    let summary = null;
    
    if (text.length > 1000) {
      try {
        // Import openaiService to generate summaries
        const openaiService = require('./openaiService');
        
        // Generate a summary (limited to ~2 sentences)
        summary = await openaiService.generateTabSummary(text, tabData.title);
        console.log(`Generated summary for ${tabData.title}: ${summary.substring(0, 100)}...`);
      } catch (summaryError) {
        console.error('Error generating summary:', summaryError);
        // If there's an error, create a simple excerpt
        summary = text.substring(0, 200) + '...';
      }
    } else {
      // For short content, use the first 200 characters as the summary
      summary = text.substring(0, 200) + (text.length > 200 ? '...' : '');
    }
    
    // Return enhanced tab data
    return {
      ...tabData,
      content: {
        text: tabData.content.text,
        meta: enhancedMeta
      },
      summary
    };
  } catch (error) {
    console.error('Error enhancing tab content:', error);
    // Return original tab data if enhancement fails
    return tabData;
  }
}

module.exports = {
  indexTab,
  syncTabs,
  removeTab,
  enhanceTabContent // Add this export
};