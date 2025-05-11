# Tab AI Assistant

An intelligent Chrome extension and backend service for AI-powered browser tab management, search, and organization.

## Project Structure

This repository contains two main components:

- **tab-ai-assistant**: Chrome extension (frontend)
- **tab-ai-assistant-backend**: Backend server with API endpoints

## Chrome Extension (tab-ai-assistant)

The Tab AI Assistant Chrome extension provides intelligent tab management directly in your browser:

- AI-powered search across your tabs
- Semantic understanding of tab content
- Quick navigation between related tabs
- Tab organization and categorization

[See extension README](./tab-ai-assistant/README.md) for more details.

## Backend (tab-ai-assistant-backend)

The backend provides the API endpoints and services to power the Tab AI Assistant Chrome extension:

- Vector search using Pinecone serverless
- OpenAI embeddings for semantic understanding
- RESTful API for tab indexing and searching
- Fallback mechanisms for reliability

[See backend README](./tab-ai-assistant-backend/README.md) for more details.

## Getting Started

### Prerequisites

- Node.js (v14 or later)
- NPM or Yarn
- Pinecone account (serverless enabled)
- OpenAI API key
- Chrome browser (for extension development and testing)

### Installation and Setup

1. Clone this repository

git clone https://github.com/yourusername/tab-ai-assistant.git
cd tab-ai-assistant

2. Set up the backend

cd tab-ai-assistant-backend
npm install
cp .env.example .env
Edit .env with your API keys

3. Set up the Chrome extension

cd ../tab-ai-assistant
npm install
cp .env.example .env
Edit .env with your configuration

4. Start the backend

cd tab-ai-assistant-backend
npm run dev

5. Load the Chrome extension

cd tab-ai-assistant
npm run build
Then in Chrome:
- Go to `chrome://extensions/`
- Enable "Developer mode"
- Click "Load unpacked"
- Select the `dist` or `build` directory from the tab-ai-assistant folder

## Development Workflow

### Backend Development
cd tab-ai-assistant-backend
npm run dev

### Extension Development
cd tab-ai-assistant
npm run dev
This will watch for changes and rebuild the extension. You'll need to reload the extension in Chrome after making changes.

## Deployment

### Backend Deployment
The backend is designed to work with serverless platforms like Vercel, AWS Lambda, or Netlify.

### Extension Deployment
To publish to the Chrome Web Store:
1. Build the production version: `npm run build`
2. Zip the build directory
3. Upload to the [Chrome Developer Dashboard](https://chrome.google.com/webstore/devconsole/)

## License

MIT