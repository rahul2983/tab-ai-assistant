const express = require('express');
const router = express.Router();
const tabService = require('../services/tabService');
const categoryService = require('../services/categoryService'); // New service

/**
 * @route POST /api/index
 * @description Index a tab's content
 * @access Public
 */
router.post('/index', async (req, res, next) => {
  try {
    const tabData = req.body;
    
    // Validate request
    if (!tabData.url || !tabData.title || !tabData.content) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    // Process and index the tab
    const result = await tabService.indexTab(tabData);
    
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * @route POST /api/sync
 * @description Sync multiple tabs at once
 * @access Public
 */
router.post('/sync', async (req, res, next) => {
  try {
    const { tabs } = req.body;
    
    if (!Array.isArray(tabs) || tabs.length === 0) {
      return res.status(400).json({ error: 'Tabs array is required' });
    }
    
    // Process and index multiple tabs
    const results = await tabService.syncTabs(tabs);
    
    res.status(200).json({
      success: true,
      results: results
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route DELETE /api/remove/:id
 * @description Remove a tab from the index
 * @access Public
 */
router.delete('/remove/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    
    if (!id) {
      return res.status(400).json({ error: 'Tab ID is required' });
    }
    
    // Remove the tab from the index
    const result = await tabService.removeTab(id);
    
    res.status(200).json(