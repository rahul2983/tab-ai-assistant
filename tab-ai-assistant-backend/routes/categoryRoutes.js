// tab-ai-assistant-backend/routes/categoryRoutes.js - ENHANCED VERSION
const express = require('express');
const router = express.Router();
const categoryService = require('../services/categoryService');

/**
 * @route POST /api/categorize
 * @description Categorize tabs into groups
 * @access Public
 */
router.post('/categorize', async (req, res, next) => {
  try {
    const { tabIds } = req.body;
    
    if (!Array.isArray(tabIds) || tabIds.length === 0) {
      return res.status(400).json({ error: 'Tab IDs array is required' });
    }
    
    // Process and categorize tabs
    const categories = await categoryService.categorizeTabs(tabIds);
    
    // Check if we need tab details from client
    if (categories.needTabDetails) {
      res.status(200).json({
        success: true,
        needTabDetails: true,
        message: categories.message
      });
    } else {
      // Return normal categories
      res.status(200).json({
        success: true,
        categories
      });
    }
  } catch (error) {
    next(error);
  }
});

/**
 * @route POST /api/categorize-with-details
 * @description Categorize tabs with provided details
 * @access Public
 */
router.post('/categorize-with-details', async (req, res, next) => {
  try {
    const { tabs } = req.body;
    
    if (!Array.isArray(tabs) || tabs.length === 0) {
      return res.status(400).json({ error: 'Tabs array is required' });
    }
    
    // Process and categorize tabs with details
    const categories = await categoryService.categorizeTabsWithDetails(tabs);
    
    res.status(200).json({
      success: true,
      categories
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route GET /api/categories
 * @description Get all available categories
 * @access Public
 */
router.get('/categories', async (req, res, next) => {
  try {
    const categories = await categoryService.getAllCategories();
    
    res.status(200).json({
      success: true,
      categories
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;