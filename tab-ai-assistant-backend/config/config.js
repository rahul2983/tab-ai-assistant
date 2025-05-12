// Updated config.js with correct embedding model
require('dotenv').config();

module.exports = {
  openai: {
    apiKey: process.env.OPENAI_API_KEY,
    embeddingModel: 'text-embedding-3-small', // Changed from 'text-embedding-3-large'
    completionModel: 'gpt-4-turbo-preview'
  },
  pinecone: {
    apiKey: process.env.PINECONE_API_KEY,
    // For SDK v6.0.0, we only need the API key and index name
    index: process.env.PINECONE_INDEX || 'tab-assistant-index',
    // The following parameters are kept for reference but aren't used by SDK v6.0.0
    cloud: process.env.PINECONE_CLOUD || 'aws',
    region: process.env.PINECONE_REGION || 'us-east-1',
    // Host can be useful for direct HTTP connections or troubleshooting
    host: process.env.PINECONE_HOST || 'tab-assistant-index-5yrh4et.svc.aped-4627-b74a.pinecone.io'
  },
  server: {
    port: process.env.PORT || 3000,
    corsOrigins: process.env.CORS_ORIGINS || '*'
  },
  app: {
    maxContentLength: 20000,  // Maximum content length to process
    maxChunkSize: 1000,       // Size of text chunks for large documents
    chunkOverlap: 100,        // Overlap between chunks
    minContentLength: 50      // Minimum content length to index
  }
};