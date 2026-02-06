# Intuition - Grok AI Integration Setup Guide

## Overview

This guide walks you through setting up Grok AI integration for the Intuition accessibility extension. The integration uses a **backend proxy server** to securely handle API calls without exposing API keys to users.

---

## Architecture

```
Extension (Frontend)
    ↓
Grok Client (grok_client.js)
    ↓
Backend Server (Node.js/Express)
    ↓
Grok API (x.ai)
```

**Why this approach?**
- ✅ API keys never exposed to users or client-side code
- ✅ Centralized rate limiting and quota management
- ✅ Can add authentication/user tracking later
- ✅ No setup required for end users

---

## Step 1: Get Grok API Key

1. Go to [console.x.ai](https://console.x.ai/)
2. Sign up or log in
3. Navigate to **API Keys** section
4. Create a new API key
5. Copy the key (save it somewhere safe)

**Your API Key:** `[USER INPUT REQUIRED - Keep this private!]`

---

## Step 2: Set Up Backend Server

### 2a. Install Dependencies

```bash
cd backend
npm install
```

### 2b. Configure Environment

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Open `.env` and replace the placeholder:
   ```env
   # [USER INPUT] - Paste your Grok API key here
   GROK_API_KEY=gsk_... (your actual key)
   ```

3. **⚠️ IMPORTANT:** Add `.env` to `.gitignore` (already done):
   ```bash
   # .env is already in .gitignore - never commit it!
   ```

### 2c. Start the Backend

```bash
# Development (with auto-reload)
npm run dev

# Or standard start
npm start
```

You should see:
```
🚀 Intuition Backend running on http://localhost:3000
📚 Grok API endpoint: POST /api/grok
♿ Accessibility endpoint: POST /api/grok/accessibility
🏥 Health check: GET /health
```

### 2d. Test the Backend

```bash
# Test health check
curl http://localhost:3000/health

# Test Grok endpoint
curl -X POST http://localhost:3000/api/grok \
  -H "Content-Type: application/json" \
  -d '{"message": "Hello, Grok!"}'
```

---

## Step 3: Configure Extension

### 3a. Update Backend URL (if not local)

In `cogni-adapt-extension/src/shared/grok_client.js`:

```javascript
// [USER INPUT] - Change this if your backend is not at localhost:3000
const BACKEND_URL = 'http://localhost:3000'; // Local development
// const BACKEND_URL = 'https://your-production-backend.com'; // Production
```

### 3b. Add Grok Client to Manifest

In `cogni-adapt-extension/manifest.json`, add to content_scripts:

```json
{
  "matches": ["<all_urls>"],
  "js": [
    "src/shared/grok_client.js",    // Add this line
    "src/content/content_script.js"
  ],
  "run_at": "document_start"
}
```

### 3c. Use in Extension Code

Example in content script or any extension file:

```javascript
// Initialize Grok client
const grok = new GrokClient('http://localhost:3000');

// Check if available
await grok.checkAvailability();

// Simple chat
const response = await grok.chat('What is cognitive load?');
console.log(response);

// Accessibility recommendations
const recommendations = await grok.getAccessibilityRecommendations(
  'User is struggling with visual overload on dense LMS pages',
  { cursorSize: 'enhanced', theme: 'dark' }
);
console.log(recommendations);
```

---

## Step 4: Production Deployment

### Option A: Vercel (Easiest)

1. Install Vercel CLI:
   ```bash
   npm i -g vercel
   ```

2. Deploy backend:
   ```bash
   cd backend
   vercel
   ```

3. Add environment variable during deployment:
   - Set `GROK_API_KEY` in Vercel dashboard
   - Your backend will be at: `https://your-project.vercel.app`

4. Update extension:
   ```javascript
   const BACKEND_URL = 'https://your-project.vercel.app';
   ```

### Option B: Railway.app

1. Create account at [railway.app](https://railway.app)
2. Connect GitHub repo or deploy from CLI
3. Add environment variable: `GROK_API_KEY=your_key`
4. Railway assigns a public URL automatically

### Option C: Self-hosted (VPS/Heroku/etc)

1. Choose your hosting provider
2. Set up Node.js environment
3. Set environment variable: `GROK_API_KEY=your_key`
4. Deploy code
5. Update extension's `BACKEND_URL`

---

## API Reference

### POST `/api/grok`

Send a message to Grok (with conversation history).

**Request:**
```json
{
  "message": "What is accessibility?",
  "conversationHistory": []
}
```

**Response:**
```json
{
  "result": "Accessibility refers to...",
  "tokens": { "input": 10, "output": 50 },
  "timestamp": "2026-02-06T..."
}
```

### POST `/api/grok/accessibility`

Get accessibility-focused recommendations.

**Request:**
```json
{
  "context": "User has trouble focusing on dense text",
  "currentSettings": { "cursorSize": "large", "theme": "dark" }
}
```

**Response:**
```json
{
  "result": "Based on your context, I recommend...",
  "timestamp": "2026-02-06T..."
}
```

### GET `/health`

Check if backend is running.

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2026-02-06T..."
}
```

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| `GROK_API_KEY not found` | Create `.env` file and add your key |
| `Backend unreachable` | Make sure backend is running (`npm start`) |
| `401 Unauthorized` | Check that API key is correct and not expired |
| `429 Rate limited` | Wait or upgrade Grok plan |
| Extension not using Grok | Verify `BACKEND_URL` matches your backend address |
| CORS errors | Check that backend includes extension origin in CORS config |

---

## Security Checklist

- ✅ Never commit `.env` file to git
- ✅ API key is only in backend `.env` (not in extension code)
- ✅ Backend validates all requests
- ✅ Production should use HTTPS
- ✅ Consider adding rate limiting per user/IP
- ✅ Log API usage for monitoring

---

## Files Created

```
backend/
  ├── package.json           (Dependencies)
  ├── server.js             (Main backend server)
  ├── .env.example          (Template for .env)
  └── .gitignore            (Protect .env from git)

cogni-adapt-extension/
  └── src/shared/
      └── grok_client.js    (Extension client library)
```

---

## Next Steps

1. ✅ Set up backend and get Grok API key
2. ✅ Create `.env` file with API key
3. ✅ Start backend server
4. ✅ Test backend health endpoint
5. ✅ Update extension manifest with grok_client.js
6. ✅ Update BACKEND_URL in grok_client.js if needed
7. ✅ Start using Grok in your extension!

---

## Questions?

- Grok API docs: https://docs.x.ai/
- Express.js docs: https://expressjs.com/
- Check console logs for detailed error messages

**Happy hacking! 🚀**
