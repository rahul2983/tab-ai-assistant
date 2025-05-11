# Tab AI Assistant Backend

A Node.js backend service for the Tab AI Assistant Chrome extension that provides vector search and AI-powered answers using Pinecone and OpenAI.

## Overview

This backend handles the indexing, storage, and retrieval of browser tab content using:

- **OpenAI embeddings** for semantic search
- **Pinecone Serverless** for vector storage
- **Express.js** for API endpoints
- **RAG (Retrieval-Augmented Generation)** for AI-powered answers

## Features

- **Tab Content Indexing**: Store and index web page content from browser tabs
- **Vector Search**: Find semantically similar content across indexed tabs
- **AI-Powered Answers**: Generate contextual answers based on your browsing history
- **Serverless Architecture**: Uses Pinecone Serverless for better scalability and reduced costs
- **Automatic Text Chunking**: Handles large documents by splitting into semantic chunks
- **Robust Error Handling**: Includes fallback mechanisms and comprehensive error handling

## Requirements

- Node.js 14+
- OpenAI API key
- Pinecone API key (with serverless configuration)

## Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/rahul2983/tab-ai-assistant-backend.git
   cd tab-ai-assistant-backend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env` file in the project root with the following variables:
   ```env
   # OpenAI Configuration
   OPENAI_API_KEY=YOUR_OPENAI_API_KEY
   
   # Pinecone Configuration
   PINECONE_API_KEY=YOUR_API_KEY
   PINECONE_INDEX=YOUR_INDEX
   PINECONE_REGION=YOUR_PINECONE_REGION
   
   # Server Configuration
   PORT=3000
   CORS_ORIGINS=*
   ```

4. Start the server:
   ```bash
   npm start
   ```
   
   For development with auto-reload:
   ```bash
   npm run dev
   ```

## API Endpoints

### Tab Indexing

#### `POST /api/index`
Index a single tab's content

**Request Body:**
```json
{
  "url": "https://example.com/page",
  "title": "Example Page Title",
  "content": {
    "text": "Page content goes here...",
    "meta": {
      "description": "Optional metadata"
    }
  },
  "timestamp": "2023-05-15T12:34:56Z"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Tab indexed successfully",
  "id": "a1b2c3d4"
}
```

#### `POST /api/sync`
Index multiple tabs at once

**Request Body:**
```json
{
  "tabs": [
    {
      "url": "https://example.com/page1",
      "title": "Example Page 1",
      "content": { "text": "Content 1" },
      "timestamp": "2023-05-15T12:34:56Z"
    },
    {
      "url": "https://example.com/page2",
      "title": "Example Page 2",
      "content": { "text": "Content 2" },
      "timestamp": "2023-05-15T12:35:56Z"
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "results": [
    {
      "url": "https://example.com/page1",
      "title": "Example Page 1",
      "success": true,
      "id": "a1b2c3d4"
    },
    {
      "url": "https://example.com/page2",
      "title": "Example Page 2",
      "success": true,
      "id": "e5f6g7h8"
    }
  ]
}
```

### Search & AI Answers

#### `POST /api/search`
Search indexed tabs and get AI-generated answers

**Request Body:**
```json
{
  "query": "what is the capital of france"
}
```

**Response:**
```json
{
  "success": true,
  "results": [
    {
      "id": "a1b2c3d4",
      "url": "https://example.com/france",
      "title": "Facts about France",
      "snippet": "Paris is the capital and most populous city of France...",
      "score": 0.92,
      "timestamp": "2023-05-15T12:34:56Z"
    },
    ...
  ],
  "ai_answer": "The capital of France is Paris. According to the information in Tab 1, Paris is not only the capital but also the most populous city in France.",
  "source_tabs": [
    ...
  ]
}
```

### Management

#### `DELETE /api/remove/:id`
Remove a tab from the index

**Response:**
```json
{
  "success": true,
  "message": "Tab removed from index",
  "id": "a1b2c3d4"
}
```

#### `GET /api/stats`
Get statistics about indexed tabs

**Response:**
```json
{
  "success": true,
  "stats": {
    "totalVectors": 125,
    "namespaces": {
      "default": {
        "vectorCount": 125
      }
    }
  }
}
```

## Architecture

### Core Components

1. **Express Server**: Handles API routes and middleware
   - File: `server.js`

2. **Tab Service**: Processes tab content for indexing
   - File: `services/tabService.js`
   - Handles text processing, chunking, and preparation for vector storage

3. **Vector Service**: Manages vector database operations
   - File: `services/vectorService.js` 
   - Interfaces with Pinecone Serverless
   - Includes fallback mechanisms for error handling

4. **OpenAI Service**: Handles AI operations
   - File: `services/openaiService.js`
   - Generates embeddings for vector search
   - Creates AI responses using RAG

5. **Search Service**: Coordinates search operations
   - File: `services/searchService.js`
   - Combines vector search with AI answer generation

6. **Configuration**: Manages environment settings
   - File: `config/config.js`
   - Centralizes all configuration options

### Data Flow

1. **Indexing Process**:
   - Tab content is received via API
   - Content is processed and chunked if necessary
   - OpenAI generates embeddings for the content
   - Embeddings and metadata are stored in Pinecone

2. **Search Process**:
   - Query is received via API
   - OpenAI generates embedding for the query
   - Pinecone performs vector similarity search
   - Matching tabs are retrieved with relevance scores

3. **AI Answer Generation**:
   - Most relevant tab content is extracted
   - Content is formatted as context for OpenAI
   - OpenAI generates a contextual answer
   - Answer and source tabs are returned to the client

## Advanced Configuration

The `config/config.js` file provides several configuration options:

```javascript
module.exports = {
  openai: {
    apiKey: process.env.OPENAI_API_KEY,
    embeddingModel: 'text-embedding-3-small',
    completionModel: 'gpt-4-turbo-preview' // Or 'gpt-3.5-turbo' for lower cost
  },
  pinecone: {
    apiKey: process.env.PINECONE_API_KEY,
    region: process.env.PINECONE_REGION || 'us-east-1',
    index: process.env.PINECONE_INDEX || 'tab-assistant-index'
  },
  server: {
    port: process.env.PORT || 3000,
    corsOrigins: process.env.CORS_ORIGINS || '*'
  },
  app: {
    maxContentLength: 20000,
    maxChunkSize: 1000,
    chunkOverlap: 100,
    minContentLength: 50
  }
}
```

## Pinecone Serverless Configuration

This backend uses Pinecone Serverless for scalable vector storage:

1. **Setup**:
   - Create a Pinecone account at https://www.pinecone.io/
   - Create a new serverless index named `tab-assistant-index` with dimension `1536` 
   - Get your API key from the Pinecone dashboard
   - Set the region to match your chosen deployment region

2. **Configuration**:
   - The backend will automatically create the index if `AUTO_CREATE_INDEX=true`
   - Serverless indexes scale automatically based on usage
   - Dimension `1536` is used for compatibility with OpenAI embeddings

## Error Handling & Fallbacks

The backend implements several error handling mechanisms:

1. **Connection Retries**: Automatic retries for Pinecone connections
2. **Local Fallback**: In-memory fallback if vector database is unavailable
3. **Request Timeouts**: All external API calls have timeouts to prevent hanging
4. **Comprehensive Logging**: Detailed logging for troubleshooting

## Deployment

### Local Development

```bash
npm run dev
```

### Production Deployment

The backend can be deployed to various platforms:

1. **Traditional Server**:
   ```bash
   npm start
   ```

2. **Docker**:
   - Build: `docker build -t tab-ai-backend .`
   - Run: `docker run -p 3000:3000 tab-ai-backend`

3. **Serverless Platforms**:
   - AWS Lambda
   - Vercel
   - Netlify Functions

## Extension Integration

To connect with the Tab AI Assistant Chrome extension:

1. The extension communicates with this backend via the API endpoints
2. Set the `CORS_ORIGINS` to your extension ID in the format: `chrome-extension://your-extension-id`
3. In the extension, set the API endpoint to wherever this backend is hosted

## License

[MIT License](LICENSE)

## Acknowledgements

- Built with Node.js and Express
- Uses OpenAI's API for embeddings and RAG
- Implements Pinecone Serverless for vector storage