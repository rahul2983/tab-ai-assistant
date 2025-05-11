// popup.js - Make sure stats are loaded when popup opens

// Elements
let queryInput;
let searchBtn;
let indexTabBtn;
let syncTabsBtn;
let indexedCount;
let lastSync;
let settingsToggle;
let settingsContainer;
let autoIndexToggle;
let saveSettingsBtn;

// Initialize UI elements and load data when popup opens
document.addEventListener('DOMContentLoaded', function() {
  console.log('Popup opened - initializing');
  
  // Get UI elements
  queryInput = document.getElementById('query-input');
  searchBtn = document.getElementById('search-btn');
  indexTabBtn = document.getElementById('index-tab-btn');
  syncTabsBtn = document.getElementById('sync-tabs-btn');
  indexedCount = document.getElementById('indexed-count');
  lastSync = document.getElementById('last-sync');
  settingsToggle = document.getElementById('settings-toggle');
  settingsContainer = document.getElementById('settings-container');
  autoIndexToggle = document.getElementById('auto-index');
  saveSettingsBtn = document.getElementById('save-settings-btn');
  
  // Check if all elements were found
  if (!queryInput || !searchBtn || !indexTabBtn || !syncTabsBtn || 
      !indexedCount || !lastSync || !settingsToggle || !settingsContainer || 
      !autoIndexToggle || !saveSettingsBtn) {
    console.error('Some DOM elements not found. Check your HTML structure.');
  }
  
  // Load current stats immediately
  loadStats();
  
  // Load settings
  loadSettings();
  
  // Set up event listeners
  setupEventListeners();
});

// Set up all event listeners
function setupEventListeners() {
  // Search button
  if (searchBtn) {
    searchBtn.addEventListener('click', performSearch);
  }
  
  // Index tab button
  if (indexTabBtn) {
    indexTabBtn.addEventListener('click', indexCurrentTab);
  }
  
  // Sync tabs button
  if (syncTabsBtn) {
    syncTabsBtn.addEventListener('click', syncAllTabs);
  }
  
  // Settings toggle
  if (settingsToggle) {
    settingsToggle.addEventListener('click', toggleSettings);
  }
  
  // Save settings button
  if (saveSettingsBtn) {
    saveSettingsBtn.addEventListener('click', saveSettings);
  }
  
  // Enter key for search
  if (queryInput) {
    queryInput.addEventListener('keypress', function(e) {
      if (e.key === 'Enter') {
        performSearch();
      }
    });
  }
}

// Function to load stats with better error handling
function loadStats() {
  console.log('Loading stats...');
  
  // Show loading indicators
  if (indexedCount) indexedCount.textContent = '...';
  if (lastSync) lastSync.textContent = '...';
  
  chrome.runtime.sendMessage({ action: 'getStats' }, function(response) {
    console.log('Stats response:', response);
    
    // Check if we got a valid response
    if (!response) {
      console.error('No response from background script');
      if (indexedCount) indexedCount.textContent = '0';
      if (lastSync) lastSync.textContent = 'Never';
      return;
    }
    
    try {
      // Handle indexedTabsCount - use default if missing
      if (indexedCount) {
        indexedCount.textContent = (response.indexedTabsCount !== undefined) 
          ? response.indexedTabsCount 
          : '0';
      }
      
      // Handle lastSync - format if present, use default if missing
      if (lastSync) {
        if (response.lastSync) {
          const lastSyncDate = new Date(response.lastSync);
          const now = new Date();
          const diffMs = now - lastSyncDate;
          const diffMins = Math.floor(diffMs / (1000 * 60));
          
          if (diffMins < 60) {
            lastSync.textContent = `${diffMins} minutes ago`;
          } else {
            const diffHours = Math.floor(diffMins / 60);
            if (diffHours < 24) {
              lastSync.textContent = `${diffHours} hours ago`;
            } else {
              const diffDays = Math.floor(diffHours / 24);
              lastSync.textContent = `${diffDays} days ago`;
            }
          }
        } else {
          lastSync.textContent = 'Never';
        }
      }
    } catch (error) {
      console.error('Error handling stats response:', error);
      // Set defaults on error
      if (indexedCount) indexedCount.textContent = '0';
      if (lastSync) lastSync.textContent = 'Never';
    }
  });
}

// Function to load settings
function loadSettings() {
  if (!autoIndexToggle) return;
  
  chrome.storage.local.get(['autoIndex'], function(result) {
    console.log('Settings loaded:', result);
    autoIndexToggle.checked = result.autoIndex !== false; // Default to true
  });
}

// Function to perform search
function performSearch() {
  if (!queryInput) return;
  
  const query = queryInput.value.trim();
  if (!query) return;
  
  // Open search results page
  chrome.tabs.create({
    url: `search.html?q=${encodeURIComponent(query)}`
  });
}

// Function to index current tab
function indexCurrentTab() {
  if (!indexTabBtn) return;
  
  indexTabBtn.textContent = 'Indexing...';
  indexTabBtn.disabled = true;
  
  // Get the current tab
  chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
    if (tabs && tabs.length > 0) {
      const currentTab = tabs[0];
      console.log('Indexing current tab:', currentTab.url);
      
      // Send message to background script
      chrome.runtime.sendMessage({ 
        action: 'indexCurrentTab',
        tabId: currentTab.id,
        url: currentTab.url,
        title: currentTab.title
      }, function(response) {
        console.log('Background script response:', response);
        
        if (response && response.success) {
          indexTabBtn.textContent = 'Indexed!';
          
          // Refresh stats immediately
          loadStats();
          
          // Reset button after a delay
          setTimeout(() => {
            indexTabBtn.textContent = 'Index Current Tab';
            indexTabBtn.disabled = false;
          }, 2000);
        } else {
          // Show error with more details
          const errorMsg = response && response.error ? response.error : 'Unknown error';
          indexTabBtn.textContent = 'Error: ' + errorMsg.substring(0, 10) + '...';
          console.error('Error indexing tab:', errorMsg);
          
          // Reset button after a delay
          setTimeout(() => {
            indexTabBtn.textContent = 'Index Current Tab';
            indexTabBtn.disabled = false;
          }, 3000);
        }
      });
    } else {
      indexTabBtn.textContent = 'No active tab';
      console.error('No active tab found');
      
      // Reset button after a delay
      setTimeout(() => {
        indexTabBtn.textContent = 'Index Current Tab';
        indexTabBtn.disabled = false;
      }, 2000);
    }
  });
}

// Function to sync all tabs
function syncAllTabs() {
  if (!syncTabsBtn) return;
  
  syncTabsBtn.textContent = 'Syncing...';
  syncTabsBtn.disabled = true;
  
  chrome.runtime.sendMessage({ action: 'syncNow' }, function(response) {
    console.log('Sync response:', response);
    
    if (response && response.success) {
      syncTabsBtn.textContent = `Synced ${response.stats.success} tabs`;
      
      // Refresh stats immediately
      loadStats();
      
      // Reset button after a delay
      setTimeout(() => {
        syncTabsBtn.textContent = 'Sync All Tabs';
        syncTabsBtn.disabled = false;
      }, 2000);
    } else {
      syncTabsBtn.textContent = 'Error';
      console.error('Error syncing tabs:', response ? response.error : 'Unknown error');
      
      // Reset button after a delay
      setTimeout(() => {
        syncTabsBtn.textContent = 'Sync All Tabs';
        syncTabsBtn.disabled = false;
      }, 2000);
    }
  });
}

// Function to toggle settings visibility
function toggleSettings(e) {
  if (!settingsContainer || !settingsToggle) return;
  
  e.preventDefault();
  
  if (settingsContainer.classList.contains('visible')) {
    settingsContainer.classList.remove('visible');
    settingsToggle.textContent = 'Show Settings';
  } else {
    settingsContainer.classList.add('visible');
    settingsToggle.textContent = 'Hide Settings';
  }
}

// Function to save settings
function saveSettings() {
  if (!saveSettingsBtn || !autoIndexToggle) return;
  
  const settings = {
    autoIndex: autoIndexToggle.checked
  };
  
  console.log('Saving settings:', settings);
  
  saveSettingsBtn.textContent = 'Saving...';
  saveSettingsBtn.disabled = true;
  
  chrome.runtime.sendMessage({ 
    action: 'updateSettings',
    settings: settings
  }, function(response) {
    console.log('Settings save response:', response);
    
    if (response && response.success) {
      saveSettingsBtn.textContent = 'Saved!';
      
      // Reset button after a delay
      setTimeout(() => {
        saveSettingsBtn.textContent = 'Save Settings';
        saveSettingsBtn.disabled = false;
      }, 2000);
    } else {
      saveSettingsBtn.textContent = 'Error';
      console.error('Error saving settings:', response ? response.error : 'Unknown error');
      
      // Reset button after a delay
      setTimeout(() => {
        saveSettingsBtn.textContent = 'Save Settings';
        saveSettingsBtn.disabled = false;
      }, 2000);
    }
  });
}