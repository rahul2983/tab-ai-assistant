// tab-ai-assistant-backend/routes/notesRoutes.js
const express = require('express');
const router = express.Router();
const notesService = require('../services/notesService');

/**
 * @route GET /api/notes/:tabId
 * @description Get notes for a tab
 * @access Public
 */
router.get('/notes/:tabId', async (req, res, next) => {
  try {
    const { tabId } = req.params;
    
    if (!tabId) {
      return res.status(400).json({ error: 'Tab ID is required' });
    }
    
    const notes = await notesService.getNotesForTab(tabId);
    
    res.status(200).json({
      success: true,
      notes
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route POST /api/notes/:tabId
 * @description Save a note for a tab
 * @access Public
 */
router.post('/notes/:tabId', async (req, res, next) => {
  try {
    const { tabId } = req.params;
    const noteData = req.body;
    
    if (!tabId) {
      return res.status(400).json({ error: 'Tab ID is required' });
    }
    
    if (!noteData || !noteData.content) {
      return res.status(400).json({ error: 'Note content is required' });
    }
    
    const savedNote = await notesService.saveNote(tabId, noteData);
    
    res.status(200).json({
      success: true,
      note: savedNote
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route DELETE /api/notes/:tabId/:noteId
 * @description Delete a note
 * @access Public
 */
router.delete('/notes/:tabId/:noteId', async (req, res, next) => {
  try {
    const { tabId, noteId } = req.params;
    
    if (!tabId || !noteId) {
      return res.status(400).json({ error: 'Tab ID and Note ID are required' });
    }
    
    const deleted = await notesService.deleteNote(tabId, noteId);
    
    if (deleted) {
      res.status(200).json({
        success: true,
        message: 'Note deleted successfully'
      });
    } else {
      res.status(404).json({
        success: false,
        message: 'Note not found'
      });
    }
  } catch (error) {
    next(error);
  }
});

module.exports = router;