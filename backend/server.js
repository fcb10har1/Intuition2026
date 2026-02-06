/**
 * Intuition Backend - Grok AI Proxy Server
 * 
 * This server proxies requests to the Grok API without exposing API keys
 * to the client-side extension.
 * 
 * SETUP INSTRUCTIONS:
 * 1. npm install
 * 2. Create .env file (copy from .env.example)
 * 3. Add your Grok API key to .env
 * 4. npm start
 */

require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// =============================================================================
// [USER INPUT REQUIRED] - GROK API CONFIGURATION
// Make sure you have set GROK_API_KEY in your .env file
// =============================================================================
const GROK_API_KEY = process.env.GROK_API_KEY;
const GROK_API_URL = 'https://api.x.ai/v1/chat/completions';

if (!GROK_API_KEY) {
  console.warn('⚠️  WARNING: GROK_API_KEY not found in .env file');
  console.warn('Please set GROK_API_KEY to enable Grok features');
}

// Middleware
app.use(cors({
  origin: [
    'chrome-extension://*',
    'http://localhost:3000',
    'http://localhost:5000',
    process.env.EXTENSION_ORIGIN
  ].filter(Boolean)
}));
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

/**
 * POST /api/grok - Main Grok API endpoint
 * 
 * Request body:
 * {
 *   "message": "Your message here",
 *   "conversationHistory": [...] (optional)
 * }
 * 
 * Response:
 * {
 *   "result": "Grok's response",
 *   "tokens": { input: N, output: N }
 * }
 */
app.post('/api/grok', async (req, res) => {
  try {
    const { message, conversationHistory = [] } = req.body;

    // Input validation
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Message is required and must be a string' });
    }

    if (!GROK_API_KEY) {
      return res.status(503).json({
        error: 'Grok API not configured',
        message: 'Server admin must set GROK_API_KEY in .env file'
      });
    }

    // Build messages array
    const messages = [
      ...conversationHistory,
      { role: 'user', content: message }
    ];

    // Call Grok API
    const response = await axios.post(
      GROK_API_URL,
      {
        model: 'grok-beta',
        messages: messages,
        temperature: 0.7,
        max_tokens: 1024
      },
      {
        headers: {
          'Authorization': `Bearer ${GROK_API_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000 // 30 second timeout
      }
    );

    // Extract response
    const result = response.data.choices[0].message.content;
    const tokens = {
      input: response.data.usage?.prompt_tokens || 0,
      output: response.data.usage?.completion_tokens || 0
    };

    res.json({
      result,
      tokens,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Grok API Error:', error.response?.data || error.message);

    if (error.response?.status === 401) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid or expired GROK_API_KEY'
      });
    }

    if (error.response?.status === 429) {
      return res.status(429).json({
        error: 'Rate limited',
        message: 'Too many requests to Grok API. Please wait.'
      });
    }

    res.status(500).json({
      error: 'Grok API request failed',
      message: error.message
    });
  }
});

/**
 * POST /api/grok/accessibility - Accessibility-focused endpoint
 * 
 * Use this for context-aware accessibility recommendations
 * 
 * Request body:
 * {
 *   "context": "User is struggling with visual overload",
 *   "currentSettings": { cursorSize: "large", theme: "dark" }
 * }
 */
app.post('/api/grok/accessibility', async (req, res) => {
  try {
    const { context, currentSettings = {} } = req.body;

    if (!context) {
      return res.status(400).json({ error: 'Context is required' });
    }

    if (!GROK_API_KEY) {
      return res.status(503).json({
        error: 'Grok API not configured'
      });
    }

    const systemPrompt = `You are an accessibility expert helping users with cognitive and visual accessibility. 
Provide concise, actionable recommendations based on the user's context and current settings.
Focus on reducing cognitive load and improving usability.
Keep responses brief and practical.`;

    const response = await axios.post(
      GROK_API_URL,
      {
        model: 'grok-beta',
        messages: [
          { role: 'system', content: systemPrompt },
          { 
            role: 'user', 
            content: `Context: ${context}\n\nCurrent Settings: ${JSON.stringify(currentSettings)}\n\nWhat accessibility improvements would you recommend?`
          }
        ],
        temperature: 0.7,
        max_tokens: 512
      },
      {
        headers: {
          'Authorization': `Bearer ${GROK_API_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      }
    );

    const result = response.data.choices[0].message.content;

    res.json({
      result,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Accessibility Grok Error:', error.response?.data || error.message);
    res.status(500).json({
      error: 'Accessibility recommendation failed',
      message: error.message
    });
  }
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: err.message
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Intuition Backend running on http://localhost:${PORT}`);
  console.log(`📚 Grok API endpoint: POST /api/grok`);
  console.log(`♿ Accessibility endpoint: POST /api/grok/accessibility`);
  console.log(`🏥 Health check: GET /health`);
  
  if (!GROK_API_KEY) {
    console.error('\n❌ GROK_API_KEY is not set!');
    console.error('Please create .env file and add your API key.');
  }
});
