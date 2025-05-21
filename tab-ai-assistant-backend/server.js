// server.js
// Server using Pinecone Serverless and OpenAI

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const config = require('./config/config');

const indexRoutes = require('./routes/indexRoutes');
const searchRoutes = require('./routes/searchRoutes');
const categoryRoutes = require('./routes/categoryRoutes');
const notesRoutes = require('./routes/notesRoutes');
const historyRoutes = require('./routes/historyRoutes');
const priorityRoutes = require('./routes/priorityRoutes');

// Initialize express app
const app = express();
const PORT = config.server.port;

// Middleware
app.use(cors({
  origin: config.server.corsOrigins
}));
app.use(express.json({ limit: '10mb' }));

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Routes
app.use('/api', indexRoutes);
app.use('/api', searchRoutes);
app.use('/api', categoryRoutes);
app.use('/api', notesRoutes);
app.use('/api', historyRoutes);
app.use('/api', priorityRoutes);

// Root route
app.get('/', (req, res) => {
  res.json({ 
    message: 'Tab AI Assistant API',
    version: '1.0.0',
    endpoints: [
      '/api/index',
      '/api/sync',
      '/api/search',
      '/api/remove/:id',
      '/api/stats'
    ],
    mode: 'serverless'
  });
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', mode: 'serverless' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('API Error:', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: err.message || 'Something went wrong'
  });
});

// For local development only
if (process.env.NODE_ENV !== 'production') {
  // Start server for local development
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Root URL: http://localhost:${PORT}`);
    console.log(`Health check: http://localhost:${PORT}/health`);
  });
}

// Export the Express app for serverless functions
module.exports = app;