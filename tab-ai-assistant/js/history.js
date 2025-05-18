// tab-ai-assistant/js/history.js - Tab history functionality

document.addEventListener('DOMContentLoaded', function() {
    console.log('Tab history page initialized');
    
    // Elements
    const searchInput = document.getElementById('search-input');
    const searchBtn = document.getElementById('search-btn');
    const startDateInput = document.getElementById('start-date');
    const endDateInput = document.getElementById('end-date');
    const clearFiltersBtn = document.getElementById('clear-filters-btn');
    const clearHistoryBtn = document.getElementById('clear-history-btn');
    const historyList = document.getElementById('history-list');
    const displayedCount = document.getElementById('displayed-count');
    const totalCount = document.getElementById('total-count');
    const loadMoreBtn = document.getElementById('load-more-btn');
    
    // API endpoint configuration
    const API_ENDPOINT = 'http://localhost:3000/api';
    
    // State
    let historyItems = [];
    let filteredItems = [];
    let currentFilters = {
      query: '',
      startDate: '',
      endDate: ''
    };
    let currentPage = 1;
    const itemsPerPage = 20;
    let hasMoreItems = false;
    
    // Initialize
    loadHistory();
    
    // Event listeners
    if (searchBtn) {
      searchBtn.addEventListener('click', applyFilters);
    }
    
    if (searchInput) {
      searchInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
          applyFilters();
        }
      });
    }
    
    if (clearFiltersBtn) {
      clearFiltersBtn.addEventListener('click', clearFilters);
    }
    
    if (clearHistoryBtn) {
      clearHistoryBtn.addEventListener('click', confirmClearHistory);
    }
    
    if (startDateInput) {
      startDateInput.addEventListener('change', applyFilters);
    }
    
    if (endDateInput) {
      endDateInput.addEventListener('change', applyFilters);
    }
    
    if (loadMoreBtn) {
      loadMoreBtn.addEventListener('click', loadMoreHistory);
    }
    
    /**
     * Load tab history
     */
    async function loadHistory() {
      try {
        // Show loading state
        historyList.innerHTML = '<div class="loading">Loading history...</div>';
        
        // Reset pagination
        currentPage = 1;
        
        // Try API endpoint first
        try {
          // Build query parameters
          const params = new URLSearchParams();
          params.append('limit', itemsPerPage);
          
          if (currentFilters.query) {
            params.append('query', currentFilters.query);
          }
          
          if (currentFilters.startDate) {
            params.append('startDate', currentFilters.startDate);
          }
          
          if (currentFilters.endDate) {
            params.append('endDate', currentFilters.endDate);
          }
          
          const response = await fetch(`${API_ENDPOINT}/history?${params.toString()}`);
          
          if (!response.ok) {
            throw new Error(`Server responded with ${response.status}: ${response.statusText}`);
          }
          
          const data = await response.json();
          
          if (data.success && data.history) {
            historyItems = data.history;
            
            // Check if there might be more items
            hasMoreItems = historyItems.length === itemsPerPage;
            
            displayHistory();
          } else {
            throw new Error('Failed to load history');
          }
        } catch (apiError) {
          console.error('API error:', apiError);
          
          // Fallback to chrome storage
          try {
            const { tabHistory = [] } = await chrome.storage.local.get('tabHistory');
            historyItems = tabHistory;
            
            // Apply filters
            applyLocalFilters();
            
            // Check if there might be more items
            hasMoreItems = filteredItems.length > itemsPerPage;
            
            // Display results
            displayHistory();
          } catch (storageError) {
            console.error('Storage error:', storageError);
            showError('Could not load history. Please try again later.');
          }
        }
      } catch (error) {
        console.error('Error loading history:', error);
        showError(`Error loading history: ${error.message}`);
      }
    }
    
    /**
     * Load more history items
     */
    async function loadMoreHistory() {
      try {
        // Show loading state in button
        loadMoreBtn.textContent = 'Loading...';
        loadMoreBtn.disabled = true;
        
        // Increment page
        currentPage++;
        
        // Try API endpoint first
        try {
          // Build query parameters
          const params = new URLSearchParams();
          params.append('limit', itemsPerPage);
          params.append('page', currentPage);
          
          if (currentFilters.query) {
            params.append('query', currentFilters.query);
          }
          
          if (currentFilters.startDate) {
            params.append('startDate', currentFilters.startDate);
          }
          
          if (currentFilters.endDate) {
            params.append('endDate', currentFilters.endDate);
          }
          
          const response = await fetch(`${API_ENDPOINT}/history?${params.toString()}`);
          
          if (!response.ok) {
            throw new Error(`Server responded with ${response.status}: ${response.statusText}`);
          }
          
          const data = await response.json();
          
          if (data.success && data.history) {
            // Append new items
            const newItems = data.history;
            historyItems = [...historyItems, ...newItems];
            
            // Check if there might be more items
            hasMoreItems = newItems.length === itemsPerPage;
            
            // Display all history items
            displayHistory();
          } else {
            throw new Error('Failed to load more history');
          }
        } catch (apiError) {
          console.error('API error:', apiError);
          
          // Fallback to local storage pagination
          try {
            const { tabHistory = [] } = await chrome.storage.local.get('tabHistory');
            
            // Apply filters to get all matching items
            const allItems = applyFiltersToItems(tabHistory);
            
            // Paginate
            const startIndex = (currentPage - 1) * itemsPerPage;
            const endIndex = startIndex + itemsPerPage;
            const newPageItems = allItems.slice(startIndex, endIndex);
            
            // Check if we have more items
            hasMoreItems = endIndex < allItems.length;
            
            // Append new items
            filteredItems = [...filteredItems, ...newPageItems];
            
            // Display history
            displayHistory();
          } catch (storageError) {
            console.error('Storage error:', storageError);
            showError('Could not load more history items');
          }
        }
      } catch (error) {
        console.error('Error loading more history:', error);
        alert(`Error loading more history: ${error.message}`);
      } finally {
        // Reset button
        loadMoreBtn.textContent = 'Load More Results';
        loadMoreBtn.disabled = false;
      }
    }
    
    /**
     * Apply filters to history
     */
    function applyFilters() {
      // Get filter values
      const query = searchInput ? searchInput.value.trim() : '';
      const startDate = startDateInput ? startDateInput.value : '';
      const endDate = endDateInput ? endDateInput.value : '';
      
      // Update current filters
      currentFilters = {
        query,
        startDate,
        endDate
      };
      
      // Reload history with new filters
      loadHistory();
    }
    
    /**
     * Apply filters to local items
     */
    function applyLocalFilters() {
      filteredItems = applyFiltersToItems(historyItems);
      
      // Paginate
      filteredItems = filteredItems.slice(0, currentPage * itemsPerPage);
    }
    
    /**
     * Apply filters to a set of items
     * @param {Array} items - Items to filter
     * @returns {Array} - Filtered items
     */
    function applyFiltersToItems(items) {
      return items.filter(item => {
        // Filter by search query
        if (currentFilters.query) {
          const query = currentFilters.query.toLowerCase();
          const titleMatch = item.title && item.title.toLowerCase().includes(query);
          const urlMatch = item.url && item.url.toLowerCase().includes(query);
          const snippetMatch = item.snippet && item.snippet.toLowerCase().includes(query);
          
          if (!titleMatch && !urlMatch && !snippetMatch) {
            return false;
          }
        }
        
        // Filter by date range
        if (currentFilters.startDate) {
          const startDate = new Date(currentFilters.startDate);
          const itemDate = new Date(item.closedAt);
          
          if (itemDate < startDate) {
            return false;
          }
        }
        
        if (currentFilters.endDate) {
          const endDate = new Date(currentFilters.endDate);
          endDate.setHours(23, 59, 59, 999); // End of day
          const itemDate = new Date(item.closedAt);
          
          if (itemDate > endDate) {
            return false;
          }
        }
        
        return true;
      });
    }
    
    /**
     * Clear all filters
     */
    function clearFilters() {
      // Reset filter inputs
      if (searchInput) searchInput.value = '';
      if (startDateInput) startDateInput.value = '';
      if (endDateInput) endDateInput.value = '';
      
      // Reset current filters
      currentFilters = {
        query: '',
        startDate: '',
        endDate: ''
      };
      
      // Reload history
      loadHistory();
    }
    
    /**
     * Display history items
     */
    function displayHistory() {
      if (!historyList) return;
      
      // Get items to display (use filtered items if available)
      const displayItems = filteredItems.length > 0 ? filteredItems : historyItems;
      
      if (displayItems.length === 0) {
        historyList.innerHTML = `
          <div class="empty-state">
            <p>No history found${currentFilters.query ? ' matching "' + currentFilters.query + '"' : ''}</p>
            <p>Closed tabs will appear here.</p>
          </div>
        `;
        
        // Hide load more button
        if (loadMoreBtn) loadMoreBtn.style.display = 'none';
        
        // Update counts
        if (displayedCount) displayedCount.textContent = '0';
        if (totalCount) totalCount.textContent = '0';
        
        return;
      }
      
      // Create HTML for history items
      const historyHtml = displayItems.map(item => `
        <div class="history-item" data-id="${item.id}">
          <div class="title">
            <a href="${item.url}" target="_blank" title="${item.title}">${item.title}</a>
          </div>
          <div class="url" title="${item.url}">${formatUrl(item.url)}</div>
          <div class="timestamp">Closed: ${formatTimestamp(item.closedAt)}</div>
          <div class="summary">${item.summary || item.snippet || 'No preview available'}</div>
          <div class="actions">
            <button class="btn-restore" data-id="${item.id}" data-url="${item.url}">Restore Tab</button>
            <button class="btn-delete" data-id="${item.id}">Remove</button>
          </div>
        </div>
      `).join('');
      
      historyList.innerHTML = historyHtml;
      
      // Show/hide load more button
      if (loadMoreBtn) {
        loadMoreBtn.style.display = hasMoreItems ? 'block' : 'none';
      }
      
      // Update counts
      if (displayedCount) displayedCount.textContent = displayItems.length;
      if (totalCount) totalCount.textContent = historyItems.length;
      
      // Add event listeners
      historyList.querySelectorAll('.btn-restore').forEach(btn => {
        btn.addEventListener('click', () => {
          restoreTab(btn.dataset.id, btn.dataset.url);
        });
      });
      
      historyList.querySelectorAll('.btn-delete').forEach(btn => {
        btn.addEventListener('click', () => {
          deleteHistoryItem(btn.dataset.id);
        });
      });
    }
    
    /**
     * Restore a tab from history
     * @param {string} historyId - ID of the history item
     * @param {string} url - URL of the tab to restore
     */
    async function restoreTab(historyId, url) {
      try {
        // Open new tab
        await chrome.tabs.create({ url });
        
        // Optional: Remove from history after restoring
        // await deleteHistoryItem(historyId);
      } catch (error) {
        console.error('Error restoring tab:', error);
        alert(`Error restoring tab: ${error.message}`);
      }
    }
    
    /**
     * Delete a history item
     * @param {string} historyId - ID of the history item to delete
     */
    async function deleteHistoryItem(historyId) {
      if (!confirm('Are you sure you want to remove this item from history?')) {
        return;
      }
      
      try {
        // Find the item element
        const itemElement = document.querySelector(`.history-item[data-id="${historyId}"]`);
        
        if (itemElement) {
          // Animate removal
          itemElement.style.opacity = '0.5';
        }
        
        // Try API endpoint first
        try {
          const response = await fetch(`${API_ENDPOINT}/history/${historyId}`, {
            method: 'DELETE'
          });
          
          if (!response.ok) {
            throw new Error(`Server responded with ${response.status}: ${response.statusText}`);
          }
          
          const data = await response.json();
          
          if (!data.success) {
            throw new Error(data.message || 'Failed to delete history item');
          }
          
          // Remove from our local array
          historyItems = historyItems.filter(item => item.id !== historyId);
          filteredItems = filteredItems.filter(item => item.id !== historyId);
          
          // Remove from DOM
          if (itemElement) {
            itemElement.remove();
          }
          
          // Update counts
          if (displayedCount) displayedCount.textContent = filteredItems.length || historyItems.length;
          if (totalCount) totalCount.textContent = historyItems.length;
          
          // Check if we need to show empty state
          if (historyItems.length === 0) {
            displayHistory();
          }
        } catch (apiError) {
          console.error('API error:', apiError);
          
          // Fallback to chrome storage
          try {
            const { tabHistory = [] } = await chrome.storage.local.get('tabHistory');
            
            // Filter out the item
            const updatedHistory = tabHistory.filter(item => item.id !== historyId);
            
            // Save back to storage
            await chrome.storage.local.set({ tabHistory: updatedHistory });
            
            // Update our local arrays
            historyItems = updatedHistory;
            filteredItems = filteredItems.filter(item => item.id !== historyId);
            
            // Remove from DOM
            if (itemElement) {
              itemElement.remove();
            }
            
            // Update counts
            if (displayedCount) displayedCount.textContent = filteredItems.length || historyItems.length;
            if (totalCount) totalCount.textContent = historyItems.length;
            
            // Check if we need to show empty state
            if (historyItems.length === 0) {
              displayHistory();
            }
          } catch (storageError) {
            console.error('Storage error:', storageError);
            
            // Still remove from DOM to give feedback
            if (itemElement) {
              itemElement.remove();
            }
          }
        }
      } catch (error) {
        console.error('Error deleting history item:', error);
        alert(`Error removing history item: ${error.message}`);
      }
    }
    
    /**
     * Show confirmation dialog for clearing all history
     */
    function confirmClearHistory() {
      // Create dialog if it doesn't exist
      let dialog = document.getElementById('clear-confirmation');
      
      if (!dialog) {
        dialog = document.createElement('div');
        dialog.id = 'clear-confirmation';
        dialog.className = 'confirmation-overlay';
        
        dialog.innerHTML = `
          <div class="confirmation-dialog">
            <h3 class="confirmation-title">Clear All History?</h3>
            <p class="confirmation-message">
              This will permanently delete all your tab history.
              This action cannot be undone.
            </p>
            <div class="confirmation-actions">
              <button id="cancel-clear" class="action-button secondary">Cancel</button>
              <button id="confirm-clear" class="action-button danger">Clear All History</button>
            </div>
          </div>
        `;
        
        document.body.appendChild(dialog);
        
        // Add event listeners
        const cancelBtn = dialog.querySelector('#cancel-clear');
        cancelBtn.addEventListener('click', () => {
          dialog.classList.remove('visible');
        });
        
        const confirmBtn = dialog.querySelector('#confirm-clear');
        confirmBtn.addEventListener('click', () => {
          dialog.classList.remove('visible');
          clearAllHistory();
        });
      }
      
      // Show dialog
      dialog.classList.add('visible');
    }
    
    /**
     * Clear all history
     */
    async function clearAllHistory() {
      try {
        // Try API endpoint first
        try {
          const response = await fetch(`${API_ENDPOINT}/history`, {
            method: 'DELETE'
          });
          
          if (!response.ok) {
            throw new Error(`Server responded with ${response.status}: ${response.statusText}`);
          }
          
          const data = await response.json();
          
          if (!data.success) {
            throw new Error(data.message || 'Failed to clear history');
          }
          
          // Reset our local arrays
          historyItems = [];
          filteredItems = [];
          
          // Show empty state
          displayHistory();
        } catch (apiError) {
          console.error('API error:', apiError);
          
          // Fallback to chrome storage
          try {
            // Clear tab history
            await chrome.storage.local.set({ tabHistory: [] });
            
            // Reset our local arrays
            historyItems = [];
            filteredItems = [];
            
            // Show empty state
            displayHistory();
          } catch (storageError) {
            console.error('Storage error:', storageError);
            throw new Error('Could not clear history storage');
          }
        }
      } catch (error) {
        console.error('Error clearing history:', error);
        alert(`Error clearing history: ${error.message}`);
      }
    }
    
    /**
     * Show error message
     * @param {string} message - Error message
     */
    function showError(message) {
      if (!historyList) return;
      
      historyList.innerHTML = `
        <div class="empty-state">
          <p>${message}</p>
          <p>Please try again later.</p>
        </div>
      `;
      
      // Hide load more button
      if (loadMoreBtn) loadMoreBtn.style.display = 'none';
      
      // Update counts
      if (displayedCount) displayedCount.textContent = '0';
      if (totalCount) totalCount.textContent = '0';
    }
    
    /**
     * Format URL for display
     * @param {string} url - URL to format
     * @returns {string} - Formatted URL
     */
    function formatUrl(url) {
      try {
        const urlObj = new URL(url);
        return urlObj.host + urlObj.pathname;
      } catch (e) {
        return url;
      }
    }
    
    /**
     * Format timestamp to a readable string
     * @param {string} timestamp - ISO timestamp
     * @returns {string} - Formatted timestamp
     */
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