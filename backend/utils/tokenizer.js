// utils/tokenizer.js

/**
 * Simple tokenizer and text chunker
 */
class Tokenizer {
    /**
     * Simple tokenization - split by spaces and punctuation
     * @param {string} text Text to tokenize
     * @returns {Array} Array of tokens
     */
    tokenize(text) {
      // This is a simplistic tokenizer
      // In production, consider using a proper NLP library
      return text
        .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, " ")
        .replace(/\s+/g, " ")
        .split(" ")
        .filter(token => token.length > 0);
    }
  
    /**
     * Count tokens in a string
     * @param {string} text Text to count tokens in
     * @returns {number} Token count
     */
    countTokens(text) {
      return this.tokenize(text).length;
    }
  
    /**
     * Split text into chunks of approximately maxTokens
     * @param {string} text Text to chunk
     * @param {number} maxTokens Maximum tokens per chunk
     * @returns {Array} Array of chunks
     */
    chunkText(text, maxTokens = 500) {
      // Split by paragraphs first
      const paragraphs = text.split(/\n+/);
      const chunks = [];
      let currentChunk = "";
      let currentTokenCount = 0;
  
      for (const paragraph of paragraphs) {
        const paragraphTokenCount = this.countTokens(paragraph);
  
        // If a single paragraph is larger than maxTokens, we need to break it up
        if (paragraphTokenCount > maxTokens) {
          // If there's content in the current chunk, push it first
          if (currentChunk) {
            chunks.push(currentChunk);
            currentChunk = "";
            currentTokenCount = 0;
          }
  
          // Break the paragraph into sentences
          const sentences = paragraph.split(/(?<=[.!?])\s+/);
          
          for (const sentence of sentences) {
            const sentenceTokenCount = this.countTokens(sentence);
            
            if (sentenceTokenCount > maxTokens) {
              // If even a sentence is too long, split by tokens directly
              const tokens = this.tokenize(sentence);
              let tempChunk = "";
              let tempTokenCount = 0;
              
              for (const token of tokens) {
                if (tempTokenCount + 1 > maxTokens) {
                  chunks.push(tempChunk);
                  tempChunk = token;
                  tempTokenCount = 1;
                } else {
                  tempChunk += (tempChunk ? " " : "") + token;
                  tempTokenCount++;
                }
              }
              
              if (tempChunk) {
                chunks.push(tempChunk);
              }
            } else if (currentTokenCount + sentenceTokenCount > maxTokens) {
              // If adding this sentence would exceed maxTokens, start a new chunk
              chunks.push(currentChunk);
              currentChunk = sentence;
              currentTokenCount = sentenceTokenCount;
            } else {
              // Add sentence to current chunk
              currentChunk += (currentChunk ? " " : "") + sentence;
              currentTokenCount += sentenceTokenCount;
            }
          }
        } else if (currentTokenCount + paragraphTokenCount > maxTokens) {
          // If adding this paragraph would exceed maxTokens, start a new chunk
          chunks.push(currentChunk);
          currentChunk = paragraph;
          currentTokenCount = paragraphTokenCount;
        } else {
          // Add paragraph to current chunk
          currentChunk += (currentChunk ? "\n" : "") + paragraph;
          currentTokenCount += paragraphTokenCount;
        }
      }
  
      // Don't forget the last chunk
      if (currentChunk) {
        chunks.push(currentChunk);
      }
  
      return chunks.map((chunk, index) => ({
        id: index,
        text: chunk,
        tokenCount: this.countTokens(chunk)
      }));
    }
  }
  
  module.exports = { Tokenizer };