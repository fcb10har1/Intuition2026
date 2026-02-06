/**
 * Grok AI Client - Extension-side wrapper for Grok API
 * 
 * This client communicates with the backend proxy server to call Grok API
 * without exposing API keys to the client-side code.
 * 
 * [USER INPUT REQUIRED]:
 * - Set BACKEND_URL to your actual backend server URL
 *   - Local development: http://localhost:3000
 *   - Production: https://your-backend.com
 */

// ============================================================================
// [USER INPUT REQUIRED] - Backend Configuration
// ============================================================================
// Change this to your actual backend server URL
const BACKEND_URL = 'http://localhost:3000'; // Local development
// const BACKEND_URL = 'https://your-production-backend.com'; // Production

class GrokClient {
  constructor(backendUrl = BACKEND_URL) {
    this.backendUrl = backendUrl;
    this.conversationHistory = [];
    this.isAvailable = false;
    this.checkAvailability();
  }

  /**
   * Check if backend is reachable
   */
  async checkAvailability() {
    try {
      const response = await fetch(`${this.backendUrl}/health`);
      this.isAvailable = response.ok;
      console.log(`[Grok] Backend availability: ${this.isAvailable ? '✓' : '✗'}`);
      return this.isAvailable;
    } catch (error) {
      this.isAvailable = false;
      console.warn('[Grok] Backend unreachable:', error.message);
      return false;
    }
  }

  /**
   * Send a message to Grok
   * 
   * @param {string} message - User message
   * @returns {Promise<string>} - Grok's response
   */
  async chat(message) {
    if (!this.isAvailable) {
      throw new Error('Grok backend is not available. Make sure backend server is running.');
    }

    try {
      const response = await fetch(`${this.backendUrl}/api/grok`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message,
          conversationHistory: this.conversationHistory
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const data = await response.json();
      const result = data.result;

      // Add to conversation history for context
      this.conversationHistory.push(
        { role: 'user', content: message },
        { role: 'assistant', content: result }
      );

      // Keep history size manageable (last 10 messages)
      if (this.conversationHistory.length > 20) {
        this.conversationHistory = this.conversationHistory.slice(-20);
      }

      console.log('[Grok] Response received:', {
        tokens: data.tokens,
        timestamp: data.timestamp
      });

      return result;
    } catch (error) {
      console.error('[Grok] Chat error:', error.message);
      throw error;
    }
  }

  /**
   * Get accessibility recommendations from Grok
   * 
   * @param {string} context - User's accessibility context/problem
   * @param {object} currentSettings - Current extension settings
   * @returns {Promise<string>} - Accessibility recommendations
   */
  async getAccessibilityRecommendations(context, currentSettings = {}) {
    if (!this.isAvailable) {
      throw new Error('Grok backend is not available.');
    }

    try {
      const response = await fetch(`${this.backendUrl}/api/grok/accessibility`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          context,
          currentSettings
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const data = await response.json();
      return data.result;
    } catch (error) {
      console.error('[Grok] Accessibility recommendation error:', error.message);
      throw error;
    }
  }

  /**
   * Clear conversation history
   */
  clearHistory() {
    this.conversationHistory = [];
  }

  /**
   * Get current conversation history
   */
  getHistory() {
    return [...this.conversationHistory];
  }
}

// Export for use in extension
if (typeof window !== 'undefined') {
  window.GrokClient = GrokClient;
}

// Export for Node.js/bundlers
if (typeof module !== 'undefined' && module.exports) {
  module.exports = GrokClient;
}
