// tab-ai-assistant-backend/routes/historyRoutes.js
const express = require('express');
const router = express.Router();
const historyService = require('../services/historyService');

/**
 * @route POST /api/history/record
 * @description Record a tab closure in history
 * @access Public
 */
router.post('/history/record', async (req, res, next) => {
  try {
    const tabData = req.body;
    
    if (!tabData || !tabData.url) {
      return res.status(400).json({ error: 'Tab data is required' });
    }
    
    const historyItem = await historyService.recordTabClosure(tabData);
    
    res.status(200).json({
      success: true,
      historyItem
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route GET /api/history
 * @description Get tab history with optional filtering
 * @access Public
 */
router.get('/history', async (req, res, next) => {
  try {
    const options = {
      limit: req.query.limit ? parseInt(req.query.limit) : 100,
      query: req.query.query,
      startDate: req.query.startDate,
      endDate: req.query.endDate
    };
    
    const history = await historyService.getTabHistory(options);
    
    res.status(200).json({
      success: true,
      history
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route GET /api/history/:historyId
 * @description Get a specific history item
 * @access Public
 */
router.get('/history/:historyId', async (req, res, next) => {
  try {
    const { historyId } = req.params;
    
    if (!historyId) {
      return res.status(400).json({ error: 'History ID is required' });
    }
    
    const historyItem = await historyService.getHistoryItem(historyId);
    
    res.status(200).json({
      success: true,
      historyItem
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route DELETE /api/history/:historyId
 * @description Delete a history item
 * @access Public
 */
router.delete('/history/:historyId', async (req, res, next) => {
  try {
    const { historyId } = req.params;
    
    if (!historyId) {
      return res.status(400).json({ error: 'History ID is required' });
    }
    
    const deleted = await historyService.deleteHistoryItem(historyId);
    
    if (deleted) {
      res.status(200).json({
        success: true,
        message: 'History item deleted successfully'
      });
    } else {
      res.status(404).json({
        success: false,
        message: 'History item not found'
      });
    }
  } catch (error) {
    next(error);
  }
});

/**
 * @route DELETE /api/history
 * @description Clear all history
 * @access Public
 */
router.delete('/history', async (req, res, next) => {
  try {
    await historyService.clearHistory();
    
    res.status(200).json({
      success: true,
      message: 'History cleared successfully'
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;