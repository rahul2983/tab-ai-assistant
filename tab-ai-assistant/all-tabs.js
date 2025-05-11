// all-tabs.js - Display and manage all indexed tabs

document.addEventListener('DOMContentLoaded', function() {
    console.log('All tabs page initialized');
    
    // Elements
    const filterInput = document.getElementById('filter-input');
    const filterBtn = document.getElementById('filter-btn');
    const syncAllBtn = document.getElementById('sync-all-btn');
    const sortBySelect = document.getElementById('sort-by');
    const tabsList = document.getElementById('tabs-list');
    const displayedCount = document.getElementById('displayed-count');
    const totalCount = document.getElementById('total-count');
    
    // Store all tabs data
    let allTabs = [];
    let filteredTabs = [];
    
    // Load tabs on page load
    loadAllTabs();
    
    // Set up event listeners
    filterBtn.addEventListener('click', function() {
      filterTabs(filterInput.value.trim());
    });
    
    filterInput.addEventListener('keypress', function(e) {
      if (e.key === 'Enter') {
        filterTabs(filterInput.value.trim());
      }
    });
    
    syncAllBtn.addEventListener('click', function() {
      syncAllTabs();
    });
    
    sortBySelect.addEventListener('change', function() {
      sortTabs(sortBySelect.value);
    });
    
    // Load all indexed tabs from storage
    async function loadAllTabs() {
      try {
        tabsList.innerHTML = '<div class="loading">Loading indexed tabs...</div>';
        
        // Get indexed tabs from storage
        chrome.storage.local.get(['indexedTabs'], function(result) {
          if (chrome.runtime.lastError) {
            showError('Error loading tabs: ' + chrome.runtime.lastError.message);
            return;
          }
          
          const indexedTabs = result.indexedTabs || {};
          allTabs = Object.entries(indexedTabs).map(([id, tab]) => ({
            id: id,
            url: tab.url,
            title: tab.title || 'Untitled',
            snippet: tab.snippet || 'No preview available',
            lastUpdated: tab.lastUpdated || new Date().toISOString()
          }));
          
          console.log(`Loaded ${allTabs.length} indexed tabs`);
          
          // Update total count
          totalCount.textContent = allTabs.length;
          
          // Initially sort by most recent
          sortTabs('recent');
          
          // Display all tabs initially (no filter)
          filterTabs('');
        });
      } catch (error) {
        console.error('Error loading tabs:', error);
        showError('Error loading tabs: ' + error.message);
      }
    }
    
    // Filter tabs based on search text
    function filterTabs(filterText) {
      if (!filterText) {
        // No filter, show all tabs
        filteredTabs = [...allTabs];
      } else {
        const filterLower = filterText.toLowerCase();
        
        // Filter tabs by title, URL, or snippet
        filteredTabs = allTabs.filter(tab => 
          tab.title.toLowerCase().includes(filterLower) ||
          tab.url.toLowerCase().includes(filterLower) ||
          tab.snippet.toLowerCase().includes(filterLower)
        );
      }
      
      // Update displayed count
      displayedCount.textContent = filteredTabs.length;
      
      // Apply current sort
      sortTabs(sortBySelect.value);
    }
    
    // Sort tabs based on selected sort method
    function sortTabs(sortMethod) {
      switch (sortMethod) {
        case 'recent':
          // Sort by last updated (most recent first)
          filteredTabs.sort((a, b) => new Date(b.lastUpdated) - new Date(a.lastUpdated));
          break;
        case 'oldest':
          // Sort by last updated (oldest first)
          filteredTabs.sort((a, b) => new Date(a.lastUpdated) - new Date(b.lastUpdated));
          break;
        case 'alphabetical':
          // Sort alphabetically by title
          filteredTabs.sort((a, b) => a.title.localeCompare(b.title));
          break;
      }
      
      // Render tabs
      renderTabs();
    }
    
    // Render tabs to the list
    function renderTabs() {
      if (filteredTabs.length === 0) {
        tabsList.innerHTML = `
          <div class="empty-state">
            <p>No tabs found${filterInput.value ? ' matching "' + filterInput.value + '"' : ''}</p>
            <p>Try a different filter or index more tabs.</p>
          </div>
        `;
        return;
      }
      
      const tabsHtml = filteredTabs.map(tab => `
        <div class="tab-card" data-id="${tab.id}">
          <div class="title">
            <a href="${tab.url}" target="_blank" title="${tab.title}">${tab.title}</a>
          </div>
          <div class="url" title="${tab.url}">${formatUrl(tab.url)}</div>
          <div class="snippet">${tab.snippet}</div>
          <div class="timestamp">Indexed: ${formatTimestamp(tab.lastUpdated)}</div>
          <div class="actions">
            <button class="btn-open" data-url="${tab.url}">Open Tab</button>
            <button class="btn-delete" data-id="${tab.id}">Remove</button>
          </div>
        </div>
      `).join('');
      
      tabsList.innerHTML = tabsHtml;
      
      // Add event listeners to buttons
      document.querySelectorAll('.btn-open').forEach(btn => {
        btn.addEventListener('click', () => {
          chrome.tabs.create({ url: btn.dataset.url });
        });
      });
      
      document.querySelectorAll('.btn-delete').forEach(btn => {
        btn.addEventListener('click', () => {
          removeTab(btn.dataset.id);
        });
      });
    }
    
    // Remove a tab from the index
    async function removeTab(tabId) {
      try {
        console.log(`Removing tab: ${tabId}`);
        
        // Show loading state on the card
        const tabCard = document.querySelector(`.tab-card[data-id="${tabId}"]`);
        if (tabCard) {
          tabCard.style.opacity = '0.5';
          tabCard.querySelector('.btn-delete').textContent = 'Removing...';
        }
        
        // First try to remove from backend
        let removed = false;
        
        try {
          // Send message to background script
          await new Promise((resolve, reject) => {
            chrome.runtime.sendMessage({
              action: 'removeTab',
              tabId: tabId
            }, response => {
              if (chrome.runtime.lastError) {
                console.error('Error removing tab from backend:', chrome.runtime.lastError);
                // Continue with local removal anyway
                resolve(false);
              } else if (response && response.success) {
                console.log('Tab removed from backend');
                resolve(true);
              } else {
                console.error('Error removing tab from backend:', response ? response.error : 'Unknown error');
                resolve(false);
              }
            });
          });
          
          removed = true;
        } catch (error) {
          console.error('Error removing tab from backend:', error);
          // Continue with local removal anyway
        }
        
        // Always remove from local storage regardless of backend result
        chrome.storage.local.get(['indexedTabs'], function(result) {
          const indexedTabs = result.indexedTabs || {};
          
          if (indexedTabs[tabId]) {
            delete indexedTabs[tabId];
            
            // Save back to storage
            chrome.storage.local.set({ indexedTabs }, function() {
              if (chrome.runtime.lastError) {
                console.error('Error updating storage:', chrome.runtime.lastError);
                return;
              }
              
              console.log('Tab removed from local storage');
              
              // Refresh the tabs list
              loadAllTabs();
              
              // Update badge count
              chrome.runtime.sendMessage({ action: 'updateBadgeCount' });
            });
          } else {
            // Tab not found in storage, refresh list anyway
            loadAllTabs();
          }
        });
      } catch (error) {
        console.error('Error removing tab:', error);
        alert('Error removing tab: ' + error.message);
        
        // Restore the card's appearance
        const tabCard = document.querySelector(`.tab-card[data-id="${tabId}"]`);
        if (tabCard) {
          tabCard.style.opacity = '1';
          tabCard.querySelector('.btn-delete').textContent = 'Remove';
        }
      }
    }
    
    // Sync all open tabs
    function syncAllTabs() {
      syncAllBtn.textContent = 'Syncing...';
      syncAllBtn.disabled = true;
      
      chrome.runtime.sendMessage({ action: 'syncNow' }, function(response) {
        console.log('Sync response:', response);
        
        if (response && response.success) {
          syncAllBtn.textContent = `Synced ${response.stats.success} tabs`;
          
          // Refresh tabs list
          loadAllTabs();
          
          // Reset button after a delay
          setTimeout(() => {
            syncAllBtn.textContent = 'Sync All Tabs';
            syncAllBtn.disabled = false;
          }, 2000);
        } else {
          syncAllBtn.textContent = 'Error';
          console.error('Error syncing tabs:', response ? response.error : 'Unknown error');
          
          // Reset button after a delay
          setTimeout(() => {
            syncAllBtn.textContent = 'Sync All Tabs';
            syncAllBtn.disabled = false;
          }, 2000);
        }
      });
    }
    
    // Helper function to show error
    function showError(message) {
      tabsList.innerHTML = `
        <div class="empty-state">
          <p>${message}</p>
          <p>Please try again later.</p>
        </div>
      `;
    }
    
    // Helper function to format URL for display
    function formatUrl(url) {
      try {
        const urlObj = new URL(url);
        return urlObj.host + urlObj.pathname;
      } catch (e) {
        return url;
      }
    }
    
    // Helper function to format timestamp
    function formatTimestamp(timestamp) {
      if (!timestamp) return 'Unknown';
      
      const date = new Date(timestamp);
      const now = new Date();
      const diffMs = now - date;
      const diffMins = Math.floor(diffMs / (1000 * 60));
      
      if (diffMins < 60) {
        return `${diffMins} minutes ago`;
      } else {
        const diffHours = Math.floor(diffMins / 60);
        if (diffHours < 24) {
          return `${diffHours} hours ago`;
        } else {
          const diffDays = Math.floor(diffHours / 24);
          if (diffDays < 30) {
            return `${diffDays} days ago`;
          } else {
            return date.toLocaleDateString();
          }
        }
      }
    }
  });