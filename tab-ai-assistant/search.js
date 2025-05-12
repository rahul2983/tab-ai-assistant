// search.js - Search results page functionality
document.addEventListener('DOMContentLoaded', function() {
  console.log('Search page initialized');
  
  // Elements
  const queryInput = document.getElementById('query-input');
  const searchBtn = document.getElementById('search-btn');
  const resultsContainer = document.getElementById('results');
  const aiAnswerContainer = document.getElementById('ai-answer');
  const aiResponseElement = document.getElementById('ai-response');
  const sourceTabsElement = document.getElementById('source-tabs');
  
  // API endpoint configuration
  const API_ENDPOINT = 'http://localhost:3000/api';
  
  // Get query from URL
  const urlParams = new URLSearchParams(window.location.search);
  const query = urlParams.get('q');
  
  // Set query in input field
  if (query) {
    queryInput.value = query;
    performSearch(query);
  }
  
  // Event listeners
  searchBtn.addEventListener('click', function() {
    const newQuery = queryInput.value.trim();
    if (newQuery) {
      // Update URL
      const url = new URL(window.location.href);
      url.searchParams.set('q', newQuery);
      window.history.pushState({}, '', url);
      
      performSearch(newQuery);
    }
  });
  
  // Allow Enter key to trigger search
  queryInput.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
      const newQuery = queryInput.value.trim();
      if (newQuery) {
        // Update URL
        const url = new URL(window.location.href);
        url.searchParams.set('q', newQuery);
        window.history.pushState({}, '', url);
        
        performSearch(newQuery);
      }
    }
  });
  
  // Function to perform search with timeout handling
  async function performSearch(query) {
    try {
      // Show loading state
      resultsContainer.innerHTML = '<div class="loading">Searching your tabs...</div>';
      
      // Hide AI answer section initially
      aiAnswerContainer.style.display = 'none';
      
      console.log(`Searching for "${query}"`);
      
      // Create an AbortController with 15 second timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);
      
      try {
        // First, try direct API call
        console.log(`Sending search request to ${API_ENDPOINT}/search`);
        const response = await fetch(`${API_ENDPOINT}/search`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ query }),
          signal: controller.signal
        });
        
        // Clear the timeout
        clearTimeout(timeoutId);
        
        console.log(`Response status: ${response.status}`);
        
        if (!response.ok) {
          throw new Error(`Server responded with ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        console.log('Search results:', data);
        
        displayResults(query, data);
      } catch (fetchError) {
        // Clear the timeout if it's an abort error
        if (fetchError.name === 'AbortError') {
          clearTimeout(timeoutId);
          console.log('Direct API request timed out, trying through extension messaging');
          
          // Fallback to extension messaging
          chrome.runtime.sendMessage({ 
            action: 'search', 
            query: query 
          }, function(response) {
            console.log('Extension message response:', response);
            if (response && response.success) {
              displayResults(query, response);
            } else {
              showError(response ? response.error : 'Search timed out. Please try again.');
            }
          });
        } else {
          // If it's not a timeout, just throw the error
          throw fetchError;
        }
      }
    } catch (error) {
      console.error('Error searching tabs:', error);
      
      showError(error.message);
    }
  }
  
  // Function to display search results
  function displayResults(query, data) {
    // Display AI answer if available
    if (data.ai_answer) {
      aiAnswerContainer.style.display = 'block';
      aiResponseElement.textContent = data.ai_answer;
      
      // Show source tabs if available
      if (data.source_tabs && data.source_tabs.length > 0) {
        const sourcesHtml = `Sources: ${data.source_tabs.map((tab, index) => 
          `<a href="${tab.url}" target="_blank">[${index + 1}]</a>`
        ).join(', ')}`;
        
        sourceTabsElement.innerHTML = sourcesHtml;
      } else {
        sourceTabsElement.innerHTML = '';
      }
    }
    
    // Display results
    if (data.results && data.results.length > 0) {
      const resultsHtml = data.results.map(result => {
        // Check if we have a reading time to display
        const readingTimeHtml = result.readingTime ? 
          `<div class="reading-time">${result.readingTime.text}</div>` : '';
        
        // Use summary if available, fallback to snippet
        const summaryText = result.summary || result.snippet || 'No preview available';
        
        return `
          <div class="result-item">
            <div class="title">
              <a href="${result.url}" target="_blank">${highlightMatches(result.title || 'Untitled', query)}</a>
            </div>
            <div class="url">${formatUrl(result.url)}</div>
            ${readingTimeHtml}
            <div class="summary">${highlightMatches(summaryText, query)}</div>
            <div class="timestamp">Indexed: ${formatTimestamp(result.timestamp)}</div>
            <div class="actions">
              <button class="btn-open" data-url="${result.url}">Open Tab</button>
              <button class="btn-highlight" data-url="${result.url}">Highlight Keywords</button>
            </div>
          </div>
        `;
      }).join('');
      
      resultsContainer.innerHTML = resultsHtml;
      
      // Add event listeners to buttons
      document.querySelectorAll('.btn-open').forEach(btn => {
        btn.addEventListener('click', () => {
          chrome.tabs.create({ url: btn.dataset.url });
        });
      });
      
      document.querySelectorAll('.btn-highlight').forEach(btn => {
        btn.addEventListener('click', () => {
          highlightInPage(btn.dataset.url, query.split(/\s+/));
        });
      });
    } else {
      resultsContainer.innerHTML = `
        <div class="no-results">
          <p>No tabs found matching "${query}"</p>
          <p>Try a different search term or index more tabs.</p>
        </div>
      `;
    }
  }
  
  // Function to show error message
  function showError(message) {
    resultsContainer.innerHTML = `
      <div class="no-results">
        <p>Error searching tabs: ${message}</p>
        <p>Check the developer console for more details.</p>
      </div>
    `;
  }
  
  // Function to highlight keywords in a tab
  async function highlightInPage(url, keywords) {
    try {
      // Find tab with matching URL
      const tabs = await chrome.tabs.query({});
      const matchingTab = tabs.find(tab => tab.url === url);
      
      if (matchingTab) {
        // Switch to the tab
        await chrome.tabs.update(matchingTab.id, { active: true });
        
        // Send message to content script
        chrome.tabs.sendMessage(matchingTab.id, {
          action: 'highlightKeywords',
          keywords: keywords
        });
      } else {
        // Tab not open, open it
        const newTab = await chrome.tabs.create({ url });
        
        // Need to wait for content script to load
        setTimeout(() => {
          chrome.tabs.sendMessage(newTab.id, {
            action: 'highlightKeywords',
            keywords: keywords
          });
        }, 1000);
      }
    } catch (error) {
      console.error('Error highlighting keywords:', error);
      alert('Error highlighting keywords in the page');
    }
  }
  
  // Helper function to highlight search matches
  function highlightMatches(text, query) {
    if (!text) return '';
    
    const words = query.split(/\s+/).filter(word => word.length > 0);
    let result = text;
    
    words.forEach(word => {
      if (word.length < 3) return; // Skip short words
      
      const regex = new RegExp(`(${escapeRegExp(word)})`, 'gi');
      result = result.replace(regex, '<span class="highlight">$1</span>');
    });
    
    return result;
  }
  
  // Helper function to escape regex special characters
  function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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