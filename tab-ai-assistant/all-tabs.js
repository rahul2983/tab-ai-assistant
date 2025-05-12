// all-tabs.js - Display and manage all indexed tabs

document.addEventListener('DOMContentLoaded', function() {
    console.log('All tabs page initialized');
    
    // Elements
    const queryInput = document.getElementById('query-input');
    const searchBtn = document.getElementById('search-btn');
    const filterInput = document.getElementById('filter-input');
    const filterBtn = document.getElementById('filter-btn');
    const syncAllBtn = document.getElementById('sync-all-btn');
    const sortBySelect = document.getElementById('sort-by');
    const tabsList = document.getElementById('tabs-list');
    const displayedCount = document.getElementById('displayed-count');
    const totalCount = document.getElementById('total-count');
    const aiAnswerContainer = document.getElementById('ai-answer-container');
    const aiResponseElement = document.getElementById('ai-response');
    const sourceTabsElement = document.getElementById('source-tabs');
    
    // Store all tabs data
    let allTabs = [];
    let filteredTabs = [];
    
    // Load tabs on page load
    loadAllTabs();
    
    // Set up event listeners
    searchBtn.addEventListener('click', function() {
      const query = queryInput.value.trim();
      if (query) {
        performAISearch(query);
      }
    });
    
    queryInput.addEventListener('keypress', function(e) {
      if (e.key === 'Enter') {
        const query = queryInput.value.trim();
        if (query) {
          performAISearch(query);
        }
      }
    });
    
    filterInput.addEventListener('keyup', function(e) {
      filterTabs(filterInput.value.trim());
    });
    
    syncAllBtn.addEventListener('click', function() {
      syncAllTabs();
    });
    
    sortBySelect.addEventListener('change', function() {
      sortTabs(sortBySelect.value);
    });
    

    // Add this new function to perform AI search
    async function performAISearch(query) {
      try {
        console.log(`Performing AI search for: ${query}`);
        
        // Show AI answer container with loading state
        aiAnswerContainer.style.display = 'block';
        aiResponseElement.innerHTML = `Searching your tabs for an answer... <span class="loading-indicator"></span>`;
        sourceTabsElement.innerHTML = '';
        
        // Scroll to bring AI answer into view
        aiAnswerContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
        
        // First, try using the backend API directly
        try {
          const API_ENDPOINT = 'http://localhost:3000/api';
          
          const response = await fetch(`${API_ENDPOINT}/search`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ query })
          });
          
          if (!response.ok) {
            throw new Error(`Server responded with ${response.status}: ${response.statusText}`);
          }
          
          const result = await response.json();
          displayAIAnswer(result, query);
          
          // Also filter the tabs to show relevant results
          filterTabs(query);
          
        } catch (apiError) {
          console.error('Error with direct API call:', apiError);
          
          // Try through extension messaging as fallback
          chrome.runtime.sendMessage({ 
            action: 'search', 
            query: query 
          }, function(response) {
            if (chrome.runtime.lastError) {
              showSearchError(`Error: ${chrome.runtime.lastError.message}`);
              return;
            }
            
            if (response && response.success) {
              displayAIAnswer(response, query);
              
              // Also filter the tabs to show relevant results
              filterTabs(query);
            } else {
              showSearchError(response ? response.error : 'Unknown error');
            }
          });
        }
      } catch (error) {
        console.error('Error performing AI search:', error);
        showSearchError(error.message);
      }
    }

    // Add this function to display AI answer
    function displayAIAnswer(result, query) {
      if (result.ai_answer) {
        aiResponseElement.textContent = result.ai_answer;
        
        // Show source tabs if available
        if (result.source_tabs && result.source_tabs.length > 0) {
          const sourcesHtml = `Sources: ${result.source_tabs.map((tab, index) => 
            `<a href="${tab.url}" target="_blank">[${index + 1}]</a>`
          ).join(', ')}`;
          
          sourceTabsElement.innerHTML = sourcesHtml;
          
          // Highlight the source tabs in the list
          highlightSourceTabs(result.source_tabs.map(tab => tab.id));
        } else {
          sourceTabsElement.innerHTML = '';
        }
      } else {
        aiResponseElement.textContent = `No specific answer found for "${query}". Try refining your question.`;
        sourceTabsElement.innerHTML = '';
      }
    }

    // Add this function to show search errors
    function showSearchError(message) {
      aiAnswerContainer.style.display = 'block';
      aiResponseElement.textContent = `Error searching: ${message}`;
      sourceTabsElement.innerHTML = '';
    }
    
    // Add this function to highlight source tabs in the list
    function highlightSourceTabs(sourceIds) {
      // Remove any existing highlights
      document.querySelectorAll('.tab-card.source-tab').forEach(card => {
        card.classList.remove('source-tab');
      });
      
      // Add highlight to source tabs
      sourceIds.forEach(id => {
        const tabCard = document.querySelector(`.tab-card[data-id="${id}"]`);
        if (tabCard) {
          tabCard.classList.add('source-tab');
          
          // Ensure the tab is in view
          setTimeout(() => {
            tabCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          }, 300);
        }
      });
    }

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
            summary: tab.summary || null,
            readingTime: tab.readingTime || {
              minutes: null,
              text: 'Unknown length'
            },
            wordCount: tab.wordCount || null,
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
        case 'longest':
          // Sort by reading time (longest first)
          filteredTabs.sort((a, b) => {
            const timeA = a.readingTime && a.readingTime.minutes ? a.readingTime.minutes : 0;
            const timeB = b.readingTime && b.readingTime.minutes ? b.readingTime.minutes : 0;
            return timeB - timeA;
          });
          break;
        case 'shortest':
          // Sort by reading time (shortest first)
          filteredTabs.sort((a, b) => {
            const timeA = a.readingTime && a.readingTime.minutes ? a.readingTime.minutes : 999;
            const timeB = b.readingTime && b.readingTime.minutes ? b.readingTime.minutes : 999;
            return timeA - timeB;
          });
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
          <div class="reading-time">${tab.readingTime ? tab.readingTime.text : 'Unknown length'}</div>
          <div class="summary">${tab.summary || tab.snippet || 'No preview available'}</div>
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