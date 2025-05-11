// services/openaiService.js
// Modified for development - can work without API key

const { OpenAI } = require('openai');
const config = require('../config/config');

// Initialize OpenAI client if API key is available
let openai;
try {
  if (config.openai.apiKey) {
    openai = new OpenAI({
      apiKey: config.openai.apiKey
    });
    console.log('OpenAI client initialized');
  } else {
    console.log('No OpenAI API key found, using mock responses');
  }
} catch (error) {
  console.error('Error initializing OpenAI client:', error);
}

/**
 * Generate an embedding for text
 * @param {string} text - Text to embed
 * @returns {Promise<Array>} - Embedding vector
 */
async function generateEmbedding(text) {
  try {
    // If no API key or client, return a mock embedding
    if (!openai) {
      console.log('Using mock embedding');
      return Array(1536).fill(0).map(() => Math.random() * 2 - 1);
    }
    
    // Truncate text if too long
    const truncatedText = text.substring(0, 8000);
    
    const response = await openai.embeddings.create({
      model: config.openai.embeddingModel,
      input: truncatedText
    });
    
    return response.data[0].embedding;
  } catch (error) {
    console.error('Error generating embedding:', error);
    // Fall back to mock embedding in case of error
    console.log('Falling back to mock embedding');
    return Array(1536).fill(0).map(() => Math.random() * 2 - 1);
  }
}

/**
 * Generate an answer based on tab search results
 * @param {string} query - User's query
 * @param {string} context - Context from search results
 * @param {Array} searchResults - Original search results
 * @returns {Promise<string>} - Generated answer
 */
async function generateTabAnswer(query, context, searchResults) {
  try {
    // If no API key or client, return a mock answer
    if (!openai) {
      console.log('Using mock AI answer');
      return generateMockAnswer(query, searchResults);
    }
    
    const response = await openai.chat.completions.create({
      model: config.openai.completionModel,
      messages: [
        {
          role: "system",
          content: `You are an AI assistant that helps users find information in their browser tabs.
                    Answer the question based ONLY on the provided tab information.
                    If the tabs don't contain relevant information, say so and don't make up answers.
                    Include references to specific tabs when relevant.
                    Be concise and helpful.`
        },
        {
          role: "user",
          content: `Here are my browser tabs:\n\n${context}\n\nMy question is: ${query}`
        }
      ],
      temperature: 0.3,
      max_tokens: 500
    });
    
    return response.choices[0].message.content;
  } catch (error) {
    console.error('Error generating AI answer:', error);
    // Fall back to mock answer in case of error
    console.log('Falling back to mock AI answer');
    return generateMockAnswer(query, searchResults);
  }
}

/**
 * Generate a mock answer for development
 * @param {string} query - User's query
 * @param {Array} searchResults - Search results
 * @returns {string} - Mock answer
 */
function generateMockAnswer(query, searchResults) {
  if (!searchResults || searchResults.length === 0) {
    return "I couldn't find any relevant information in your tabs for this query.";
  }
  
  let answer = `Based on the information in your tabs, I found ${searchResults.length} relevant results about "${query}". `;
  
  if (searchResults.length > 0) {
    answer += `The most relevant tab is "${searchResults[0].title}". `;
    
    // Add a snippet from the first result
    if (searchResults[0].snippet) {
      answer += `Here's what I found: "${searchResults[0].snippet.substring(0, 100)}..." `;
    }
    
    // Reference other sources
    if (searchResults.length > 1) {
      answer += `You can also check ${searchResults.length - 1} other tabs for more information.`;
    }
  }
  
  return answer;
}

module.exports = {
  generateEmbedding,
  generateTabAnswer
};