// utils/vectorDB.js
const { Tokenizer } = require('./tokenizer');
const { MilvusClient } = require('@zilliz/milvus2-sdk-node');
require('dotenv').config();

class VectorDB {
  constructor() {
    // In-memory storage for chunks (fallback)
    this.chunks = [];
    // Relevance threshold for filtering results
    this.relevanceThreshold = 0.15; // Increased from original 0.1 for better quality
    // Create tokenizer instance
    this.tokenizer = new Tokenizer();
    // Flag to determine if we use Milvus or in-memory storage
    this.useVectorSearch = process.env.USE_VECTOR_SEARCH === 'true';

    // Initialize Milvus client if vector search is enabled
    if (this.useVectorSearch) {
      this.initMilvus();
    }
  }

  /**
   * Initialize connection to Milvus database
   */
  async initMilvus() {
    try {
      // Create Milvus client
      this.milvusClient = new MilvusClient({
        address: process.env.MILVUS_URI,
        username: process.env.MILVUS_USERNAME,
        password: process.env.MILVUS_PASSWORD,
      });

      // Collection name for storing document chunks
      this.collectionName = 'document_chunks';

      // Check if collection exists, create if not
      await this.ensureCollection();

    } catch (error) {
      // Fallback to in-memory if Milvus fails to initialize
      this.useVectorSearch = false;
    }
  }

  /**
   * Ensure collection exists in Milvus
   */
  async ensureCollection() {
    try {
      // Check if collection exists
      const hasCollection = await this.milvusClient.hasCollection({
        collection_name: this.collectionName
      });

      if (!hasCollection) {

        // Define collection schema
        // We need:
        // - id field (primary key)
        // - text field (to store the original text)
        // - vector field (embeddings from our tokenizer)
        // - metadata fields (optional)
        await this.milvusClient.createCollection({
          collection_name: this.collectionName,
          fields: [
            {
              name: 'id',
              description: 'Chunk ID',
              data_type: 'VarChar',
              is_primary_key: true,
              max_length: 100
            },
            {
              name: 'text',
              description: 'Chunk text content',
              data_type: 'VarChar',
              max_length: 65535
            },
            {
              name: 'source',
              description: 'Source document identifier',
              data_type: 'VarChar',
              max_length: 255
            },
            {
              name: 'tokenCount',
              description: 'Number of tokens in the chunk',
              data_type: 'Int64'
            },
            {
              name: 'vector',
              description: 'Text embedding vector',
              data_type: 'FloatVector',
              dim: 128 // Dimension of the vector - adjust based on your embedding model
            }
          ]
        });

        // Create index on the vector field for similarity search
        await this.milvusClient.createIndex({
          collection_name: this.collectionName,
          field_name: 'vector',
          index_type: 'HNSW', // Changed from FLAT to HNSW for better performance with large datasets
          metric_type: 'COSINE', // Cosine similarity
          params: {
            M: 16,           // Number of bidirectional links
            efConstruction: 200  // Size of the dynamic candidate list for constructing the graph
          }
        });

      } else {
        console.error(`Collection ${this.collectionName} already exists`);
      }

      // Load collection into memory for searches
      await this.milvusClient.loadCollection({
        collection_name: this.collectionName
      });

    } catch (error) {
      console.error('Failed to ensure collection:', error);
      throw error;
    }
  }

  /**
   * Convert text to a vector embedding
   * @param {string} text Text to convert to vector
   * @returns {Array} Vector embedding
   */
  textToVector(text) {
    // Tokenize the text
    const tokens = this.tokenizer.tokenize(text);

    // This is a simple embedding approach
    // In a real implementation, you would use a proper embedding model
    // For now, we'll create a simple vector of 128 dimensions
    const vector = new Array(128).fill(0);

    // Map tokens to positions in the vector
    tokens.forEach(token => {
      // Use string hash to deterministically map token to a position
      const position = Math.abs(this.hashString(token) % 128);
      // Increment the value at that position
      vector[position] += 1;
    });

    // Normalize the vector to unit length for cosine similarity
    const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
    if (magnitude > 0) {
      for (let i = 0; i < vector.length; i++) {
        vector[i] = vector[i] / magnitude;
      }
    }

    return vector;
  }

  /**
   * Simple string hash function
   * @param {string} str String to hash
   * @returns {number} Hash value
   */
  hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return hash;
  }

  /**
   * Store chunks in the database (Milvus or in-memory)
   * @param {Array} chunks Array of text chunks to store
   */
  async indexChunks(chunks) {

    // Process chunks - add token count and tokens
    const processedChunks = chunks.map((chunk, index) => {
      // Make sure every chunk has a tokenCount
      if (!chunk.hasOwnProperty('tokenCount')) {
        chunk.tokenCount = this.tokenizer.countTokens(chunk.text);
      }

      // Generate tokens for each chunk for faster search
      chunk.tokens = this.tokenizer.tokenize(chunk.text);

      return {
        ...chunk,
        id: chunk.id || index.toString()
      };
    });

    if (this.useVectorSearch && this.milvusClient) {
      try {
        // First ensure collection is ready
        await this.ensureCollection();

        // Prepare data for Milvus insert
        const milvusData = processedChunks.map(chunk => {
          return {
            id: chunk.id,
            text: chunk.text,
            source: chunk.source || '',
            tokenCount: chunk.tokenCount || 0,
            vector: this.textToVector(chunk.text)
          };
        });

        // Insert data into Milvus
        const insertResult = await this.milvusClient.insert({
          collection_name: this.collectionName,
          data: milvusData
        });


        // Keep the chunks in memory as backup
        this.chunks = processedChunks;

      } catch (error) {
        // Fallback to in-memory
        this.chunks = processedChunks;
      }
    } else {
      // Store in memory only
      this.chunks = processedChunks;
    }

    return true;
  }

  /**
   * Search for chunks that match the query
   * @param {string} query Query text
   * @param {number} limit Maximum number of results to return
   * @returns {Array} Array of matching results with relevance percentages
   */
  async semanticSearch(query, limit = 10) {

    if (!query) {
      return [];
    }

    // If using Milvus and client is connected
    if (this.useVectorSearch && this.milvusClient) {
      try {
        // Convert query to vector
        const queryVector = this.textToVector(query);

        // Search in Milvus
        const searchResult = await this.milvusClient.search({
          collection_name: this.collectionName,
          vector: queryVector,
          limit: limit * 2, // Get more results initially to allow for filtering
          output_fields: ['id', 'text', 'source', 'tokenCount'],
          search_params: {
            metric_type: 'COSINE',
            params: {
              ef: 64  // Higher ef value for better recall during search
            }
          }
        });

        // Transform results to match the expected format and convert scores to percentages
        if (searchResult.results.length > 0) {
          // Find the maximum score for normalization
          const maxScore = Math.max(...searchResult.results.map(item => item.score));

          // Convert scores to percentage relevance
          const results = searchResult.results
            .map(item => {
              // Calculate percentage relevance (0-100%)
              const relevancePercentage = Math.min(100, Math.round((item.score / maxScore) * 100));

              return {
                id: item.id,
                text: item.text,
                source: item.source,
                tokenCount: item.tokenCount,
                score: item.score,
                relevancePercentage: relevancePercentage
              };
            })
            .filter(item => item.relevancePercentage >= 15) // 15% minimum relevance
            .sort((a, b) => b.relevancePercentage - a.relevancePercentage)
            .slice(0, limit);

          return results;
        }
        return [];
      } catch (error) {
        // Fallback to in-memory search
        return this.inMemorySearch(query, limit);
      }
    } else {
      // Use in-memory search
      return this.inMemorySearch(query, limit);
    }
  }

  /**
   * In-memory search implementation with improved relevance ranking
   * @param {string} query Query text
   * @param {number} limit Maximum number of results
   * @returns {Array} Search results with percentage-based relevance scores
   */
  async inMemorySearch(query, limit = 10) {
    if (!query || this.chunks.length === 0) {
      return [];
    }

    // Tokenize the query
    const queryTokens = this.tokenizer.tokenize(query);
    if (queryTokens.length === 0) {
      return [];
    }

    // Create a document frequency map
    const documentFrequencies = {};
    queryTokens.forEach(token => {
      // Count how many chunks contain this token
      documentFrequencies[token] = this.chunks.filter(chunk =>
        chunk.tokens.includes(token)
      ).length;
    });

    // Calculate BM25+ scores (an improved version of TF-IDF for relevance ranking)
    // BM25+ adds a small delta to prevent penalizing long documents too much
    const k1 = 1.5;     // Term frequency saturation parameter
    const b = 0.75;     // Length normalization parameter
    const delta = 1.0;  // Small constant to prevent over-penalization of long documents

    // Calculate average document length
    const avgDocLength = this.chunks.reduce((sum, chunk) =>
      sum + chunk.tokens.length, 0) / this.chunks.length;

    // Calculate raw scores using BM25+ scoring
    let rawResults = this.chunks
      .map(chunk => {
        // Calculate BM25+ score
        let rawScore = 0;
        const docLength = chunk.tokens.length;

        // Get frequency map of tokens in the current chunk
        const termFrequencies = {};
        chunk.tokens.forEach(token => {
          termFrequencies[token] = (termFrequencies[token] || 0) + 1;
        });

        // Calculate score for each query token
        queryTokens.forEach(token => {
          const tf = termFrequencies[token] || 0;
          if (tf > 0) {
            // Inverse document frequency component with smoothing
            const idf = Math.log(
              1 + (this.chunks.length - documentFrequencies[token] + 0.5) /
              (documentFrequencies[token] + 0.5)
            );

            // Term frequency component with saturation and normalization
            const tfComponent = ((k1 + 1) * tf) /
              (k1 * (1 - b + b * (docLength / avgDocLength)) + tf);

            // BM25+ formulation with delta
            rawScore += idf * (tfComponent + delta);
          }
        });

        // Boost exact phrase matches
        const chunkText = chunk.text.toLowerCase();
        const queryText = query.toLowerCase();
        if (chunkText.includes(queryText)) {
          rawScore *= 1.5; // Boost factor for exact phrase matches
        }

        // Apply semantic similarity boost based on position bias
        // Documents where matches appear early are more relevant
        const firstMatchPosition = this.getFirstMatchPosition(chunk.tokens, queryTokens);
        if (firstMatchPosition >= 0) {
          // Position bias factor (decreasing with position)
          const positionFactor = 1 - (firstMatchPosition / (chunk.tokens.length + 1));
          rawScore *= (1 + positionFactor * 0.3); // Boost by up to 30% based on position
        }

        return {
          ...chunk,
          rawScore
        };
      })
      .filter(result => result.rawScore > 0);

    // If no results with positive scores, try a more relaxed matching approach
    if (rawResults.length === 0) {
      // Compute semantic similarity with fuzzy matching
      rawResults = this.chunks
        .map(chunk => {
          // Calculate semantic overlap with query
          const semanticScore = this.calculateSemanticScore(queryTokens, chunk.tokens);

          return {
            ...chunk,
            rawScore: semanticScore
          };
        })
        .filter(result => result.rawScore > 0);
    }

    // Convert raw scores to percentage relevance (0-100%)
    if (rawResults.length > 0) {
      // Find the maximum score for normalization
      const maxScore = Math.max(...rawResults.map(result => result.rawScore));

      // Convert all scores to percentages
      const results = rawResults
        .map(result => {
          // Calculate percentage and round to 2 decimal places
          const relevancePercentage = Math.min(100, Math.round((result.rawScore / maxScore) * 100));

          return {
            ...result,
            rawScore: undefined, // Remove the raw score
            score: relevancePercentage / 100, // Keep the normalized score (0-1) for compatibility
            relevancePercentage: relevancePercentage // Add percentage score (0-100)
          };
        })
        .filter(result => result.relevancePercentage >= 15) // 15% minimum relevance threshold
        .sort((a, b) => b.relevancePercentage - a.relevancePercentage)
        .slice(0, limit);

      return results;
    }

    return [];
  }

  /**
   * Get the position of the first matching token
   * @param {Array} docTokens Document tokens
   * @param {Array} queryTokens Query tokens
   * @returns {number} Position of first match or -1 if no match
   */
  getFirstMatchPosition(docTokens, queryTokens) {
    const queryTokenSet = new Set(queryTokens);

    for (let i = 0; i < docTokens.length; i++) {
      if (queryTokenSet.has(docTokens[i])) {
        return i;
      }
    }

    return -1;
  }

  /**
   * Calculate semantic similarity score between query and document
   * @param {Array} queryTokens Query tokens
   * @param {Array} docTokens Document tokens
   * @returns {number} Semantic similarity score
   */
  calculateSemanticScore(queryTokens, docTokens) {
    // Create sets for faster lookup
    const querySet = new Set(queryTokens);
    const docSet = new Set(docTokens);

    // Calculate Jaccard similarity - intersection over union
    const intersection = new Set([...querySet].filter(token => docSet.has(token)));
    const union = new Set([...querySet, ...docSet]);

    const jaccardSimilarity = intersection.size / union.size;

    // Calculate weighted token overlap
    let weightedOverlap = 0;
    let totalWeight = 0;

    queryTokens.forEach((token, index) => {
      // Weight tokens inversely by position (earlier tokens matter more)
      const weight = queryTokens.length - index;
      totalWeight += weight;

      if (docSet.has(token)) {
        weightedOverlap += weight;
      }
    });

    const weightedScore = totalWeight > 0 ? weightedOverlap / totalWeight : 0;

    // Combine the scores (70% weighted overlap, 30% Jaccard)
    return (weightedScore * 0.7) + (jaccardSimilarity * 0.3);
  }
}

module.exports = VectorDB;