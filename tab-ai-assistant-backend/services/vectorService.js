// services/vectorService.js
// Updated for Pinecone SDK v6.0.0

const { Pinecone } = require('@pinecone-database/pinecone');
const openaiService = require('./openaiService');
const config = require('../config/config');

console.log('Initializing vectorService with Pinecone Serverless...');

// Verify environment variables
if (!config.pinecone.apiKey) {
  console.error('PINECONE_API_KEY is not set in environment variables');
}

if (!config.pinecone.index) {
  console.error('PINECONE_INDEX is not set in environment variables');
}

// Initialize Pinecone client
let pinecone;
let index;
let indexInitialized = false;
let initializationInProgress = false;
let initializationError = null;

try {
  console.log(`Initializing Pinecone client with serverless configuration`);
  console.log(`API Key: ${config.pinecone.apiKey ? '✓ Set' : '✗ Not set'}`);
  
  // Get the SDK version
  const sdkVersion = require('@pinecone-database/pinecone/package.json').version;
  console.log(`Detected Pinecone SDK v${sdkVersion}`);
  
  // Initialize Pinecone client with SDK v6.0.0 format (simplified)
  pinecone = new Pinecone({
    apiKey: config.pinecone.apiKey
  });
  
  console.log('Pinecone client initialized');
} catch (error) {
  console.error('Error initializing Pinecone client:', error);
  console.error('Error details:', error.stack);
  initializationError = error;
}

// Initialize index (lazily) with timeout and retries
async function initializeIndex(retries = 3) {
  // If already initialized, return the index
  if (indexInitialized && index) {
    return index;
  }
  
  // If there was a previous error that can't be recovered without restarting
  if (initializationError) {
    throw new Error(`Pinecone initialization failed: ${initializationError.message}`);
  }
  
  // If initialization is in progress, wait for it to complete
  if (initializationInProgress) {
    console.log('Index initialization already in progress, waiting...');
    await new Promise(resolve => setTimeout(resolve, 1000));
    return initializeIndex(retries);
  }
  
  // Set flag to prevent multiple initializations
  initializationInProgress = true;
  
  try {
    console.log(`Connecting to Pinecone index: ${config.pinecone.index}`);
    
    // Connect to the index using SDK v6.0.0 format
    index = pinecone.index(config.pinecone.index);
    
    // Test the connection with a simple stats call
    const statsPromise = index.describeIndexStats();
    const statsTimeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Timeout getting index stats')), 10000)
    );
    
    const stats = await Promise.race([statsPromise, statsTimeoutPromise]);
    
    // SDK v6.0.0 returns totalRecordCount instead of totalVectorCount
    const vectorCount = stats.totalRecordCount || stats.totalVectorCount || 0;
                      
    console.log(`Successfully connected to index. Current vector count: ${vectorCount}`);
    
    // Mark as initialized
    indexInitialized = true;
    initializationInProgress = false;
    
    return index;
  } catch (error) {
    initializationInProgress = false;
    
    console.error('Error initializing Pinecone index:', error);
    
    // Retry logic
    if (retries > 0) {
      console.log(`Retrying index initialization (${retries} attempts left)...`);
      await new Promise(resolve => setTimeout(resolve, 2000));
      return initializeIndex(retries - 1);
    }
    
    // If all retries fail, throw the error
    throw error;
  }
}

/**
 * Index a tab's content in the vector database with fallback
 * @param {Object} tabData - Tab data to index
 * @returns {Promise<Object>} - Result of indexing operation
 */
async function indexTabContent(tabData) {
  try {
    console.log(`Preparing to index tab: ${tabData.title}`);
    
    // Initialize index if needed
    try {
      const pineconeIndex = await initializeIndex();
      
      // Generate embedding for tab content
      const embedding = await openaiService.generateEmbedding(tabData.content.text);
      
      console.log(`Generated embedding for tab: ${tabData.title}`);
      
      // Prepare metadata (limited to what Pinecone allows)
      // IMPORTANT: Pinecone SDK v6.0.0 does not allow null values in metadata
      const metadata = {
        url: tabData.url,
        title: tabData.title,
        snippet: tabData.content.text.substring(0, 500), // Limited preview
        timestamp: tabData.timestamp || Date.now(), // Ensure timestamp is not null
        chunkIndex: tabData.chunkIndex || 0,
        totalChunks: tabData.totalChunks || 1
      };
      
      // Only add optional fields if they exist and are not null
      if (tabData.parentId) {
        metadata.parentId = tabData.parentId;
      }
      
      if (tabData.summary) {
        metadata.summary = tabData.summary;
      }
      
      if (tabData.readingTime) {
        if (tabData.readingTime.text) {
          metadata.readingTimeText = tabData.readingTime.text;
        }
        if (typeof tabData.readingTime.minutes === 'number') {
          metadata.readingTimeMinutes = tabData.readingTime.minutes;
        }
      }
      
      if (tabData.wordCount) {
        metadata.wordCount = tabData.wordCount;
      }
      
      // Use provided ID or generate one
      const id = tabData.id || generateTabId(tabData.url);
      
      // Upsert to Pinecone - SDK v6.0.0 format
      console.log(`Upserting tab to Pinecone with ID: ${id}`);
      
      // Define the record to upsert (SDK v6.0.0 uses 'records' instead of 'vectors')
      const record = {
        id,
        values: embedding,
        metadata
      };
      
      // Use a timeout promise to prevent hanging
      const upsertPromise = pineconeIndex.upsert([record]);
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Timeout upserting to Pinecone')), 10000)
      );
      
      await Promise.race([upsertPromise, timeoutPromise]);
      
      console.log(`Successfully indexed tab in Pinecone: ${tabData.title}`);
      
      return { 
        success: true, 
        id: id,
        summary: tabData.summary || null,
        readingTime: tabData.readingTime || null,
        wordCount: tabData.wordCount || null
      };
    } catch (pineconeError) {
      console.error('Error with Pinecone, using fallback storage:', pineconeError);
      
      // Store in local memory as fallback (replace with proper local storage in production)
      const id = tabData.id || generateTabId(tabData.url);
      
      // Store in local fallback
      localFallbackStore[id] = {
        url: tabData.url,
        title: tabData.title,
        content: tabData.content.text,
        timestamp: tabData.timestamp || Date.now(),
        summary: tabData.summary || null,
        readingTime: tabData.readingTime || null,
        wordCount: tabData.wordCount || null
      };
      
      console.log(`Used fallback storage for tab: ${tabData.title}`);
      
      return { 
        success: true, 
        id: id, 
        fromFallback: true,
        summary: tabData.summary || null,
        readingTime: tabData.readingTime || null,
        wordCount: tabData.wordCount || null
      };
    }
  } catch (error) {
    console.error('Error indexing tab:', error);
    throw error;
  }
}

/**
 * Search for tabs using vector similarity with fallback
 * @param {string} query - Search query
 * @param {number} limit - Maximum number of results
 * @returns {Promise<Array>} - Array of matching tabs
 */
async function searchTabsByVector(query, limit = 10) {
  try {
    console.log(`Searching for: ${query}`);
    
    try {
      // Initialize index if needed
      const pineconeIndex = await initializeIndex();
      
      // Generate embedding for query
      const queryEmbedding = await openaiService.generateEmbedding(query);
      
      console.log(`Generated query embedding, searching Pinecone...`);
      
      // SDK v6.0.0 query format
      const queryParams = {
        vector: queryEmbedding,
        topK: limit,
        includeMetadata: true
      };
      
      // Use a timeout promise to prevent hanging
      const searchPromise = pineconeIndex.query(queryParams);
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Search timeout')), 10000)
      );
      
      const results = await Promise.race([searchPromise, timeoutPromise]);
      
      // Get matches from results (SDK v6.0.0 format)
      const matches = results.matches || [];
      
      console.log(`Pinecone search returned ${matches.length} results`);
      
      // Format and return results with proper null handling
      return matches.map(match => {
        const metadata = match.metadata || {};
        
        // Create result object with guaranteed fields
        const result = {
          id: match.id,
          score: match.score,
          url: metadata.url || '',
          title: metadata.title || '',
          snippet: metadata.snippet || '',
          timestamp: metadata.timestamp || 0
        };
        
        // Add optional fields only if they exist
        if (metadata.summary) {
          result.summary = metadata.summary;
        }
        
        if (metadata.readingTimeText || metadata.readingTimeMinutes) {
          result.readingTime = {
            text: metadata.readingTimeText || '',
            minutes: metadata.readingTimeMinutes || 0
          };
        }
        
        if (metadata.wordCount) {
          result.wordCount = metadata.wordCount;
        }
        
        return result;
      });
    } catch (pineconeError) {
      console.error('Error with Pinecone search, using fallback:', pineconeError);
      
      // Fallback to local search
      return searchLocalFallback(query, limit);
    }
  } catch (error) {
    console.error('Error searching:', error);
    throw error;
  }
}

/**
 * Remove a tab from the vector index with fallback
 * @param {string} id - ID of the tab to remove
 * @returns {Promise<Object>} - Result of removal operation
 */
async function removeTabFromIndex(id) {
  try {
    console.log(`Removing tab from index: ${id}`);
    
    try {
      // Initialize index if needed
      const pineconeIndex = await initializeIndex();
      
      // SDK v6.0.0 format for deleting records
      const deletePromise = pineconeIndex.deleteOne(id);
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Timeout deleting from Pinecone')), 10000)
      );
      
      await Promise.race([deletePromise, timeoutPromise]);
      
      console.log(`Successfully removed tab from Pinecone index`);
      
      // Also remove from local fallback if it exists
      if (localFallbackStore[id]) {
        delete localFallbackStore[id];
      }
      
      return { success: true };
    } catch (pineconeError) {
      console.error('Error with Pinecone removal, using fallback:', pineconeError);
      
      // Fallback to local removal
      if (localFallbackStore[id]) {
        delete localFallbackStore[id];
      }
      
      return { success: true, fromFallback: true };
    }
  } catch (error) {
    console.error('Error removing tab:', error);
    throw error;
  }
}

/**
 * Get statistics about the vector index with fallback
 * @returns {Promise<Object>} - Index statistics
 */
async function getIndexStats() {
  try {
    console.log('Getting index stats');
    
    try {
      // Initialize index if needed
      const pineconeIndex = await initializeIndex();
      
      // Get stats from Pinecone with timeout
      const statsPromise = pineconeIndex.describeIndexStats();
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Timeout getting index stats')), 10000)
      );
      
      const stats = await Promise.race([statsPromise, timeoutPromise]);
      
      console.log('Pinecone stats:', stats);
      
      // SDK v6.0.0 returns different stats format
      const totalVectors = stats.totalRecordCount || stats.totalVectorCount || 0;
      const namespaces = stats.namespaces || {};
      
      return {
        totalVectors,
        namespaces,
        fallbackCount: Object.keys(localFallbackStore).length
      };
    } catch (pineconeError) {
      console.error('Error getting Pinecone stats, using fallback:', pineconeError);
      
      // Return fallback stats
      return {
        totalVectors: Object.keys(localFallbackStore).length,
        namespaces: { default: { vectorCount: Object.keys(localFallbackStore).length } },
        fromFallback: true
      };
    }
  } catch (error) {
    console.error('Error getting stats:', error);
    throw error;
  }
}

/**
 * Generate a consistent ID for a tab based on its URL
 * @param {string} url - URL of the tab
 * @returns {string} - Generated ID
 */
function generateTabId(url) {
  // Simple hash function
  let hash = 0;
  for (let i = 0; i < url.length; i++) {
    const char = url.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  
  // Convert to hex string and ensure positive
  return Math.abs(hash).toString(16);
}

// Local fallback storage (for development only)
const localFallbackStore = {};

// Search local fallback
function searchLocalFallback(query, limit) {
  console.log('Searching local fallback store');
  
  const queryLower = query.toLowerCase();
  const results = [];
  
  // Simple text search
  for (const [id, data] of Object.entries(localFallbackStore)) {
    const titleLower = data.title.toLowerCase();
    const contentLower = data.content.toLowerCase();
    
    if (titleLower.includes(queryLower) || contentLower.includes(queryLower)) {
      const score = titleLower.includes(queryLower) ? 0.8 : 0.5;
      
      results.push({
        id: id,
        url: data.url,
        title: data.title,
        snippet: data.content.substring(0, 200),
        summary: data.summary || null,
        readingTime: data.readingTime || null,
        wordCount: data.wordCount || null,
        score: score,
        timestamp: data.timestamp,
        fromFallback: true
      });
    }
  }
  
  // Sort by score and limit
  results.sort((a, b) => b.score - a.score);
  return results.slice(0, limit);
}

module.exports = {
  indexTabContent,
  searchTabsByVector,
  removeTabFromIndex,
  getIndexStats
};