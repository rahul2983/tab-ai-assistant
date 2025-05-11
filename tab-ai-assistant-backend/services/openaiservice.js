// services/openaiService.js
// Integration with OpenAI for embeddings and RAG

const { OpenAI } = require('openai');
const config = require('../config/config');

console.log('Initializing openaiService...');

// Initialize OpenAI client
let openai;

try {
  openai = new OpenAI({
    apiKey: config.openai.apiKey
  });
  console.log('OpenAI client initialized');
} catch (error) {
  console.error('Error initializing OpenAI client:', error);
  throw error;
}

/**
 * Generate an embedding for text
 * @param {string} text - Text to embed
 * @returns {Promise<Array>} - Embedding vector
 */
async function generateEmbedding(text) {
  try {
    console.log(`Generating embedding for text (${text.length} chars)`);
    
    // Truncate text if too long (OpenAI has token limits)
    const truncatedText = text.substring(0, 8000);
    
    const response = await openai.embeddings.create({
      model: config.openai.embeddingModel,
      input: truncatedText
    });
    
    console.log('Embedding generated successfully');
    
    return response.data[0].embedding;
  } catch (error) {
    console.error('Error generating embedding:', error);
    throw error;
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
    console.log(`Generating AI answer for query: ${query}`);
    
    // Format context from search results
    let formattedContext = "Here is information from your browser tabs:\n\n";
    
    searchResults.forEach((result, index) => {
      formattedContext += `[Tab ${index + 1}: ${result.title}]\n`;
      formattedContext += `${result.snippet || "No preview available"}\n`;
      formattedContext += `URL: ${result.url}\n\n`;
    });
    
    console.log(`Using ${searchResults.length} search results as context`);
    
    // Generate response using OpenAI
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
          content: `Here are my browser tabs:\n\n${formattedContext}\n\nMy question is: ${query}`
        }
      ],
      temperature: 0.3,
      max_tokens: 500
    });
    
    console.log('AI answer generated successfully');
    
    return response.choices[0].message.content;
  } catch (error) {
    console.error('Error generating AI answer:', error);
    return `I encountered an error while generating an answer. Please try again. (Error: ${error.message})`;
  }
}

module.exports = {
  generateEmbedding,
  generateTabAnswer
};