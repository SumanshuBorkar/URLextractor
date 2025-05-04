// utils/htmlCleaner.js

/**
 * Cleans HTML content while preserving important content
 * @param {string} html - Raw HTML content
 * @returns {string} - Cleaned HTML content
 */
exports.cleanHTML = (html) => {
  try {
    // Log original HTML length

    // Check for empty or invalid HTML
    if (!html || typeof html !== 'string' || html.trim().length === 0) {
      return '';
    }

    // Preserve full HTML structure - only remove scripts and style tags that might interfere
    let cleaned = html
      // Remove script tags and their content
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      // Remove style tags and their content
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
      // Remove comments
      .replace(/<!--[\s\S]*?-->/g, '')
      // Remove inline JavaScript event handlers
      .replace(/ on\w+="[^"]*"/g, '')
      // Replace multiple spaces with a single space
      .replace(/\s+/g, ' ');

    
    // Make sure we keep the body intact
    if (cleaned.length < html.length * 0.2) {
      // Use minimal cleaning if too much content was removed
      cleaned = html
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/<!--[\s\S]*?-->/g, '');
    }

    return cleaned;
  } catch (error) {
    console.error('Error in cleanHTML:', error);
    // Return original HTML if cleaning fails
    return html;
  }
};