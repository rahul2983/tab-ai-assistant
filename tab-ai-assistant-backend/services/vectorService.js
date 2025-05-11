// services/vectorService.js
// Pinecone Serverless implementation

const { Pinecone } = require('@pinecone-database/pinecone');
const openaiService = require('./openaiService');
const config = require('../config/config');

console.log('Initializing vectorService with Pinecone Serverless...');

// Verify environment variables
if (!config.pinecone.apiKey) {
  console.error('PINECONE_API_KEY is not set in environment variables');
}

if (!config.pinecone.region) {
  console.error('PINECONE_REGION is not set in environment variables');
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
  console.log(`Cloud: aws`); // Added cloud provider
  console.log(`Region: ${config.pinecone.region || 'us-east-1'}`);
  
  // Correct serverless initialization
  pinecone = new Pinecone({
    apiKey: config.pinecone.apiKey,
    // Serverless configuration
    serverlessSpec: {
      cloud: 'aws', // or 'gcp' if using Google Cloud
      region: config.pinecone.region || 'us-east-1'
    }
  });
  
  console.log('Pinecone client initialized');
} catch (error) {
  console.error('Error initializing Pinecone client:', error);
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
    
    // List all available indexes with timeout
    const listPromise = pinecone.listIndexes();
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Timeout listing Pinecone indexes')), 10000)
    );
    
    const indexList = await Promise.race([listPromise, timeoutPromise]);
    console.log('Available Pinecone indexes:', indexList);
    
    // Check if our index exists
    const indexExists = indexList.includes(config.pinecone.index);
    if (!indexExists) {
      if (process.env.AUTO_CREATE_INDEX === 'true') {
        console.log(`Index ${config.pinecone.index} not found. Creating new serverless index...`);
        
        // Create serverless index with proper configuration
        await pinecone.createIndex({
          name: config.pinecone.index,
          dimension: 1536, // For OpenAI embeddings
          metric: 'cosine',
          spec: {
            serverless: {
              cloud: 'aws',
              region: config.pinecone.region || 'us-east-1'
            }
          }
        });
        
        console.log(`Serverless index ${config.pinecone.index} creation initiated.`);
        console.log(`Waiting for initialization...`);
        
        // Wait for index to initialize (this can take time)
        await new Promise(resolve => setTimeout(resolve, 60000)); // 1 minute
        
        console.log('Index initialization wait time complete');
      } else {
        throw new Error(`Pinecone index "${config.pinecone.index}" does not exist. Available indexes: ${indexList.join(', ')}`);
      }
    }
    
    // For serverless indexes, use Index() method (capital I)
    console.log(`Connecting to serverless index: ${config.pinecone.index}`);
    index = pinecone.Index(config.pinecone.index);
    
    // Test the connection with a simple stats call
    const statsPromise = index.describeIndexStats();
    const statsTimeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Timeout getting index stats')), 10000)
    );
    
    const stats = await Promise.race([statsPromise, statsTimeoutPromise]);
    console.log(`Successfully connected to serverless index. Current vector count: ${stats.totalVectorCount}`);
    
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

// The rest of your functions remain the same
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
      const metadata = {
        url: tabData.url,
        title: tabData.title,
        snippet: tabData.content.text.substring(0, 500), // Limited preview
        timestamp: tabData.timestamp,
        parentId: tabData.parentId || null,
        chunkIndex: tabData.chunkIndex || 0,
        totalChunks: tabData.totalChunks || 1
      };
      
      // Use provided ID or generate one
      const id = tabData.id || generateTabId(tabData.url);
      
      // Upsert to Pinecone with timeout
      console.log(`Upserting tab to Pinecone with ID: ${id}`);
      
      const upsertPromise = pineconeIndex.upsert([{
        id: id,
        values: embedding,
        metadata: metadata
      }]);
      
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Timeout upserting to Pinecone')), 10000)
      );
      
      await Promise.race([upsertPromise, timeoutPromise]);
      
      console.log(`Successfully indexed tab in Pinecone: ${tabData.title}`);
      
      return { success: true, id: id };
    } catch (pineconeError) {
      console.error('Error with Pinecone, using fallback storage:', pineconeError);
      
      // Store in local memory as fallback (replace with proper local storage in production)
      const id = tabData.id || generateTabId(tabData.url);
      
      // Store in local fallback (this is just for development)
      localFallbackStore[id] = {
        url: tabData.url,
        title: tabData.title,
        content: tabData.content.text,
        timestamp: tabData.timestamp
      };
      
      console.log(`Used fallback storage for tab: ${tabData.title}`);
      
      return { success: true, id: id, fromFallback: true };
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
      
      // Search in Pinecone with timeout
      const searchPromise = pineconeIndex.query({
        vector: queryEmbedding,
        topK: limit,
        includeMetadata: true
      });
      
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Timeout searching Pinecone')), 10000)
      );
      
      const results = await Promise.race([searchPromise, timeoutPromise]);
      
      console.log(`Pinecone search returned ${results.matches.length} results`);
      
      // Format and return results
      return results.matches.map(match => ({
        id: match.id,
        url: match.metadata.url,
        title: match.metadata.title,
        snippet: match.metadata.snippet,
        score: match.score,
        timestamp: match.metadata.timestamp
      }));
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
      
      // Delete from Pinecone with timeout
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
      
      return {
        totalVectors: stats.totalVectorCount,
        namespaces: stats.namespaces,
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