// tab-ai-assistant-backend/services/historyService.js
const config = require('../config/config');
const fs = require('fs');
const path = require('path');

// Path for storing history (for file-based storage)
const HISTORY_PATH = path.join(__dirname, '../data/tab-history.json');

// Initialize history storage
let historyStore = [];
const MAX_HISTORY_ITEMS = 500; // Limit history size

// Initialize storage
function initializeStorage() {
  try {
    // Create directory if it doesn't exist
    const dir = path.dirname(HISTORY_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    // Create file if it doesn't exist
    if (!fs.existsSync(HISTORY_PATH)) {
      fs.writeFileSync(HISTORY_PATH, JSON.stringify([]));
    }
    
    // Load existing history
    const historyData = fs.readFileSync(HISTORY_PATH, 'utf8');
    historyStore = JSON.parse(historyData);
    
    console.log(`History service initialized, loaded ${historyStore.length} history items`);
  } catch (error) {
    console.error('Error initializing history storage:', error);
    historyStore = [];
  }
}

// Initialize on service load
initializeStorage();

/**
 * Record a tab closure in history
 * @param {Object} tabData - Data for the closed tab
 * @returns {Promise<Object>} - Recorded history item
 */
async function recordTabClosure(tabData) {
  try {
    console.log(`Recording tab closure: ${tabData.title}`);
    
    if (!tabData || !tabData.url) {
      throw new Error('Tab data is required');
    }
    
    // Prepare history item
    const historyItem = {
      id: Date.now().toString(36) + Math.random().toString(36).substring(2, 5),
      url: tabData.url,
      title: tabData.title || 'Untitled',
      snippet: tabData.snippet || '',
      summary: tabData.summary || null,
      closedAt: new Date().toISOString(),
      originalTabId: tabData.id || null
    };
    
    // Add to history store (at the beginning)
    historyStore.unshift(historyItem);
    
    // Trim history if too large
    if (historyStore.length > MAX_HISTORY_ITEMS) {
      historyStore = historyStore.slice(0, MAX_HISTORY_ITEMS);
    }
    
    // Save to file
    await saveHistoryToFile();
    
    return historyItem;
  } catch (error) {
    console.error('Error recording tab closure:', error);
    throw error;
  }
}

/**
 * Get tab history with optional filtering
 * @param {Object} options - Filter options
 * @param {number} options.limit - Maximum number of items to return
 * @param {string} options.query - Search query
 * @param {string} options.startDate - Start date for filtering
 * @param {string} options.endDate - End date for filtering
 * @returns {Promise<Array>} - Array of history items
 */
async function getTabHistory(options = {}) {
  try {
    console.log('Getting tab history with options:', options);
    
    const limit = options.limit || 100;
    const query = options.query ? options.query.toLowerCase() : '';
    const startDate = options.startDate ? new Date(options.startDate) : null;
    const endDate = options.endDate ? new Date(options.endDate) : null;
    
    // Filter history items
    let filteredHistory = [...historyStore];
    
    // Filter by search query
    if (query) {
      filteredHistory = filteredHistory.filter(item => 
        item.title.toLowerCase().includes(query) ||
        item.url.toLowerCase().includes(query) ||
        (item.snippet && item.snippet.toLowerCase().includes(query))
      );
    }
    
    // Filter by date range
    if (startDate) {
      filteredHistory = filteredHistory.filter(item => 
        new Date(item.closedAt) >= startDate
      );
    }
    
    if (endDate) {
      filteredHistory = filteredHistory.filter(item => 
        new Date(item.closedAt) <= endDate
      );
    }
    
    // Apply limit
    return filteredHistory.slice(0, limit);
  } catch (error) {
    console.error('Error getting tab history:', error);
    throw error;
  }
}

/**
 * Get a specific history item by ID
 * @param {string} historyId - ID of the history item
 * @returns {Promise<Object>} - History item
 */
async function getHistoryItem(historyId) {
  try {
    console.log(`Getting history item: ${historyId}`);
    
    // Find item by ID
    const item = historyStore.find(item => item.id === historyId);
    
    if (!item) {
      throw new Error('History item not found');
    }
    
    return item;
  } catch (error) {
    console.error('Error getting history item:', error);
    throw error;
  }
}

/**
 * Delete a history item
 * @param {string} historyId - ID of the history item to delete
 * @returns {Promise<boolean>} - Success flag
 */
async function deleteHistoryItem(historyId) {
  try {
    console.log(`Deleting history item: ${historyId}`);
    
    // Find item index
    const itemIndex = historyStore.findIndex(item => item.id === historyId);
    
    if (itemIndex === -1) {
      return false;
    }
    
    // Remove item
    historyStore.splice(itemIndex, 1);
    
    // Save to file
    await saveHistoryToFile();
    
    return true;
  } catch (error) {
    console.error('Error deleting history item:', error);
    throw error;
  }
}

/**
 * Clear all history
 * @returns {Promise<boolean>} - Success flag
 */
async function clearHistory() {
  try {
    console.log('Clearing all history');
    
    // Reset history store
    historyStore = [];
    
    // Save to file
    await saveHistoryToFile();
    
    return true;
  } catch (error) {
    console.error('Error clearing history:', error);
    throw error;
  }
}

/**
 * Save history to file
 * @private
 * @returns {Promise<void>}
 */
async function saveHistoryToFile() {
  try {
    await fs.promises.writeFile(HISTORY_PATH, JSON.stringify(historyStore, null, 2));
  } catch (error) {
    console.error('Error saving history to file:', error);
    throw error;
  }
}

module.exports = {
  recordTabClosure,
  getTabHistory,
  getHistoryItem,
  deleteHistoryItem,
  clearHistory
};