// content.js - Content script injected into web pages

// Helper function to escape regex special characters
function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Listen for messages from the popup or background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Content script received message:', message);
  
  if (message.action === 'extractContent') {
    // Extract content from the current page
    const content = {
      title: document.title,
      text: document.body.innerText,
      url: window.location.href
    };
    
    console.log('Extracted content:', {
      title: content.title,
      textLength: content.text.length,
      url: content.url
    });
    
    sendResponse(content);
  } else if (message.action === 'highlightKeywords') {
    // Highlight keywords in the page
    highlightKeywords(message.keywords);
    sendResponse({ success: true });
  }
});

// Function to highlight keywords in the page
function highlightKeywords(keywords) {
  if (!keywords || keywords.length === 0) return;
  
  console.log('Highlighting keywords:', keywords);
  
  // Remove any existing highlights
  const existingHighlights = document.querySelectorAll('.tab-ai-highlight');
  existingHighlights.forEach(el => {
    const parent = el.parentNode;
    parent.replaceChild(document.createTextNode(el.textContent), el);
    parent.normalize();
  });
  
  // Create a regex pattern for all keywords
  const pattern = keywords
    .filter(kw => kw.length > 2) // Skip short keywords
    .map(kw => escapeRegExp(kw))
    .join('|');
  
  if (!pattern) return;
  
  const regex = new RegExp(`(${pattern})`, 'gi');
  
  // Get all text nodes in the body
  const textNodes = getTextNodes(document.body);
  console.log(`Found ${textNodes.length} text nodes to search`);
  
  // Track how many matches we find
  let matchCount = 0;
  
  // Highlight each match
  textNodes.forEach(node => {
    const matches = node.textContent.match(regex);
    if (!matches) return;
    
    matchCount += matches.length;
    
    const fragment = document.createDocumentFragment();
    const parts = node.textContent.split(regex);
    
    parts.forEach((part, i) => {
      if (i % 2 === 0) {
        // Regular text
        fragment.appendChild(document.createTextNode(part));
      } else {
        // Matched text - highlight it
        const span = document.createElement('span');
        span.className = 'tab-ai-highlight';
        span.style.backgroundColor = '#fff2cc';
        span.style.padding = '0 2px';
        span.textContent = part;
        fragment.appendChild(span);
      }
    });
    
    node.parentNode.replaceChild(fragment, node);
  });
  
  console.log(`Highlighted ${matchCount} keyword matches`);
  
  // Scroll to the first highlight
  const firstHighlight = document.querySelector('.tab-ai-highlight');
  if (firstHighlight) {
    firstHighlight.scrollIntoView({
      behavior: 'smooth',
      block: 'center'
    });
  }
}

// Helper function to get all text nodes in an element
function getTextNodes(element) {
  const textNodes = [];
  const walker = document.createTreeWalker(
    element,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode: function(node) {
        // Skip script and style elements
        if (node.parentNode.tagName === 'SCRIPT' || 
            node.parentNode.tagName === 'STYLE' ||
            node.parentNode.tagName === 'NOSCRIPT') {
          return NodeFilter.FILTER_REJECT;
        }
        
        // Skip empty text nodes
        if (node.textContent.trim() === '') {
          return NodeFilter.FILTER_REJECT;
        }
        
        return NodeFilter.FILTER_ACCEPT;
      }
    }
  );
  
  let node;
  while (node = walker.nextNode()) {
    textNodes.push(node);
  }
  
  return textNodes;
}

// Add a message listener for the page to be able to communicate with the extension
window.addEventListener('message', function(event) {
  // Only accept messages from this window
  if (event.source !== window) return;
  
  if (event.data.type && event.data.type === 'TAB_AI_ASSISTANT') {
    console.log('Received TAB_AI_ASSISTANT message:', event.data.action);
    
    // Handle specific message types here if needed
    if (event.data.action === 'contentCapture') {
      // Capture visible content and send it to the extension
      const visibleContent = captureVisibleContent();
      
      chrome.runtime.sendMessage({
        action: 'contentCaptured',
        content: visibleContent
      });
    }
  }
});

// Function to capture currently visible content
function captureVisibleContent() {
  // Get viewport dimensions
  const viewportHeight = window.innerHeight;
  const viewportWidth = window.innerWidth;
  
  // Get all visible text elements
  const textElements = Array.from(document.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li, td, th, span, div'))
    .filter(el => {
      // Check if element is visible in viewport
      const rect = el.getBoundingClientRect();
      return (
        rect.top >= 0 &&
        rect.left >= 0 &&
        rect.bottom <= viewportHeight &&
        rect.right <= viewportWidth &&
        window.getComputedStyle(el).display !== 'none' &&
        window.getComputedStyle(el).visibility !== 'hidden' &&
        el.textContent.trim().length > 0
      );
    });
  
  // Extract text content
  const visibleText = textElements.map(el => el.textContent.trim()).join('\n');
  
  return {
    url: window.location.href,
    title: document.title,
    text: visibleText,
    timestamp: new Date().toISOString()
  };
}

// Notify the extension that the content script has loaded
chrome.runtime.sendMessage({
  action: 'contentScriptLoaded',
  url: window.location.href
});