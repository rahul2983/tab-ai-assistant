# Tab AI Assistant

A Chrome extension that uses AI to index, search, and provide intelligent answers about your browser tabs using RAG (Retrieval-Augmented Generation) and OpenAI.

![Tab AI Assistant Icon](images/icon128.png)

## Features

- **Automatic Tab Indexing**: Captures and indexes content from your browser tabs automatically
- **Intelligent Search**: Search through your tabs with natural language queries
- **AI-Powered Answers**: Get AI-generated answers about the content of your tabs
- **Tab Summaries**: AI-generated concise summaries of each tab's content
- **Reading Time Estimates**: Calculate and display estimated reading time for each indexed tab
- **Keyword Highlighting**: Highlight search terms directly in web pages
- **Tab Management**: View all indexed tabs and their content
- **Tab Dashboard**: Comprehensive view of all indexed tabs with filtering, sorting, and AI search capabilities

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
   - Matching tabs with highlighted keywords, summaries, and reading times
   - Options to open tabs or highlight keywords in the original pages

### Tab Dashboard with AI Search

1. Click on the Tab AI Assistant icon in your toolbar
2. Click "View All Indexed Tabs" link
3. Use the dashboard's features:
   - **AI Search**: Ask questions about your tabs and get AI-generated answers
   - **Filter**: Use the filter box to search for specific tabs by title, URL, or content
   - **Sort**: Sort tabs by recency, oldest first, alphabetically, or by reading time
   - **View**: See tab summaries and reading time estimates at a glance
   - **Manage**: Open tabs or remove them from your index
   - **Sync**: Update your tab index by clicking "Sync All Tabs"

The dashboard will highlight source tabs referenced in AI answers, making it easy to find relevant information.

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
   - Shows matching tabs with summaries and reading times
   - Provides options to open tabs or highlight keywords

5. **All Tabs Dashboard** (`all-tabs.html`, `all-tabs.js`):
   - Provides a central hub for viewing and searching all indexed tabs
   - Offers AI-powered search directly from the dashboard
   - Displays tabs with summaries and reading times in a responsive grid layout
   - Provides filtering, sorting, and management capabilities
   - Highlights source tabs referenced in AI answers

### Data Flow

1. Tab content is extracted using the Chrome Scripting API or content script
2. Content is processed, enhanced with summaries and reading time estimates
3. Enhanced content is sent to the backend API for indexing
4. Search queries are sent to the backend, which uses RAG to generate AI responses
5. Results are displayed to the user with relevant context from indexed tabs
6. Tab management operations (deletion, etc.) are synchronized with both local storage and the backend

## Technical Details

- Uses Chrome Manifest V3
- Implements debouncing to avoid excessive processing during tab navigation
- Handles timeouts and fallbacks for robust operation
- Provides both direct API communication and messaging-based fallbacks
- Uses AI to generate concise, meaningful summaries of tab content
- Calculates reading time based on word count (average reading speed of 200 words per minute)

## Backend Requirements

The extension expects a backend server running at `http://localhost:3000` with the following endpoints:

- `/api/index`: For sending tab content to be indexed
- `/api/search`: For searching indexed tabs and generating AI responses
- `/api/remove/:id`: For removing tabs from the index

## Limitations

- Currently only works with a local backend server
- Some websites may block content extraction
- Performance may vary with large numbers of tabs
- Summary generation requires OpenAI API access and may incur costs

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
├── all-tabs.html      # All indexed tabs dashboard with AI search
├── all-tabs.js        # All tabs functionality
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