// services/localStorageService.js
const fs = require('fs');
const path = require('path');
const { OpenAI } = require('openai');
const config = require('../config/config');

// Initialize OpenAI client (for embeddings)
const openai = new OpenAI({
  apiKey: config.openai.apiKey
});

// Local storage directory
const STORAGE_DIR = path.join(__dirname, '../data');
const VECTOR_FILE = path.join(STORAGE_DIR, 'vectors.json');
const METADATA_FILE = path.join(STORAGE_DIR, 'metadata.json');

// Create storage directory if it doesn't exist
if (!fs.existsSync(STORAGE_DIR)) {
  fs.mkdirSync(STORAGE_DIR, { recursive: true });
}

// Initialize storage files if they don't exist
if (!fs.existsSync(VECTOR_FILE)) {
  fs.writeFileSync(VECTOR_FILE, JSON.stringify({}));
}

if (!fs.existsSync(METADATA_FILE)) {
  fs.writeFileSync(METADATA_FILE, JSON.stringify({}));
}

// Load data from storage
function loadVectors() {
  try {
    const data = fs.readFileSync(VECTOR_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error loading vectors:', error);
    return {};
  }
}

function loadMetadata() {
  try {
    const data = fs.readFileSync(METADATA_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error loading metadata:', error);
    return {};
  }
}

// Save data to storage
function saveVectors(vectors) {
  try {
    fs.writeFileSync(VECTOR_FILE, JSON.stringify(vectors, null, 2));
  } catch (error) {
    console.error('Error saving vectors:', error);
  }
}

function saveMetadata(metadata) {
  try {
    fs.writeFileSync(METADATA_FILE, JSON.stringify(metadata, null, 2));
  } catch (error) {
    console.error('Error saving metadata:', error);
  }
}

/**
 * Generate embedding for text using OpenAI
 * @param {string} text - Text to embed
 * @returns {Promise<Array>} - Embedding vector
 */
async function generateEmbedding(text) {
  try {
    // If OpenAI API key is not available, return a mock embedding
    if (!config.openai.apiKey) {
      console.log('No OpenAI API key found, using mock embedding');
      return Array(1536).fill(0).map(() => Math.random() * 2 - 1);
    }
    
    // Truncate text if too long
    const truncatedText = text.substring(0, 8000);
    
    const response = await openai.embeddings.create({
      model: config.openai.embeddingModel,
      input: truncatedText
    });
    
    return response.data[0].embedding;
  } catch (error) {
    console.error('Error generating embedding:', error);
    // Return a mock embedding in case of error
    return Array(1536).fill(0).map(() => Math.random() * 2 - 1);
  }
}

/**
 * Calculate cosine similarity between two vectors
 * @param {Array} vec1 - First vector
 * @param {Array} vec2 - Second vector
 * @returns {number} - Similarity score between 0 and 1
 */
function cosineSimilarity(vec1, vec2) {
  let dotProduct = 0;
  let mag1 = 0;
  let mag2 = 0;
  
  for (let i = 0; i < vec1.length; i++) {
    dotProduct += vec1[i] * vec2[i];
    mag1 += vec1[i] * vec1[i];
    mag2 += vec2[i] * vec2[i];
  }
  
  mag1 = Math.sqrt(mag1);
  mag2 = Math.sqrt(mag2);
  
  if (mag1 === 0 || mag2 === 0) {
    return 0;
  }
  
  return dotProduct / (mag1 * mag2);
}

/**
 * Index a tab's content using local storage
 * @param {Object} tabData - Tab data to index
 * @returns {Promise<Object>} - Result of indexing operation
 */
async function indexTabContent(tabData) {
  try {
    // Generate embedding for tab content
    const embedding = await generateEmbedding(tabData.content.text);
    
    // Use provided ID or generate one
    const id = tabData.id || generateTabId(tabData.url);
    
    // Load current data
    const vectors = loadVectors();
    const metadata = loadMetadata();
    
    // Add new data
    vectors[id] = embedding;
    metadata[id] = {
      url: tabData.url,
      title: tabData.title,
      snippet: tabData.content.text.substring(0, 500), // Store a preview
      timestamp: tabData.timestamp,
      parentId: tabData.parentId || null,
      chunkIndex: tabData.chunkIndex || 0,
      totalChunks: tabData.totalChunks || 1
    };
    
    // Save data
    saveVectors(vectors);
    saveMetadata(metadata);
    
    return { success: true, id: id };
  } catch (error) {
    console.error('Error indexing tab in local storage:', error);
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
    // Generate embedding for query
    const queryEmbedding = await generateEmbedding(query);
    
    // Load data
    const vectors = loadVectors();
    const metadata = loadMetadata();
    
    // Calculate similarities
    const results = [];
    
    for (const [id, vector] of Object.entries(vectors)) {
      const similarity = cosineSimilarity(queryEmbedding, vector);
      
      results.push({
        id,
        similarity,
        ...metadata[id]
      });
    }
    
    // Sort by similarity and limit results
    results.sort((a, b) => b.similarity - a.similarity);
    
    // Return top results
    return results.slice(0, limit).map(result => ({
      id: result.id,
      url: result.url,
      title: result.title,
      snippet: result.snippet,
      score: result.similarity,
      timestamp: result.timestamp
    }));
  } catch (error) {
    console.error('Error searching in local storage:', error);
    throw error;
  }
}

/**
 * Remove a tab from local storage
 * @param {string} id - ID of the tab to remove
 * @returns {Promise<Object>} - Result of removal operation
 */
async function removeTabFromIndex(id) {
  try {
    // Load data
    const vectors = loadVectors();
    const metadata = loadMetadata();
    
    // Get metadata for the tab
    const tabMetadata = metadata[id];
    
    if (!tabMetadata) {
      return { success: false, message: 'Tab not found' };
    }
    
    // IDs to delete
    const idsToDelete = [id];
    
    // Check if this is a parent of chunks
    for (const [tabId, meta] of Object.entries(metadata)) {
      if (meta.parentId === id) {
        idsToDelete.push(tabId);
      }
    }
    
    // Delete from storage
    for (const tabId of idsToDelete) {
      delete vectors[tabId];
      delete metadata[tabId];
    }
    
    // Save data
    saveVectors(vectors);
    saveMetadata(metadata);
    
    return { success: true };
  } catch (error) {
    console.error('Error removing tab from local storage:', error);
    throw error;
  }
}

/**
 * Get statistics about the local storage
 * @returns {Promise<Object>} - Storage statistics
 */
async function getIndexStats() {
  try {
    // Load data
    const vectors = loadVectors();
    const metadata = loadMetadata();
    
    return {
      totalVectors: Object.keys(vectors).length,
      namespaces: {
        default: {
          vectorCount: Object.keys(vectors).length
        }
      }
    };
  } catch (error) {
    console.error('Error getting local storage stats:', error);
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

module.exports = {
  indexTabContent,
  searchTabsByVector,
  removeTabFromIndex,
  getIndexStats,
  generateEmbedding
};