// services/vectorService.js
// This version uses local storage instead of Pinecone for development

// Import the local storage service instead of Pinecone
const localStorageService = require('./localStorageService');
const openaiService = require('./openaiService');
const config = require('../config/config');

console.log('Loading vectorService (local storage version)...');

/**
 * Index a tab's content in the vector database
 * @param {Object} tabData - Tab data to index
 * @returns {Promise<Object>} - Result of indexing operation
 */
async function indexTabContent(tabData) {
  try {
    console.log(`Indexing tab: ${tabData.title}`);
    
    // Use local storage service
    return await localStorageService.indexTabContent(tabData);
  } catch (error) {
    console.error('Error indexing tab in vector database:', error);
    throw error;
  }
}

/**
 * Search for tabs using vector similarity
 * @param {string} query - Search query
 * @param {number} limit - Maximum number of results
 * @returns {Promise<Array>} - Array of matching tabs
 */
async function searchTabsByVector(query, limit = 10) {
  try {
    console.log(`Searching for: ${query}`);
    
    // Use local storage service
    return await localStorageService.searchTabsByVector(query, limit);
  } catch (error) {
    console.error('Error searching vector database:', error);
    throw error;
  }
}

/**
 * Remove a tab from the vector index
 * @param {string} id - ID of the tab to remove
 * @returns {Promise<Object>} - Result of removal operation
 */
async function removeTabFromIndex(id) {
  try {
    console.log(`Removing tab with ID: ${id}`);
    
    // Use local storage service
    return await localStorageService.removeTabFromIndex(id);
  } catch (error) {
    console.error('Error removing tab from vector database:', error);
    throw error;
  }
}

/**
 * Get statistics about the vector index
 * @returns {Promise<Object>} - Index statistics
 */
async function getIndexStats() {
  try {
    console.log('Getting index stats');
    
    // Use local storage service
    return await localStorageService.getIndexStats();
  } catch (error) {
    console.error('Error getting index stats:', error);
    throw error;
  }
}

module.exports = {
  indexTabContent,
  searchTabsByVector,
  removeTabFromIndex,
  getIndexStats
};