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
    // Category elements
    const categoryContainer = document.getElementById('category-container');
    const categorizeBtn = document.getElementById('categorize-btn');
    
    // Store all tabs data
    let allTabs = [];
    let filteredTabs = [];
    // New variable to store categories
    let tabCategories = {};
    
    // Load tabs on page load
    loadAllTabs();

    // Load categories if they exist
    loadCategories();
    
    // Set up event listeners
    searchBtn.addEventListener('click', function() {
      const query = queryInput.value.trim();
      if (query) {
        performAISearch(query);
      }
    });

    // Categorize button
    if (categorizeBtn) {
      categorizeBtn.addEventListener('click', categorizeTabs);
    }
    
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
            <button class="btn-notes" data-id="${tab.id}" data-title="${escapeAttr(tab.title)}">Notes</button>
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

      // After adding event listeners to open and delete buttons, add:
      // Initialize notes functionality
      if (window.initTabNotes) {
        window.initTabNotes();
      }
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

    /**
     * Load saved categories from storage
     */
    function loadCategories() {
      chrome.storage.local.get(['tabCategories'], function(result) {
        if (chrome.runtime.lastError) {
          console.error('Error loading categories:', chrome.runtime.lastError);
          return;
        }
        
        tabCategories = result.tabCategories || {};
        
        // Update the UI with categories
        updateCategoryUI();
      });
    }

    /**
     * Update category UI elements
     */
    function updateCategoryUI() {
      // Skip if no category container
      if (!categoryContainer) return;
      
      // Get all category names
      const categories = Object.keys(tabCategories);
      
      if (categories.length === 0) {
        categoryContainer.innerHTML = '<p>No categories yet. Click "Categorize Tabs" to generate categories.</p>';
        return;
      }
      
      // Create category pills
      const pillsHtml = categories.map(category => {
        const count = tabCategories[category].length;
        return `
          <div class="category-pill" data-category="${category}">
            <span class="category-name">${category}</span>
            <span class="category-count">${count}</span>
          </div>
        `;
      }).join('');
      
      categoryContainer.innerHTML = `
        <div class="categories-header">
          <h3>Categories</h3>
          <button id="clear-category-filter" class="small-button">Clear Filter</button>
        </div>
        <div class="category-pills">
          ${pillsHtml}
        </div>
      `;
      
      // Add event listeners to category pills
      document.querySelectorAll('.category-pill').forEach(pill => {
        pill.addEventListener('click', () => {
          // Toggle active state
          document.querySelectorAll('.category-pill').forEach(p => p.classList.remove('active'));
          pill.classList.add('active');
          
          // Filter tabs by category
          filterTabsByCategory(pill.dataset.category);
        });
      });
      
      // Add event listener to clear filter button
      const clearFilterBtn = document.getElementById('clear-category-filter');
      if (clearFilterBtn) {
        clearFilterBtn.addEventListener('click', () => {
          document.querySelectorAll('.category-pill').forEach(p => p.classList.remove('active'));
          
          // Reset to all tabs
          filterTabs(filterInput.value.trim());
        });
      }
    }

    /**
     * Filter tabs by category
     * @param {string} category - Category name to filter by
     */
    function filterTabsByCategory(category) {
      if (!tabCategories[category]) return;
      
      const categoryTabIds = tabCategories[category];
      
      // Filter tabs to only those in the category
      filteredTabs = allTabs.filter(tab => categoryTabIds.includes(tab.id));
      
      // Update displayed count
      displayedCount.textContent = filteredTabs.length;
      
      // Render the filtered tabs
      renderTabs();
    }

    /**
     * Categorize tabs using AI
     */
    async function categorizeTabs() {
      try {
        // Update button state
        categorizeBtn.disabled = true;
        categorizeBtn.textContent = 'Categorizing...';
        
        // Get all tab IDs and details
        const tabIds = allTabs.map(tab => tab.id);
        
        if (tabIds.length === 0) {
          alert('No tabs to categorize');
          categorizeBtn.textContent = 'Categorize Tabs';
          categorizeBtn.disabled = false;
          return;
        }
        
        // First try API endpoint directly
        try {
          const API_ENDPOINT = 'http://localhost:3000/api';
          
          const response = await fetch(`${API_ENDPOINT}/categorize`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ tabIds })
          });
          
          if (!response.ok) {
            throw new Error(`Server responded with ${response.status}: ${response.statusText}`);
          }
          
          const result = await response.json();
          
          // Check if the server needs tab details
          if (result.success && result.needTabDetails) {
            console.log('Server needs tab details, sending them...');
            
            // Send tab details to the server
            return await categorizeWithDetails();
          } else if (result.success && result.categories) {
            // Save categories
            tabCategories = result.categories;
            
            // Save to storage
            chrome.storage.local.set({ tabCategories });
            
            // Update UI
            updateCategoryUI();
            
            // Show success message
            categorizeBtn.textContent = 'Categories Updated!';
            setTimeout(() => {
              categorizeBtn.textContent = 'Categorize Tabs';
              categorizeBtn.disabled = false;
            }, 2000);
          } else {
            throw new Error('Failed to categorize tabs');
          }
        } catch (apiError) {
          console.error('API error:', apiError);
          
          // Try using the with-details endpoint
          try {
            return await categorizeWithDetails();
          } catch (detailsError) {
            console.error('Details API error:', detailsError);
            
            // Generate local categories instead
            const localCategories = generateLocalCategories(allTabs);
            
            // Save categories
            tabCategories = localCategories;
            
            // Save to storage
            chrome.storage.local.set({ tabCategories });
            
            // Update UI
            updateCategoryUI();
            
            // Show success message (but indicate they're local)
            categorizeBtn.textContent = 'Local Categories Generated';
            setTimeout(() => {
              categorizeBtn.textContent = 'Categorize Tabs';
              categorizeBtn.disabled = false;
            }, 2000);
          }
        }
      } catch (error) {
        console.error('Error categorizing tabs:', error);
        alert('Error categorizing tabs: ' + error.message);
        
        categorizeBtn.textContent = 'Error';
        setTimeout(() => {
          categorizeBtn.textContent = 'Categorize Tabs';
          categorizeBtn.disabled = false;
        }, 2000);
      }
    }

    /**
     * Categorize tabs by sending full tab details to the server
     */
    async function categorizeWithDetails() {
      try {
        const API_ENDPOINT = 'http://localhost:3000/api';
        
        // Format tabs with details
        const tabsWithDetails = allTabs.map(tab => ({
          id: tab.id,
          title: tab.title,
          url: tab.url,
          snippet: tab.snippet || '',
          summary: tab.summary || null
        }));
        
        // Send to the server
        const response = await fetch(`${API_ENDPOINT}/categorize-with-details`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ tabs: tabsWithDetails })
        });
        
        if (!response.ok) {
          throw new Error(`Server responded with ${response.status}: ${response.statusText}`);
        }
        
        const result = await response.json();
        
        if (result.success && result.categories) {
          // Save categories
          tabCategories = result.categories;
          
          // Save to storage
          chrome.storage.local.set({ tabCategories });
          
          // Update UI
          updateCategoryUI();
          
          // Show success message
          categorizeBtn.textContent = 'Categories Updated!';
          setTimeout(() => {
            categorizeBtn.textContent = 'Categorize Tabs';
            categorizeBtn.disabled = false;
          }, 2000);
          
          return true;
        } else {
          throw new Error('Failed to categorize tabs with details');
        }
      } catch (error) {
        console.error('Error categorizing with details:', error);
        throw error;
      }
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

    /**
     * Escape HTML attribute values
     * @param {string} value - Value to escape
     * @returns {string} - Escaped value
     */
    function escapeAttr(value) {
      if (!value) return '';
      return value
        .replace(/&/g, '&amp;')
        .replace(/'/g, '&#39;')
        .replace(/"/g, '&quot;');
    }

    /**
     * Generate local categories without backend
     * @param {Array} tabs - Array of tabs
     * @returns {Object} - Categories object
     */
    function generateLocalCategories(tabs) {
      try {
        console.log('Generating local categories for', tabs.length, 'tabs');
        
        // Categories object
        const categories = {};
        
        // Group by domain
        tabs.forEach(tab => {
          try {
            const url = new URL(tab.url);
            let domain = url.hostname.replace(/^www\./, '');
            
            // Determine category
            let category = 'Other';
            
            // Handle common domains
            if (domain.includes('github.com')) {
              category = 'Development';
            } else if (domain.includes('google.com')) {
              if (url.pathname.includes('/docs')) {
                category = 'Documents';
              } else if (url.pathname.includes('/mail')) {
                category = 'Email';
              } else {
                category = 'Google';
              }
            } else if (domain.includes('youtube.com')) {
              category = 'Entertainment';
            } else if (domain.includes('twitter.com') || domain.includes('x.com')) {
              category = 'Social Media';
            } else if (domain.includes('facebook.com')) {
              category = 'Social Media';
            } else if (domain.includes('linkedin.com')) {
              category = 'Professional';
            } else if (domain.includes('amazon.com')) {
              category = 'Shopping';
            } else if (domain.includes('reddit.com')) {
              category = 'Social Media';
            } else if (domain.includes('nytimes.com') || domain.includes('cnn.com') || domain.includes('bbc.com')) {
              category = 'News';
            } else if (domain.includes('wikipedia.org')) {
              category = 'Reference';
            } else {
              // Use TLD to make a guess
              if (domain.endsWith('.edu')) {
                category = 'Education';
              } else if (domain.endsWith('.gov')) {
                category = 'Government';
              } else if (domain.endsWith('.org')) {
                category = 'Organization';
              } else if (domain.endsWith('.io')) {
                category = 'Development';
              } else {
                // Use domain as category for less common domains
                const parts = domain.split('.');
                if (parts.length >= 2) {
                  // Capitalize first letter of domain
                  category = parts[parts.length - 2].charAt(0).toUpperCase() + parts[parts.length - 2].slice(1);
                }
              }
            }
            
            // Add to category
            if (!categories[category]) {
              categories[category] = [];
            }
            
            categories[category].push(tab.id);
          } catch (urlError) {
            // Invalid URL
            if (!categories['Other']) {
              categories['Other'] = [];
            }
            categories['Other'].push(tab.id);
          }
        });
        
        // If we have too many small categories, consolidate them
        const smallCategories = [];
        const largeCategories = {};
        const MIN_CATEGORY_SIZE = 2;
        
        for (const [category, tabIds] of Object.entries(categories)) {
          if (tabIds.length < MIN_CATEGORY_SIZE) {
            smallCategories.push(...tabIds);
          } else {
            largeCategories[category] = tabIds;
          }
        }
        
        // Add small categories to "Other"
        if (smallCategories.length > 0) {
          if (!largeCategories['Other']) {
            largeCategories['Other'] = [];
          }
          largeCategories['Other'].push(...smallCategories);
        }
        
        // If we have no categories, put everything in one category
        if (Object.keys(largeCategories).length === 0) {
          largeCategories['All Tabs'] = tabs.map(tab => tab.id);
        }
        
        return largeCategories;
      } catch (error) {
        console.error('Error generating local categories:', error);
        
        // Fallback to single category
        return {
          'All Tabs': tabs.map(tab => tab.id)
        };
      }
    }
  });