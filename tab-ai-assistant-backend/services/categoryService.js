// tab-ai-assistant-backend/services/categoryService.js - ENHANCED VERSION
const openaiService = require('./openaiService');
const config = require('../config/config');
const fs = require('fs');
const path = require('path');

/**
 * Categorize tabs into semantic groups
 * @param {Array} tabIds - Array of tab IDs to categorize
 * @returns {Promise<Object>} - Object with category names as keys and arrays of tab IDs as values
 */
async function categorizeTabs(tabIds) {
  try {
    console.log(`Categorizing ${tabIds.length} tabs`);
    
    // Get tab details for all tabs
    const tabsDetails = await getTabsDetails(tabIds);
    
    // If we couldn't get tab details, we'll use the raw IDs instead
    if (!tabsDetails || tabsDetails.length === 0) {
      console.warn('No tab details found in metadata. Requesting info from client');
      
      // Return a special response indicating we need tab details
      return { 
        needTabDetails: true,
        message: "No tab details found. Please provide tab details from client." 
      };
    }
    
    // Format tabs for the AI categorization prompt
    const tabsText = tabsDetails.map(tab => 
      `ID: ${tab.id}\nTitle: ${tab.title}\nURL: ${tab.url}\nSummary: ${tab.summary || tab.snippet || 'No summary available'}`
    ).join('\n\n');
    
    // Use OpenAI to categorize tabs
    const categories = await generateCategories(tabsText);
    
    console.log('Categories generated:', Object.keys(categories));
    
    return categories;
  } catch (error) {
    console.error('Error categorizing tabs:', error);
    // Return all tabs as uncategorized in case of error
    return { uncategorized: tabIds };
  }
}

/**
 * Categorize tabs with provided details
 * @param {Array} tabsWithDetails - Array of tabs with details
 * @returns {Promise<Object>} - Object with category names as keys and arrays of tab IDs as values
 */
async function categorizeTabsWithDetails(tabsWithDetails) {
  try {
    console.log(`Categorizing ${tabsWithDetails.length} tabs with provided details`);
    
    if (!tabsWithDetails || tabsWithDetails.length === 0) {
      return { uncategorized: [] };
    }
    
    // Format tabs for the AI categorization prompt
    const tabsText = tabsWithDetails.map(tab => 
      `ID: ${tab.id}\nTitle: ${tab.title}\nURL: ${tab.url}\nSummary: ${tab.summary || tab.snippet || 'No summary available'}`
    ).join('\n\n');
    
    // Use OpenAI to categorize tabs
    const categories = await generateCategories(tabsText);
    
    console.log('Categories generated with provided details:', Object.keys(categories));
    
    return categories;
  } catch (error) {
    console.error('Error categorizing tabs with details:', error);
    // Return all tabs as uncategorized in case of error
    return { uncategorized: tabsWithDetails.map(tab => tab.id) };
  }
}

/**
 * Get detailed information for tabs
 * @param {Array} tabIds - Array of tab IDs
 * @returns {Promise<Array>} - Array of tab details
 */
async function getTabsDetails(tabIds) {
  try {
    console.log(`Getting details for ${tabIds.length} tabs`);
    
    // Read tab details from metadata.json file
    const metadataPath = path.join(__dirname, '../data/metadata.json');
    
    if (!fs.existsSync(metadataPath)) {
      console.log('No metadata file found, returning empty details');
      return [];
    }
    
    // Read and parse metadata
    const metadataJson = fs.readFileSync(metadataPath, 'utf8');
    const metadata = JSON.parse(metadataJson);
    
    // Collect details for each requested tab ID
    const tabsDetails = [];
    
    for (const tabId of tabIds) {
      if (metadata[tabId]) {
        tabsDetails.push({
          id: tabId,
          title: metadata[tabId].title || 'Untitled',
          url: metadata[tabId].url || '',
          summary: metadata[tabId].summary || null,
          snippet: metadata[tabId].snippet || null
        });
      } else {
        console.log(`Tab ${tabId} not found in metadata`);
      }
    }
    
    console.log(`Found details for ${tabsDetails.length} tabs`);
    return tabsDetails;
  } catch (error) {
    console.error('Error getting tab details from local storage:', error);
    return [];
  }
}

/**
 * Generate categories for tabs using OpenAI
 * @param {string} tabsText - Formatted text of tabs
 * @returns {Promise<Object>} - Object with category names as keys and arrays of tab IDs as values
 */
async function generateCategories(tabsText) {
  try {
    if (!config.openai.apiKey) {
      console.log('No OpenAI API key found, using simple categories');
      return generateSimpleCategories(tabsText);
    }
    
    console.log('Using OpenAI to generate categories');
    
    const response = await openaiService.chat.completions.create({
      model: config.openai.completionModel,
      messages: [
        {
          role: "system",
          content: `You are a tab organization assistant that categorizes browser tabs into logical groups.
                    Based on the provided list of tabs, create 3-7 meaningful categories that best organize them.
                    Consider the content, domain, and purpose of each tab.
                    Return your response as a JSON object where:
                    - Keys are category names (short, 1-3 words)
                    - Values are arrays of tab IDs that belong in that category
                    - Each tab ID should appear in exactly one category
                    - Use semantic understanding to group related tabs, not just domain matching`
        },
        {
          role: "user",
          content: `Here are the tabs to categorize:\n\n${tabsText}`
        }
      ],
      temperature: 0.3,
      response_format: { type: "json_object" }
    });
    
    const categoriesText = response.choices[0].message.content;
    try {
      // Parse the JSON response
      const categories = JSON.parse(categoriesText);
      return categories;
    } catch (parseError) {
      console.error('Error parsing categories JSON:', parseError);
      // Fall back to simple categorization
      return generateSimpleCategories(tabsText);
    }
  } catch (error) {
    console.error('Error generating categories with OpenAI:', error);
    // Fall back to simple categorization
    return generateSimpleCategories(tabsText);
  }
}

/**
 * Generate simple domain-based categories without AI
 * @param {string} tabsText - Formatted text of tabs
 * @returns {Promise<Object>} - Object with category names as keys and arrays of tab IDs as values
 */
function generateSimpleCategories(tabsText) {
  try {
    console.log('Generating simple categories based on domains');
    
    // Parse tab IDs and URLs from text
    const categories = {};
    const tabs = tabsText.split('\n\n').map(tabText => {
      const lines = tabText.split('\n');
      const idLine = lines.find(line => line.startsWith('ID:'));
      const urlLine = lines.find(line => line.startsWith('URL:'));
      
      if (!idLine || !urlLine) return null;
      
      const id = idLine.substring(4).trim();
      const url = urlLine.substring(5).trim();
      
      return { id, url };
    }).filter(Boolean);
    
    // Group by domain
    tabs.forEach(tab => {
      try {
        const url = new URL(tab.url);
        let domain = url.hostname.replace(/^www\./, '');
        
        // Extract domain category
        let category = 'Other';
        
        // Handle common domains
        if (domain.includes('github.com')) {
          category = 'Development';
        } else if (domain.includes('google.com')) {
          category = 'Google';
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
        } else {
          // Use domain as category
          const parts = domain.split('.');
          if (parts.length >= 2) {
            category = parts[parts.length - 2].charAt(0).toUpperCase() + parts[parts.length - 2].slice(1);
          }
        }
        
        // Add to category
        if (!categories[category]) {
          categories[category] = [];
        }
        
        categories[category].push(tab.id);
      } catch (urlError) {
        // Invalid URL, add to Other
        if (!categories['Other']) {
          categories['Other'] = [];
        }
        
        categories['Other'].push(tab.id);
      }
    });
    
    // Ensure we have categories
    if (Object.keys(categories).length === 0) {
      categories['All Tabs'] = tabs.map(tab => tab.id);
    }
    
    return categories;
  } catch (error) {
    console.error('Error generating simple categories:', error);
    
    // Return all tabs in one category
    const tabIds = tabsText.split('\n\n')
      .map(tabText => {
        const idLine = tabText.split('\n').find(line => line.startsWith('ID:'));
        return idLine ? idLine.substring(4).trim() : null;
      })
      .filter(Boolean);
    
    return { 'All Tabs': tabIds };
  }
}

/**
 * Get all available categories
 * @returns {Promise<Array>} - Array of category names
 */
async function getAllCategories() {
  try {
    // This would typically be stored in a database
    // For simplicity, we'll return some default categories
    return [
      'Work', 
      'Research', 
      'Shopping', 
      'News', 
      'Development', 
      'Social Media', 
      'Entertainment',
      'Travel',
      'Education',
      'Finance'
    ];
  } catch (error) {
    console.error('Error getting all categories:', error);
    return [];
  }
}

module.exports = {
  categorizeTabs,
  categorizeTabsWithDetails,
  getAllCategories
};