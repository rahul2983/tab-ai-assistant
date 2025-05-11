require('dotenv').config();

module.exports = {
  openai: {
    apiKey: process.env.OPENAI_API_KEY,
    embeddingModel: 'text-embedding-3-small',
    completionModel: 'gpt-4-turbo-preview'  // You can use 'gpt-3.5-turbo' for lower cost
  },
  pinecone: {
    apiKey: process.env.PINECONE_API_KEY,
    environment: process.env.PINECONE_ENVIRONMENT,
    index: process.env.PINECONE_INDEX || 'tab-assistant-index'
  },
  server: {
    port: process.env.PORT || 3000,
    corsOrigins: process.env.CORS_ORIGINS || '*'  // In production, specify allowed origins
  },
  app: {
    maxContentLength: 20000,  // Maximum content length to process
    maxChunkSize: 1000,       // Size of text chunks for large documents
    chunkOverlap: 100,        // Overlap between chunks
    minContentLength: 50      // Minimum content length to index
  },
  security: {
    // Optional: Add JWT secret if implementing authentication
    jwtSecret: process.env.JWT_SECRET
  }
};