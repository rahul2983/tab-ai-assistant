// background.js - Background service worker for tab monitoring and content extraction

// Configuration
const API_ENDPOINT = 'http://localhost:3000/api';
const IGNORED_PROTOCOLS = ['chrome:', 'chrome-extension:', 'file:', 'about:'];
const MAX_CONTENT_LENGTH = 20000; // Characters
const DEBOUNCE_TIME = 3000; // ms before processing tab after update

// Initialize when the extension is installed
chrome.runtime.onInstalled.addListener(() => {
  console.log('Tab AI Assistant installed');
  
  // Set default settings
  chrome.storage.local.set({
    autoIndex: true,
    lastSync: null,
    lastSyncStats: null,
    indexedTabs: {}
  }).then(() => {
    console.log('Default settings initialized');
  }).catch(error => {
    console.error('Error initializing settings:', error);
  });
  
  // Schedule daily sync
  chrome.alarms.create('dailySync', { periodInMinutes: 24 * 60 });
});

// Initialize storage on startup
chrome.runtime.onStartup.addListener(() => {
  console.log('Tab AI Assistant starting up');
  
  // Check if storage is initialized
  chrome.storage.local.get(['indexedTabs', 'lastSync', 'lastSyncStats', 'autoIndex'])
    .then(result => {
      console.log('Checking storage initialization:', result);
      
      // Initialize any missing values
      const updates = {};
      
      if (result.indexedTabs === undefined) {
        updates.indexedTabs = {};
      }
      
      if (result.lastSync === undefined) {
        updates.lastSync = null;
      }
      
      if (result.lastSyncStats === undefined) {
        updates.lastSyncStats = null;
      }
      
      if (result.autoIndex === undefined) {
        updates.autoIndex = true;
      }
      
      // Apply updates if needed
      if (Object.keys(updates).length > 0) {
        console.log('Initializing missing storage values:', updates);
        return chrome.storage.local.set(updates);
      }
    })
    .then(() => {
      console.log('Storage initialization complete');
    })
    .catch(error => {
      console.error('Error during storage initialization:', error);
    });
    
  // Update badge count
  updateBadgeCount();
});

// Track pending tab updates to debounce rapid changes
const pendingTabUpdates = new Map();

// Listen for tab updates
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // Only process when the tab has completed loading
  if (changeInfo.status === 'complete' && tab.url) {
    // Clear any pending update for this tab
    if (pendingTabUpdates.has(tabId)) {
      clearTimeout(pendingTabUpdates.get(tabId));
    }
    
    // Debounce the indexing to avoid processing tabs that quickly redirect
    const timeoutId = setTimeout(() => {
      processTab(tab);
      pendingTabUpdates.delete(tabId);
    }, DEBOUNCE_TIME);
    
    pendingTabUpdates.set(tabId, timeoutId);
  }
});

// Listen for tab removals
chrome.tabs.onRemoved.addListener((tabId, removeInfo) => {
  // Cancel any pending updates
  if (pendingTabUpdates.has(tabId)) {
    clearTimeout(pendingTabUpdates.get(tabId));
    pendingTabUpdates.delete(tabId);
  }
});

// Handle alarms (for scheduled syncs)
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'dailySync') {
    syncAllTabs();
  }
});

// In background.js, update the sendToBackend function to handle timeouts more robustly:

async function sendToBackend(endpoint, data) {
  try {
    console.log(`Sending request to ${API_ENDPOINT}${endpoint}`);

    // Create an AbortController with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

    console.log('Request data:', data);
    
    try {
      const response = await fetch(API_ENDPOINT + endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data),
        signal: controller.signal
      });

      // Clear the timeout
      clearTimeout(timeoutId);
      
      console.log(`Response status: ${response.status}`);
      
      if (!response.ok) {
        throw new Error(`Server responded with ${response.status}: ${response.statusText}`);
      }
      
      const result = await response.json();
      console.log('Response data:', result);
      return result;
    } catch (fetchError) {
      // Clear the timeout to prevent memory leaks
      clearTimeout(timeoutId);
      
      if (fetchError.name === 'AbortError') {
        console.error('Request timed out after 10 seconds');
        return { 
          success: false, 
          error: 'Request timed out after 10 seconds',
          fallback: true 
        };
      }
      
      throw fetchError;
    }
  } catch (error) {
    console.error('Error sending data to backend:', error);
    return { 
      success: false, 
      error: error.message,
      fallback: true 
    };
  }
}

// Check if a URL should be indexed
function isIndexableUrl(url) {
  try {
    const urlObj = new URL(url);
    return !IGNORED_PROTOCOLS.some(protocol => urlObj.protocol.startsWith(protocol));
  } catch (e) {
    console.error('Invalid URL:', url, e);
    return false;
  }
}

// Process a tab for indexing
async function processTab(tab) {
  try {
    // Skip tabs that shouldn't be indexed
    if (!isIndexableUrl(tab.url)) {
      console.log(`Skipping non-indexable URL: ${tab.url}`);
      return { success: false, error: 'Non-indexable URL' };
    }
    
    console.log(`Processing tab: ${tab.title} (${tab.url})`);
    
    // Get settings to check if auto-indexing is enabled
    const settings = await chrome.storage.local.get('autoIndex');
    if (settings.autoIndex === false) {
      console.log('Auto-indexing disabled. Skipping tab indexing.');
      return { success: false, error: 'Auto-indexing disabled' };
    }
    
    // Extract content from the tab
    console.log("Extracting tab content...");
    const content = await extractTabContent(tab.id);
    
    // Check if we have content
    if (!content || !content.text || content.text.trim().length === 0) {
      console.error('No content extracted from tab');
      return { success: false, error: 'No content extracted' };
    }
    
    console.log(`Extracted ${content.text.length} characters of text`);
    
    // Prepare data for backend
    const tabData = {
      url: tab.url,
      title: tab.title,
      content: {
        text: content.text,
        meta: content.meta || {}
      },
      timestamp: new Date().toISOString()
    };
    
    // For debugging: log a sample of the content
    console.log('Content sample:', content.text.substring(0, 100) + '...');
    
    // Send to backend for processing
    console.log('Sending data to backend...');
    const result = await sendToBackend('/index', tabData);
    
    // Fix for the hanging issue in processTab function in background.js

    // The issue might be in how we handle the result from the backend
    // Here's a safer implementation that won't hang when certain fields are missing:

    if (result.success) {
      console.log(`Successfully indexed tab: ${tab.title}`);
      
      // Get current indexed tabs from storage
      const { indexedTabs = {} } = await chrome.storage.local.get('indexedTabs');
      
      // Generate tab ID if not provided by backend
      const tabId = result.id || await generateTabId(tab.url);
      
      // Extract text content safely
      const textContent = content && content.text ? content.text : '';
      
      // Create a simple snippet from the content
      const snippet = textContent.substring(0, 200) + (textContent.length > 200 ? '...' : '');
      
      // Extract summary if available, or use snippet
      let summary = '';
      if (result.summary) {
        summary = result.summary;
      } else if (content && content.summary) {
        summary = content.summary;
      } else {
        summary = snippet;
      }
      
      // Calculate basic reading time
      let readingTime = null;
      if (result.readingTime) {
        readingTime = result.readingTime;
      } else if (textContent) {
        const wordCount = textContent.split(/\s+/).filter(Boolean).length;
        const minutes = Math.ceil(wordCount / 200);
        readingTime = {
          minutes: minutes,
          text: minutes === 1 ? '1 minute read' : `${minutes} minute read`
        };
      } else {
        readingTime = {
          minutes: 0,
          text: 'Unknown length'
        };
      }
      
      // Update the indexed tabs with safe defaults for all fields
      indexedTabs[tabId] = {
        url: tab.url,
        title: tab.title || 'Untitled',
        snippet: snippet,
        summary: summary,
        readingTime: readingTime,
        wordCount: result.wordCount || (textContent ? textContent.split(/\s+/).filter(Boolean).length : 0),
        lastUpdated: new Date().toISOString()
      };
      
      // Save back to storage
      console.log(`Updating storage with indexed tab: ${tabId}`);
      await chrome.storage.local.set({ indexedTabs });
      
      // Get the current count and update badge
      const count = Object.keys(indexedTabs).length;
      console.log(`Updated indexed tabs count: ${count}`);
      updateBadgeCount(count);
      
      return { success: true, id: tabId };
    } else {
      console.error(`Failed to index tab: ${result.message || 'Unknown error'}`);
      return { success: false, error: result.message };
    }
  } catch (error) {
    console.error('Error processing tab:', error);
    return { success: false, error: error.message };
  }
}

// Extract content from a tab using the scripting API
async function extractTabContent(tabId) {
  try {
    console.log(`Extracting content from tab ${tabId}...`);
    
    // First try using the scripting API
    try {
      const [result] = await chrome.scripting.executeScript({
        target: { tabId },
        function: () => {
          // Helper function to clean text
          const cleanText = (text) => {
            if (!text) return '';
            return text
              .replace(/\s+/g, ' ')
              .replace(/\n+/g, ' ')
              .trim();
          };
          
          // Extract main content
          const mainContent = document.body.innerText || '';
          
          // Extract metadata
          const metadata = {
            title: document.title,
            description: '',
            url: window.location.href
          };
          
          // Get meta description
          const descriptionTag = document.querySelector('meta[name="description"]');
          if (descriptionTag) {
            metadata.description = descriptionTag.getAttribute('content');
          }
          
          return {
            text: cleanText(mainContent).substring(0, 50000), // Limit to 50K chars
            meta: metadata
          };
        }
      });
      
      console.log(`Content extraction successful, got ${result.result.text.length} characters`);
      return result.result;
    } catch (scriptingError) {
      console.error('Scripting API failed:', scriptingError);
      
      // Fallback: try messaging the content script
      console.log('Falling back to content script messaging...');
      
      return new Promise((resolve) => {
        chrome.tabs.sendMessage(tabId, { action: 'extractContent' }, (response) => {
          if (chrome.runtime.lastError) {
            console.error('Content script messaging failed:', chrome.runtime.lastError);
            resolve({ text: '', meta: {} });
          } else if (response) {
            console.log(`Content script returned ${response.text?.length || 0} characters`);
            resolve({
              text: response.text || '',
              meta: { title: response.title, url: response.url }
            });
          } else {
            console.error('No response from content script');
            resolve({ text: '', meta: {} });
          }
        });
      });
    }
  } catch (error) {
    console.error('Error extracting content:', error);
    return {
      text: '',
      meta: {}
    };
  }
}

// Generate a consistent ID for a tab based on its URL
async function generateTabId(url) {
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

// Sync all open tabs - triggered manually or by alarm
async function syncAllTabs() {
  try {
    console.log('Starting full tab sync');
    
    // Get all open tabs
    const tabs = await chrome.tabs.query({});
    
    // Filter out non-indexable tabs
    const indexableTabs = tabs.filter(tab => isIndexableUrl(tab.url));
    
    console.log(`Found ${indexableTabs.length} indexable tabs`);
    
    // Process each tab sequentially
    let successCount = 0;
    let errorCount = 0;
    
    // Collect tabs data for batch processing
    const tabsData = [];
    
    for (const tab of indexableTabs) {
      try {
        // Process the tab
        const result = await processTab(tab);
        
        if (result.success) {
          successCount++;
        } else {
          errorCount++;
        }
      } catch (error) {
        console.error(`Error processing tab ${tab.id}:`, error);
        errorCount++;
      }
      
      // Short delay between tabs to avoid overloading
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    // Update sync status
    await chrome.storage.local.set({
      lastSync: new Date().toISOString(),
      lastSyncStats: {
        total: indexableTabs.length,
        success: successCount,
        errors: errorCount
      }
    });
    
    console.log(`Sync complete. Success: ${successCount}, Errors: ${errorCount}`);
    
    // Update badge count
    updateBadgeCount();
    
    return {
      success: true,
      stats: {
        total: indexableTabs.length,
        success: successCount,
        errors: errorCount
      }
    };
  } catch (error) {
    console.error('Error during full sync:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// Update badge with count of indexed tabs
async function updateBadgeCount(count) {
  try {
    if (count === undefined) {
      // Get count from storage if not provided
      const { indexedTabs = {} } = await chrome.storage.local.get('indexedTabs');
      count = Object.keys(indexedTabs).length;
    }
    
    // Convert to string and update badge
    const countStr = count.toString();
    console.log(`Updating badge to: ${countStr}`);
    
    // Use chrome.action for Manifest V3
    await chrome.action.setBadgeText({ text: countStr });
    await chrome.action.setBadgeBackgroundColor({ color: '#4285f4' });
  } catch (error) {
    console.error('Error updating badge:', error);
  }
}

// Listen for messages from popup or content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Message received in background script:', message);
  
  // Handle different message types
  if (message.action === 'syncNow') {
    // Manual sync request from popup
    console.log('Starting sync of all tabs...');
    
    // Use an asynchronous process
    (async () => {
      try {
        const result = await syncAllTabs();
        console.log('Sync complete:', result);
        sendResponse(result);
      } catch (error) {
        console.error('Error syncing tabs:', error);
        sendResponse({ success: false, error: error.message });
      }
    })();
    
    return true; // Keep channel open for async response
  }
  
  else if (message.action === 'indexCurrentTab') {
    // Index current tab request from popup
    console.log('Indexing current tab request received');
    
    // Use an asynchronous process
    (async () => {
      try {
        // If tabId is provided, use that
        if (message.tabId) {
          console.log(`Using provided tabId: ${message.tabId}`);
          
          // Get the tab details if not provided
          let tab;
          if (message.url && message.title) {
            tab = { id: message.tabId, url: message.url, title: message.title };
            console.log('Using provided tab info:', tab);
          } else {
            const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
            if (tabs.length === 0) {
              throw new Error('No active tab found');
            }
            tab = tabs[0];
            console.log('Retrieved tab info:', tab);
          }
          
          // Process the tab
          const result = await processTab(tab);
          console.log('Tab processing result:', result);
          sendResponse(result);
        }
        // Fallback to querying for active tab
        else {
          console.log('No tabId provided, querying for active tab');
          const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
          if (tabs.length === 0) {
            throw new Error('No active tab found');
          }
          
          const tab = tabs[0];
          console.log('Retrieved tab info:', tab);
          
          // Process the tab
          const result = await processTab(tab);
          console.log('Tab processing result:', result);
          sendResponse(result);
        }
      } catch (error) {
        console.error('Error processing tab:', error);
        sendResponse({ success: false, error: error.message });
      }
    })();
    
    return true; // Keep channel open for async response
  }
  
  else if (message.action === 'search') {
    // Handle search request
    console.log('Search request received:', message.query);
    
    (async () => {
      try {
        // Create an AbortController with timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
        
        console.log(`Sending search request to ${API_ENDPOINT}/search`);
        
        try {
          const response = await fetch(`${API_ENDPOINT}/search`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ query: message.query }),
            signal: controller.signal
          });
          
          // Clear the timeout
          clearTimeout(timeoutId);
          
          console.log(`Search response status: ${response.status}`);
          
          if (!response.ok) {
            throw new Error(`Server responded with ${response.status}: ${response.statusText}`);
          }
          
          const result = await response.json();
          console.log('Search results retrieved:', {
            resultsCount: result.results?.length || 0,
            hasAiAnswer: !!result.ai_answer
          });
          
          // Send back the result
          sendResponse(result);
        } catch (fetchError) {
          // Handle abort error specially
          if (fetchError.name === 'AbortError') {
            console.error('Search request timed out after 10 seconds');
            
            // Try fallback approach - use local storage for basic search
            console.log('Falling back to local storage search');
            
            const { indexedTabs = {} } = await chrome.storage.local.get('indexedTabs');
            const queryTerms = message.query.toLowerCase().split(/\s+/).filter(term => term.length > 0);
            
            // Simple search against stored tabs
            const results = Object.values(indexedTabs)
              .filter(tab => {
                const titleLower = (tab.title || '').toLowerCase();
                const snippetLower = (tab.snippet || '').toLowerCase();
                const urlLower = (tab.url || '').toLowerCase();
                
                // Check if all query terms exist in title, snippet or url
                return queryTerms.every(term => 
                  titleLower.includes(term) || 
                  snippetLower.includes(term) || 
                  urlLower.includes(term)
                );
              })
              .map(tab => ({
                id: generateSimpleId(tab.url),
                url: tab.url,
                title: tab.title,
                snippet: tab.snippet || 'No preview available',
                score: 1.0,
                timestamp: tab.lastUpdated
              }));
            
            // Sort by recency
            results.sort((a, b) => {
              const dateA = new Date(a.timestamp || 0);
              const dateB = new Date(b.timestamp || 0);
              return dateB - dateA;
            });
            
            // Generate a simple AI answer
            const aiAnswer = results.length > 0 
              ? `Found ${results.length} tabs matching "${message.query}". The most relevant appears to be "${results[0].title}".`
              : `No tabs found matching "${message.query}".`;
            
            sendResponse({
              success: true,
              results: results,
              ai_answer: aiAnswer,
              source_tabs: results.slice(0, 3),
              fallback: true
            });
          } else {
            // Re-throw if not an abort error
            throw fetchError;
          }
        }
      } catch (error) {
        console.error('Error searching:', error);
        sendResponse({ 
          success: false, 
          error: error.message,
          results: [],
          ai_answer: `Error searching: ${error.message}`
        });
      }
    })();
    
    return true; // Keep channel open for async response
  }
  
  else if (message.action === 'updateSettings') {
    // Update settings from popup
    console.log('Updating settings:', message.settings);
    
    (async () => {
      try {
        await chrome.storage.local.set({ 
          autoIndex: message.settings.autoIndex
        });
        sendResponse({ success: true });
      } catch (error) {
        console.error('Error updating settings:', error);
        sendResponse({ success: false, error: error.message });
      }
    })();
    
    return true; // Keep channel open for async response
  }
  
  else if (message.action === 'search') {
    // Handle search request
    console.log('Search request:', message.query);
    
    (async () => {
      try {
        const result = await sendToBackend('/search', { query: message.query });
        sendResponse(result);
      } catch (error) {
        console.error('Error searching:', error);
        sendResponse({ success: false, error: error.message });
      }
    })();
    
    return true; // Keep channel open for async response
  }
  
  else if (message.action === 'contentCaptured') {
    // Handle content capture from content script
    console.log('Received content from page:', message.content.url);
    // This would normally go to the backend
    sendResponse({ success: true });
    return false; // No async response needed
  }
  
  else if (message.action === 'contentScriptLoaded') {
    // Handle notification that content script has loaded
    console.log('Content script loaded on:', message.url);
    sendResponse({ success: true });
    return false; // No async response needed
  }

  else if (message.action === 'getStats') {
    console.log('Getting stats');
    
    // Use an asynchronous process
    (async () => {
      try {
        // Force refresh of stats from storage - don't use cached values
        let indexedTabsCount = 0;
        let lastSync = null;
        let lastSyncStats = null;
        
        // Get fresh data from storage
        const storageData = await chrome.storage.local.get([
          'indexedTabs', 'lastSync', 'lastSyncStats'
        ]);
        
        console.log('Stats retrieved from storage:', {
          indexedTabsCount: storageData.indexedTabs ? Object.keys(storageData.indexedTabs).length : 0,
          lastSync: storageData.lastSync ? new Date(storageData.lastSync).toISOString() : null
        });
        
        // Calculate indexed tabs count
        if (storageData.indexedTabs) {
          indexedTabsCount = Object.keys(storageData.indexedTabs).length;
        }
        
        // Set other values
        lastSync = storageData.lastSync || null;
        lastSyncStats = storageData.lastSyncStats || null;
        
        // Update badge count
        updateBadgeCount(indexedTabsCount);
        
        // Send the response with all expected properties
        sendResponse({
          indexedTabsCount: indexedTabsCount,
          lastSync: lastSync,
          lastSyncStats: lastSyncStats
        });
      } catch (error) {
        console.error('Error in getStats handler:', error);
        // Still return a valid response even on error
        sendResponse({
          indexedTabsCount: 0,
          lastSync: null,
          lastSyncStats: null,
          error: error.message
        });
      }
    })();
    
    return true; // Keep channel open for async response
  }

  else if (message.action === 'removeTab') {
    // Handle remove tab request
    console.log('Removing tab request received for ID:', message.tabId);
    
    (async () => {
      try {
        // First try to remove from backend
        let backendRemoved = false;
        
        try {
          // Call the backend API to remove the tab
          const response = await fetch(`${API_ENDPOINT}/remove/${message.tabId}`, {
            method: 'DELETE',
            headers: {
              'Content-Type': 'application/json'
            }
          });
          
          if (response.ok) {
            const result = await response.json();
            console.log('Tab removed from backend:', result);
            backendRemoved = true;
          } else {
            console.error('Error removing tab from backend:', response.statusText);
          }
        } catch (backendError) {
          console.error('Error communicating with backend:', backendError);
        }
        
        // Also remove from local storage
        const { indexedTabs = {} } = await chrome.storage.local.get('indexedTabs');
        
        if (indexedTabs[message.tabId]) {
          delete indexedTabs[message.tabId];
          
          // Save back to storage
          await chrome.storage.local.set({ indexedTabs });
          console.log('Tab removed from local storage');
          
          // Update badge count
          updateBadgeCount(Object.keys(indexedTabs).length);
        }
        
        // Send success response
        sendResponse({ 
          success: true, 
          backendRemoved: backendRemoved
        });
      } catch (error) {
        console.error('Error in removeTab handler:', error);
        sendResponse({ success: false, error: error.message });
      }
    })();
    
    return true; // Keep channel open for async response
  }
  
  // Return false for unhandled messages
  console.log('Unhandled message action:', message.action);
  return false;
});

// Helper function to generate a simple ID from a URL
function generateSimpleId(url) {
  let hash = 0;
  for (let i = 0; i < url.length; i++) {
    const char = url.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16);
}