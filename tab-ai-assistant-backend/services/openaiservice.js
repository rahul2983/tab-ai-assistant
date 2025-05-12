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
    
    // // Truncate text if too long (OpenAI has token limits)
    // const truncatedText = text.substring(0, 8000);
    
    // const response = await openai.embeddings.create({
    //   model: config.openai.embeddingModel,
    //   input: truncatedText
    // });

    // Change model to text-embedding-3-small which produces 1536-dimensional vectors
    // This matches your existing Pinecone index dimension
    const response = await openai.embeddings.create({
      model: "text-embedding-3-small", // Changed from text-embedding-3-large
      input: text
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

/**
 * Generate a concise summary for a tab's content
 * @param {string} text - Tab content to summarize
 * @param {string} title - Tab title for context
 * @returns {Promise<string>} - Generated summary
 */
async function generateTabSummary(text, title) {
  try {
    console.log(`Generating summary for: ${title} (${text.length} chars)`);
    
    // Truncate text if too long (OpenAI has token limits)
    // We'll use a smaller amount for summaries to reduce costs
    const truncatedText = text.substring(0, 4000);
    
    // Generate response using OpenAI
    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo", // Using a cheaper model for summaries
      messages: [
        {
          role: "system",
          content: `You are a summarization assistant that creates very concise summaries.
                   Given a web page's title and content, create a 1-2 sentence summary that captures the main point.
                   Focus on what makes this content unique or valuable.
                   Be factual and objective. Do not use phrases like "this article" or "this page".
                   Keep the summary under 200 characters if possible.`
        },
        {
          role: "user",
          content: `Title: ${title}\n\nContent: ${truncatedText}`
        }
      ],
      temperature: 0.3, // Lower temperature for more consistent outputs
      max_tokens: 100  // Limit to keep summaries short
    });
    
    const summary = response.choices[0].message.content.trim();
    console.log('Summary generated successfully');
    
    return summary;
  } catch (error) {
    console.error('Error generating summary:', error);
    throw error;
  }
}

module.exports = {
  generateEmbedding,
  generateTabAnswer,
  generateTabSummary  // Add this new export
};