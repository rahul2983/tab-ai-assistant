const express = require('express');
const router = express.Router();
const searchService = require('../services/searchService');

/**
 * @route POST /api/search
 * @description Search indexed tabs and get AI-generated answers
 * @access Public
 */
router.post('/search', async (req, res, next) => {
  try {
    const { query } = req.body;
    
    if (!query || typeof query !== 'string') {
      return res.status(400).json({ error: 'Search query is required' });
    }
    
    // Search for relevant tabs
    const searchResults = await searchService.searchTabs(query);
    
    // Generate AI answer based on search results
    const aiResponse = await searchService.generateAnswer(query, searchResults);
    
    res.status(200).json({
      success: true,
      results: searchResults,
      ai_answer: aiResponse.answer,
      source_tabs: aiResponse.sources
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route GET /api/stats
 * @description Get statistics about indexed tabs
 * @access Public
 */
router.get('/stats', async (req, res, next) => {
  try {
    // Get index statistics
    const stats = await searchService.getIndexStats();
    
    res.status(200).json({
      success: true,
      stats: stats
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;