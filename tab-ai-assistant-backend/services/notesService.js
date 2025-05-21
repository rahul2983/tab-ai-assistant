// tab-ai-assistant-backend/services/notesService.js
const config = require('../config/config');
const fs = require('fs');
const path = require('path');

// Path for storing notes (for file-based storage)
const NOTES_PATH = path.join(__dirname, '../data/notes.json');

// Initialize notes storage
let notesStore = {};

// Initialize storage
function initializeStorage() {
  try {
    // Create directory if it doesn't exist
    const dir = path.dirname(NOTES_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    // Create file if it doesn't exist
    if (!fs.existsSync(NOTES_PATH)) {
      fs.writeFileSync(NOTES_PATH, JSON.stringify({}));
    }
    
    // Load existing notes
    const notesData = fs.readFileSync(NOTES_PATH, 'utf8');
    notesStore = JSON.parse(notesData);
    
    console.log(`Notes service initialized, loaded ${Object.keys(notesStore).length} notes`);
  } catch (error) {
    console.error('Error initializing notes storage:', error);
    notesStore = {};
  }
}

// Initialize on service load
initializeStorage();

/**
 * Save a note for a tab
 * @param {string} tabId - ID of the tab
 * @param {Object} noteData - Note data object
 * @returns {Promise<Object>} - Saved note
 */
async function saveNote(tabId, noteData) {
  try {
    console.log(`Saving note for tab ${tabId}`);
    
    if (!tabId) {
      throw new Error('Tab ID is required');
    }
    
    // Prepare note object
    const note = {
      id: noteData.id || Date.now().toString(36) + Math.random().toString(36).substring(2, 5),
      tabId: tabId,
      content: noteData.content || '',
      timestamp: noteData.timestamp || new Date().toISOString(),
      lastUpdated: new Date().toISOString()
    };
    
    // Save to store
    if (!notesStore[tabId]) {
      notesStore[tabId] = [];
    }
    
    // If note ID exists, update it
    const existingIndex = notesStore[tabId].findIndex(n => n.id === note.id);
    if (existingIndex >= 0) {
      notesStore[tabId][existingIndex] = note;
    } else {
      notesStore[tabId].push(note);
    }
    
    // Save to file
    await saveNotesToFile();
    
    return note;
  } catch (error) {
    console.error('Error saving note:', error);
    throw error;
  }
}

/**
 * Get notes for a tab
 * @param {string} tabId - ID of the tab
 * @returns {Promise<Array>} - Array of notes
 */
async function getNotesForTab(tabId) {
  try {
    console.log(`Getting notes for tab ${tabId}`);
    
    if (!tabId) {
      throw new Error('Tab ID is required');
    }
    
    // Return notes or empty array
    return notesStore[tabId] || [];
  } catch (error) {
    console.error('Error getting notes:', error);
    throw error;
  }
}

/**
 * Delete a note
 * @param {string} tabId - ID of the tab
 * @param {string} noteId - ID of the note to delete
 * @returns {Promise<boolean>} - Success flag
 */
async function deleteNote(tabId, noteId) {
  try {
    console.log(`Deleting note ${noteId} for tab ${tabId}`);
    
    if (!tabId || !noteId) {
      throw new Error('Tab ID and Note ID are required');
    }
    
    // Check if tab has notes
    if (!notesStore[tabId]) {
      return false;
    }
    
    // Find and remove note
    const noteIndex = notesStore[tabId].findIndex(note => note.id === noteId);
    if (noteIndex >= 0) {
      notesStore[tabId].splice(noteIndex, 1);
      
      // Remove tab entry if no notes left
      if (notesStore[tabId].length === 0) {
        delete notesStore[tabId];
      }
      
      // Save to file
      await saveNotesToFile();
      
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('Error deleting note:', error);
    throw error;
  }
}

/**
 * Save notes to file
 * @private
 * @returns {Promise<void>}
 */
async function saveNotesToFile() {
  try {
    await fs.promises.writeFile(NOTES_PATH, JSON.stringify(notesStore, null, 2));
  } catch (error) {
    console.error('Error saving notes to file:', error);
    throw error;
  }
}

module.exports = {
  saveNote,
  getNotesForTab,
  deleteNote
};