// tab-ai-assistant-backend/services/priorityService.js
const openaiService = require('./openaiService');
const config = require('../config/config');
const vectorService = require('./vectorService');

/**
 * Analyze tabs and predict priority/importance
 * @param {Array} tabIds - Array of tab IDs to analyze
 * @returns {Promise<Object>} - Object with priority categories and tab IDs
 */
async function analyzeTabPriorities(tabIds) {
  try {
    console.log(`Analyzing priorities for ${tabIds.length} tabs`);
    
    // Get tab details for all tabs
    const tabsDetails = await getTabsDetails(tabIds);
    
    if (!tabsDetails || tabsDetails.length === 0) {
      console.error('No tab details found for analysis');
      return { high: [], medium: [], low: [] };
    }
    
    // Get usage metrics
    const usageMetrics = await getTabsUsageMetrics(tabIds);
    
    // Merge tabs with usage data
    const tabsWithMetrics = tabsDetails.map(tab => {
      const metrics = usageMetrics[tab.id] || { lastViewed: null, viewCount: 0, timeSpent: 0 };
      return {
        ...tab,
        lastViewed: metrics.lastViewed,
        viewCount: metrics.viewCount,
        timeSpent: metrics.timeSpent
      };
    });
    
    // Format tabs for the AI analysis prompt
    const tabsText = tabsWithMetrics.map(tab => 
      `ID: ${tab.id}\nTitle: ${tab.title}\nURL: ${tab.url}\nSummary: ${tab.summary || tab.snippet || 'No summary available'}\nLast Viewed: ${tab.lastViewed || 'Unknown'}\nView Count: ${tab.viewCount || 0}\nTime Spent: ${tab.timeSpent || 0} minutes`
    ).join('\n\n');
    
    // Use OpenAI to analyze tab priorities
    const priorities = await generatePriorities(tabsText);
    
    console.log('Priorities generated:', Object.keys(priorities).map(key => `${key}: ${priorities[key].length}`));
    
    return priorities;
  } catch (error) {
    console.error('Error analyzing tab priorities:', error);
    // Return empty priorities in case of error
    return { high: [], medium: [], low: [] };
  }
}

/**
 * Generate tab priorities using OpenAI
 * @param {string} tabsText - Formatted text of tabs
 * @returns {Promise<Object>} - Object with priority categories and tab IDs
 */
async function generatePriorities(tabsText) {
  try {
    const response = await openaiService.chat.completions.create({
      model: config.openai.completionModel,
      messages: [
        {
          role: "system",
          content: `You are a tab organization assistant that helps users prioritize their browser tabs.
                    Based on the provided list of tabs with their usage metrics, categorize them into three priority levels:
                    - "high": Tabs that are important and frequently used
                    - "medium": Tabs of moderate importance or occasional use
                    - "low": Tabs that appear to be no longer needed or rarely used
                    
                    Consider these factors:
                    1. Recency of last view (more recent = higher priority)
                    2. View count (higher views = higher priority)
                    3. Time spent (more time = higher priority)
                    4. Content type (work/productivity content = higher priority than entertainment)
                    
                    Return your response as a JSON object where:
                    - Keys are priority levels: "high", "medium", "low"
                    - Values are arrays of tab IDs belonging to each priority level
                    - Each tab ID should appear in exactly one priority level`
        },
        {
          role: "user",
          content: `Here are the tabs to prioritize:\n\n${tabsText}`
        }
      ],
      temperature: 0.3,
      response_format: { type: "json_object" }
    });
    
    const prioritiesText = response.choices[0].message.content;
    try {
      // Parse the JSON response
      const priorities = JSON.parse(prioritiesText);
      return priorities;
    } catch (parseError) {
      console.error('Error parsing priorities JSON:', parseError);
      throw new Error('Invalid priority format returned');
    }
  } catch (error) {
    console.error('Error generating priorities:', error);
    throw error;
  }
}

/**
 * Get detailed information for tabs
 * @param {Array} tabIds - Array of tab IDs
 * @returns {Promise<Array>} - Array of tab details
 */
async function getTabsDetails(tabIds) {
  // Implementation depends on your storage system
  try {
    // This is a simplified implementation. In a real system,
    // you would query your database or vector store for these details.
    const tabsDetails = [];
    
    for (const tabId of tabIds) {
      try {
        // Get tab details from vector service
        const tabDetails = await vectorService.getTabDetails(tabId);
        
        if (tabDetails) {
          tabsDetails.push({
            id: tabId,
            title: tabDetails.title || 'Untitled',
            url: tabDetails.url || '',
            summary: tabDetails.summary || null,
            snippet: tabDetails.snippet || null
          });
        }
      } catch (tabError) {
        console.error(`Error getting details for tab ${tabId}:`, tabError);
        // Continue with other tabs
      }
    }
    
    return tabsDetails;
  } catch (error) {
    console.error('Error getting tab details:', error);
    return [];
  }
}

/**
 * Get usage metrics for tabs
 * @param {Array} tabIds - Array of tab IDs
 * @returns {Promise<Object>} - Object mapping tab IDs to usage metrics
 */
async function getTabsUsageMetrics(tabIds) {
  try {
    // This would typically be stored in a database
    // For simplicity, we'll return mock metrics
    const metrics = {};
    
    // Current time for relative timestamps
    const now = new Date();
    
    tabIds.forEach(tabId => {
      // Generate random metrics for demonstration
      const lastViewedHoursAgo = Math.floor(Math.random() * 168); // 0-168 hours (1 week) ago
      const viewCount = Math.floor(Math.random() * 20); // 0-20 views
      const timeSpent = Math.floor(Math.random() * 60); // 0-60 minutes
      
      // Calculate last viewed date
      const lastViewed = new Date(now - lastViewedHoursAgo * 60 * 60 * 1000);
      
      metrics[tabId] = {
        lastViewed: lastViewed.toISOString(),
        viewCount,
        timeSpent
      };
    });
    
    return metrics;
  } catch (error) {
    console.error('Error getting tab usage metrics:', error);
    return {};
  }
}

/**
 * Generate tab closure suggestions
 * @param {Array} tabIds - Array of tab IDs to analyze
 * @returns {Promise<Object>} - Suggestion results
 */
async function suggestTabsToClose(tabIds) {
  try {
    // Get priorities
    const priorities = await analyzeTabPriorities(tabIds);
    
    // Get tab details for the low priority tabs
    const lowPriorityTabIds = priorities.low || [];
    const tabsToClose = await getTabsDetails(lowPriorityTabIds);
    
    return {
      success: true,
      suggestions: tabsToClose,
      message: `Found ${tabsToClose.length} tabs that could be closed`
    };
  } catch (error) {
    console.error('Error suggesting tabs to close:', error);
    throw error;
  }
}

module.exports = {
  analyzeTabPriorities,
  suggestTabsToClose
};