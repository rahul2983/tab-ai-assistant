// tab-ai-assistant/js/notes.js - Notes functionality for tabs

/**
 * Initialize tab notes functionality
 */
function initTabNotes() {
    console.log('Initializing tab notes');
    
    // Add event listeners to note buttons
    document.querySelectorAll('.btn-notes').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const tabId = btn.dataset.id;
        const tabTitle = btn.dataset.title;
        openNotesModal(tabId, tabTitle);
      });
    });
    
    // Add event listener to close modal
    document.addEventListener('click', (e) => {
      const modal = document.getElementById('notes-modal');
      if (modal && e.target.classList.contains('modal-overlay')) {
        closeNotesModal();
      }
    });
    
    // Handle escape key for modal
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closeNotesModal();
      }
    });
  }
  
  /**
   * Open the notes modal for a tab
   * @param {string} tabId - ID of the tab
   * @param {string} tabTitle - Title of the tab
   */
  async function openNotesModal(tabId, tabTitle) {
    // Create modal if it doesn't exist
    let modal = document.getElementById('notes-modal');
    
    if (!modal) {
      modal = createNotesModal();
      document.body.appendChild(modal);
    }
    
    // Update modal title
    const modalTitle = modal.querySelector('.modal-title');
    modalTitle.textContent = `Notes for: ${tabTitle}`;
    
    // Store tab ID in the modal
    modal.dataset.tabId = tabId;
    
    // Load notes for this tab
    await loadNotes(tabId);
    
    // Show modal
    modal.classList.add('visible');
  }
  
  /**
   * Create the notes modal element
   * @returns {HTMLElement} - Modal element
   */
  function createNotesModal() {
    const modal = document.createElement('div');
    modal.id = 'notes-modal';
    modal.className = 'modal-overlay';
    
    modal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h3 class="modal-title">Notes</h3>
          <button class="modal-close">&times;</button>
        </div>
        <div class="modal-body">
          <div id="notes-list" class="notes-list">
            <div class="loading">Loading notes...</div>
          </div>
          <div class="new-note-form">
            <textarea id="new-note-content" placeholder="Add a new note..."></textarea>
            <button id="save-note-btn" class="save-note-btn">Save Note</button>
          </div>
        </div>
      </div>
    `;
    
    // Add event listeners
    const closeBtn = modal.querySelector('.modal-close');
    closeBtn.addEventListener('click', closeNotesModal);
    
    const saveBtn = modal.querySelector('#save-note-btn');
    saveBtn.addEventListener('click', saveNewNote);
    
    // Add textarea event listener for pressing Ctrl+Enter to save
    const textarea = modal.querySelector('#new-note-content');
    textarea.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        saveNewNote();
      }
    });
    
    return modal;
  }
  
  /**
   * Close the notes modal
   */
  function closeNotesModal() {
    const modal = document.getElementById('notes-modal');
    if (modal) {
      modal.classList.remove('visible');
    }
  }
  
  /**
   * Load notes for a tab
   * @param {string} tabId - ID of the tab
   */
  async function loadNotes(tabId) {
    const notesList = document.getElementById('notes-list');
    
    if (!notesList) return;
    
    try {
      notesList.innerHTML = '<div class="loading">Loading notes...</div>';
      
      // Try API endpoint first
      try {
        const API_ENDPOINT = 'http://localhost:3000/api';
        const response = await fetch(`${API_ENDPOINT}/notes/${tabId}`);
        
        if (!response.ok) {
          throw new Error(`Server responded with ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.success && data.notes) {
          displayNotes(data.notes);
        } else {
          throw new Error('Failed to load notes');
        }
      } catch (apiError) {
        console.error('API error:', apiError);
        
        // Fallback to local storage
        const { tabNotes = {} } = await chrome.storage.local.get('tabNotes');
        const notes = tabNotes[tabId] || [];
        
        displayNotes(notes);
      }
    } catch (error) {
      console.error('Error loading notes:', error);
      notesList.innerHTML = `<div class="error">Error loading notes: ${error.message}</div>`;
    }
  }
  
  /**
   * Display notes in the modal
   * @param {Array} notes - Array of notes
   */
  function displayNotes(notes) {
    const notesList = document.getElementById('notes-list');
    
    if (!notesList) return;
    
    if (notes.length === 0) {
      notesList.innerHTML = '<div class="no-notes">No notes yet. Add your first note below.</div>';
      return;
    }
    
    // Sort notes by timestamp, newest first
    notes.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    const notesHtml = notes.map(note => `
      <div class="note-item" data-id="${note.id}">
        <div class="note-content">${escapeHTML(note.content)}</div>
        <div class="note-meta">
          <span class="note-timestamp">${formatTimestamp(note.timestamp)}</span>
          <button class="note-delete" data-id="${note.id}">&times;</button>
        </div>
      </div>
    `).join('');
    
    notesList.innerHTML = notesHtml;
    
    // Add event listeners to delete buttons
    notesList.querySelectorAll('.note-delete').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        deleteNote(btn.dataset.id);
      });
    });
  }
  
  /**
   * Save a new note
   */
  async function saveNewNote() {
    const modal = document.getElementById('notes-modal');
    const textarea = document.getElementById('new-note-content');
    const saveBtn = document.getElementById('save-note-btn');
    
    if (!modal || !textarea || !saveBtn) return;
    
    const tabId = modal.dataset.tabId;
    const content = textarea.value.trim();
    
    if (!tabId || !content) return;
    
    try {
      // Disable button and show saving state
      saveBtn.disabled = true;
      saveBtn.textContent = 'Saving...';
      
      const noteData = {
        content,
        timestamp: new Date().toISOString()
      };
      
      // Try API endpoint first
      try {
        const API_ENDPOINT = 'http://localhost:3000/api';
        const response = await fetch(`${API_ENDPOINT}/notes/${tabId}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(noteData)
        });
        
        if (!response.ok) {
          throw new Error(`Server responded with ${response.status}`);
        }
        
        const data = await response.json();
        
        if (!data.success) {
          throw new Error('Failed to save note');
        }
        
        // Clear textarea
        textarea.value = '';
        
        // Reload notes
        await loadNotes(tabId);
      } catch (apiError) {
        console.error('API error:', apiError);
        
        // Fallback to local storage
        const { tabNotes = {} } = await chrome.storage.local.get('tabNotes');
        
        // Create notes array if it doesn't exist
        if (!tabNotes[tabId]) {
          tabNotes[tabId] = [];
        }
        
        // Add new note
        const newNote = {
          id: Date.now().toString(36) + Math.random().toString(36).substring(2, 5),
          content,
          timestamp: new Date().toISOString()
        };
        
        tabNotes[tabId].push(newNote);
        
        // Save back to storage
        await chrome.storage.local.set({ tabNotes });
        
        // Clear textarea
        textarea.value = '';
        
        // Display notes
        displayNotes(tabNotes[tabId]);
      }
    } catch (error) {
      console.error('Error saving note:', error);
      alert('Error saving note: ' + error.message);
    } finally {
      // Reset button
      saveBtn.disabled = false;
      saveBtn.textContent = 'Save Note';
    }
  }
  
  /**
   * Delete a note
   * @param {string} noteId - ID of the note to delete
   */
  async function deleteNote(noteId) {
    if (!confirm('Are you sure you want to delete this note?')) {
      return;
    }
    
    const modal = document.getElementById('notes-modal');
    
    if (!modal) return;
    
    const tabId = modal.dataset.tabId;
    
    if (!tabId || !noteId) return;
    
    try {
      // Try API endpoint first
      try {
        const API_ENDPOINT = 'http://localhost:3000/api';
        const response = await fetch(`${API_ENDPOINT}/notes/${tabId}/${noteId}`, {
          method: 'DELETE'
        });
        
        if (!response.ok) {
          throw new Error(`Server responded with ${response.status}`);
        }
        
        const data = await response.json();
        
        if (!data.success) {
          throw new Error('Failed to delete note');
        }
        
        // Reload notes
        await loadNotes(tabId);
      } catch (apiError) {
        console.error('API error:', apiError);
        
        // Fallback to local storage
        const { tabNotes = {} } = await chrome.storage.local.get('tabNotes');
        
        // Find and remove note
        if (tabNotes[tabId]) {
          const noteIndex = tabNotes[tabId].findIndex(note => note.id === noteId);
          
          if (noteIndex >= 0) {
            tabNotes[tabId].splice(noteIndex, 1);
            
            // Remove tab entry if no notes left
            if (tabNotes[tabId].length === 0) {
              delete tabNotes[tabId];
            }
            
            // Save back to storage
            await chrome.storage.local.set({ tabNotes });
            
            // Display notes
            displayNotes(tabNotes[tabId] || []);
          }
        }
      }
    } catch (error) {
      console.error('Error deleting note:', error);
      alert('Error deleting note: ' + error.message);
    }
  }
  
  /**
   * Format timestamp to a readable string
   * @param {string} timestamp - ISO timestamp
   * @returns {string} - Formatted timestamp
   */
  function formatTimestamp(timestamp) {
    if (!timestamp) return 'Unknown';
    
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / (1000 * 60));
    
    if (diffMins < 60) {
      return `${diffMins} minutes ago`;
    } else {
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) {
        return `${diffHours} hours ago`;
      } else {
        const diffDays = Math.floor(diffHours / 24);
        if (diffDays < 30) {
          return `${diffDays} days ago`;
        } else {
          return date.toLocaleDateString();
        }
      }
    }
  }
  
  /**
   * Escape HTML special characters
   * @param {string} text - Text to escape
   * @returns {string} - Escaped text
   */
  function escapeHTML(text) {
    if (!text) return '';
    
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;')
      .replace(/\n/g, '<br>');
  }
  
  // Export the init function
  window.initTabNotes = initTabNotes;