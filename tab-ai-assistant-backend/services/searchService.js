const vectorService = require('./vectorService');
const openaiService = require('./openaiService');

/**
 * Search for tabs matching a query
 * @param {string} query - Search query
 * @param {number} limit - Maximum number of results to return
 * @returns {Promise<Array>} - Array of matching tabs
 */
async function searchTabs(query, limit = 10) {
  try {
    const results = await vectorService.searchTabsByVector(query, limit);
    return results;
  } catch (error) {
    console.error('Error searching tabs:', error);
    throw error;
  }
}

/**
 * Generate an AI answer based on query and search results
 * @param {string} query - User's query
 * @param {Array} searchResults - Array of search results
 * @returns {Promise<Object>} - AI-generated answer and source tabs
 */
async function generateAnswer(query, searchResults) {
  try {
    if (!searchResults || searchResults.length === 0) {
      return {
        answer: "I couldn't find any relevant information in your tabs for this query.",
        sources: []
      };
    }
    
    // Format context from search results
    let context = "";
    
    searchResults.forEach((result, index) => {
      context += `[Tab ${index + 1}: ${result.title}]\n`;
      context += `${result.snippet || "No preview available"}\n`;
      context += `URL: ${result.url}\n\n`;
    });
    
    // Generate response using OpenAI
    const answer = await openaiService.generateTabAnswer(query, context, searchResults);
    
    return {
      answer: answer,
      sources: searchResults.slice(0, 3) // Return top 3 sources
    };
  } catch (error) {
    console.error('Error generating AI answer:', error);
    return {
      answer: "Sorry, I encountered an error while generating an answer. Please try again.",
      sources: []
    };
  }
}

/**
 * Get statistics about the vector index
 * @returns {Promise<Object>} - Index statistics
 */
async function getIndexStats() {
  try {
    const stats = await vectorService.getIndexStats();
    return stats;
  } catch (error) {
    console.error('Error getting index stats:', error);
    throw error;
  }
}

module.exports = {
  searchTabs,
  generateAnswer,
  getIndexStats
};