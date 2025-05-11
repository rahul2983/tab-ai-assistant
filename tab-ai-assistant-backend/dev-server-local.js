// dev-server.js
// Development server using local storage instead of Pinecone

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

// Create data directory if it doesn't exist
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Initialize express app
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Load services
console.log('Loading services...');
const tabService = require('./services/tabService');
const searchService = require('./services/searchService');

// API Routes

// Index a tab
app.post('/api/index', async (req, res, next) => {
  try {
    console.log('Indexing tab:', req.body.url);
    const result = await tabService.indexTab(req.body);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// Sync multiple tabs
app.post('/api/sync', async (req, res, next) => {
  try {
    console.log('Syncing', req.body.tabs?.length || 0, 'tabs');
    const result = await tabService.syncTabs(req.body.tabs || []);
    res.json({ success: true, results: result });
  } catch (error) {
    next(error);
  }
});

// Remove a tab
app.delete('/api/remove/:id', async (req, res, next) => {
  try {
    console.log('Removing tab:', req.params.id);
    const result = await tabService.removeTab(req.params.id);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// Search tabs
app.post('/api/search', async (req, res, next) => {
  try {
    console.log('Searching for:', req.body.query);
    const results = await searchService.searchTabs(req.body.query);
    const aiResponse = await searchService.generateAnswer(req.body.query, results);
    res.json({
      success: true,
      results: results,
      ai_answer: aiResponse.answer,
      source_tabs: aiResponse.sources
    });
  } catch (error) {
    next(error);
  }
});

// Get stats
app.get('/api/stats', async (req, res, next) => {
  try {
    console.log('Getting stats');
    const stats = await searchService.getIndexStats();
    res.json({ success: true, stats });
  } catch (error) {
    next(error);
  }
});

// Root route
app.get('/', (req, res) => {
  res.json({ 
    message: 'Tab AI Assistant API (Development Server)',
    note: 'Using local storage for development',
    endpoints: [
      '/api/index',
      '/api/sync',
      '/api/search',
      '/api/remove/:id',
      '/api/stats'
    ] 
  });
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', mode: 'development' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('API Error:', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: err.message || 'Something went wrong'
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Development server running on port ${PORT}`);
  console.log(`Root URL: http://localhost:${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`Using local storage instead of Pinecone`);
});