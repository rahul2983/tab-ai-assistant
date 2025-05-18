// tab-ai-assistant-backend/routes/priorityRoutes.js
const express = require('express');
const router = express.Router();
const priorityService = require('../services/priorityService');

/**
 * @route POST /api/priorities
 * @description Analyze tab priorities
 * @access Public
 */
router.post('/priorities', async (req, res, next) => {
  try {
    const { tabIds } = req.body;
    
    if (!Array.isArray(tabIds) || tabIds.length === 0) {
      return res.status(400).json({ error: 'Tab IDs array is required' });
    }
    
    // Analyze tab priorities
    const priorities = await priorityService.analyzeTabPriorities(tabIds);
    
    res.status(200).json({
      success: true,
      priorities
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route POST /api/suggest-tabs-to-close
 * @description Get suggestions for tabs that could be closed
 * @access Public
 */
router.post('/suggest-tabs-to-close', async (req, res, next) => {
  try {
    const { tabIds } = req.body;
    
    if (!Array.isArray(tabIds) || tabIds.length === 0) {
      return res.status(400).json({ error: 'Tab IDs array is required' });
    }
    
    // Get suggestions
    const suggestions = await priorityService.suggestTabsToClose(tabIds);
    
    res.status(200).json({
      success: true,
      suggestions: suggestions.suggestions,
      message: suggestions.message
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;