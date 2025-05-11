# Tab AI Assistant

A Chrome extension that uses AI to index, search, and provide intelligent answers about your browser tabs using RAG (Retrieval-Augmented Generation) and OpenAI.

![Tab AI Assistant Icon](images/icon128.png)

## Features

- **Automatic Tab Indexing**: Captures and indexes content from your browser tabs automatically
- **Intelligent Search**: Search through your tabs with natural language queries
- **AI-Powered Answers**: Get AI-generated answers about the content of your tabs
- **Keyword Highlighting**: Highlight search terms directly in web pages
- **Tab Management**: View all indexed tabs and their content

## Installation

### Prerequisites

- A local backend server running on `http://localhost:3000`
- Chrome browser

### Extension Setup

1. Clone this repository:
   ```
   git clone https://github.com/rahul2983/tab-ai-assistant.git
   ```

2. Open Chrome and navigate to `chrome://extensions/`

3. Enable "Developer mode" in the top right corner

4. Click "Load unpacked" and select the extension directory

5. The Tab AI Assistant extension should now appear in your toolbar

## Usage

### Indexing Tabs

- **Automatic Indexing**: By default, the extension automatically indexes new tabs you visit (can be disabled in settings)
- **Manual Indexing**: Click "Index Current Tab" in the popup to manually index the current page
- **Batch Indexing**: Click "Sync All Tabs" to index all currently open tabs

### Searching Your Tabs

1. Click on the Tab AI Assistant icon in your toolbar
2. Enter your search query in the search box
3. Press Enter or click the "Search" button
4. View results including:
   - AI-generated answers based on your tabs' content
   - Matching tabs with highlighted keywords
   - Options to open tabs or highlight keywords in the original pages

### Settings

Click "Show Settings" in the popup to:
- Toggle automatic tab indexing
- View indexing statistics

## How It Works

### Architecture

The extension consists of several key components:

1. **Background Script** (`background.js`): 
   - Manages tab indexing, storage, and communication with the backend
   - Processes tab content and sends it to the backend for indexing
   - Handles search requests

2. **Content Script** (`content.js`):
   - Extracts content from web pages
   - Highlights keywords in the page
   - Communicates with the background script

3. **Popup UI** (`popup.html`, `popup.js`):
   - Provides a user interface for searching and managing tabs
   - Displays indexing statistics
   - Manages user settings

4. **Search Results Page** (`search.html`, `search.js`):
   - Displays search results with AI-generated answers
   - Shows matching tabs with relevant snippets
   - Provides options to open tabs or highlight keywords

### Data Flow

1. Tab content is extracted using the Chrome Scripting API or content script
2. Content is processed and sent to the backend API for indexing
3. Search queries are sent to the backend, which uses RAG to generate AI responses
4. Results are displayed to the user with relevant context from indexed tabs

## Technical Details

- Uses Chrome Manifest V3
- Implements debouncing to avoid excessive processing during tab navigation
- Handles timeouts and fallbacks for robust operation
- Provides both direct API communication and messaging-based fallbacks

## Backend Requirements

The extension expects a backend server running at `http://localhost:3000` with the following endpoints:

- `/api/index`: For sending tab content to be indexed
- `/api/search`: For searching indexed tabs and generating AI responses

## Limitations

- Currently only works with a local backend server
- Some websites may block content extraction
- Performance may vary with large numbers of tabs

## Development

### Project Structure

```
tab-ai-assistant/
├── background.js      # Service worker for tab monitoring and indexing
├── content.js         # Content script for page interaction
├── manifest.json      # Extension configuration
├── popup.html         # Popup UI
├── popup.js           # Popup functionality
├── search.html        # Search results page
├── search.js          # Search functionality
└── images/            # Extension icons
```

### Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

[MIT License](LICENSE)

## Acknowledgements

- Built with Chrome Extensions API
- Uses OpenAI for AI-powered answers
- Implements RAG (Retrieval-Augmented Generation) for enhanced context awareness