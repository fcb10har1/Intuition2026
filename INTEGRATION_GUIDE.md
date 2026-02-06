# Extension Integration Guide - Using Grok AI

This guide shows you exactly where and how to integrate Grok AI calls into your extension code.

---

## Step 1: Update Manifest (Add Script Reference)

**File:** `cogni-adapt-extension/manifest.json`

In the `content_scripts` section, add `grok_client.js` BEFORE `content_script.js`:

```json
{
  "manifest_version": 3,
  "name": "Intuition",
  ...
  "content_scripts": [
    {
      "matches": ["<all_urls>"],
      "js": [
        "src/shared/grok_client.js",      // ← ADD THIS LINE
        "src/content/content_script.js"
      ],
      "run_at": "document_start"
    }
  ],
  ...
}
```

**Why this order?**
- `grok_client.js` defines the `GrokClient` class
- `content_script.js` can then use `new GrokClient()`

---

## Step 2: Update Backend URL (If Not Local)

**File:** `cogni-adapt-extension/src/shared/grok_client.js`

Find this line (around line 8):
```javascript
const BACKEND_URL = 'http://localhost:3000'; // ← UPDATE THIS
```

**Local development:** Keep as-is
```javascript
const BACKEND_URL = 'http://localhost:3000';
```

**Production (after deploying backend):** Replace with your URL
```javascript
// Example: Deployed to Vercel
const BACKEND_URL = 'https://intuition-backend.vercel.app';

// Example: Deployed to Railway
const BACKEND_URL = 'https://intuition-production.up.railway.app';
```

---

## Step 3: Initialize Grok Client in Content Script

**File:** `cogni-adapt-extension/src/content/content_script.js`

Add this near the top (after the injection guard):

```javascript
if (window.__A11Y_INJECTED__) return;
window.__A11Y_INJECTED__ = true;

// ← ADD THIS SECTION
const BACKEND_URL = 'http://localhost:3000'; // Must match manifest config
const grokClient = new GrokClient(BACKEND_URL);

// (rest of your content script code)
```

---

## Step 4: Use Grok in Your Code

### Example 1: Simple Chat

```javascript
// When user needs quick advice
const grokResponse = await grokClient.chat(
  'User is having trouble reading this page. What accessibility help would you recommend?'
);

console.log('Grok says:', grokResponse);
```

### Example 2: Accessibility Recommendations (Recommended)

```javascript
// When pattern detection finds cognitive overload
const recommendations = await grokClient.getAccessibilityRecommendations(
  'User is on a data-heavy table. Rapid scrolling detected. Multiple sidebars visible.',
  {
    cursorSize: currentState.cursorSize,      // 'normal' | 'enhanced' | 'large'
    cursorColour: currentState.cursorColour,  // 'blue' | 'teal' | 'purple' | 'coral'
    focusMode: currentState.focusMode,        // Boolean
    readingEase: currentState.readingEase      // Boolean
  }
);

// recommendations = something like:
// "I recommend enabling Reading Ease to reduce visual complexity..."

// Show to user:
showNotification('Grok AI Suggestion', recommendations);
```

### Example 3: Health Check (Before Making Request)

```javascript
// At startup or when toggling AI
const isBackendAvailable = await grokClient.checkAvailability();

if (isBackendAvailable) {
  console.log('✅ Grok backend is ready');
  // Safe to use Grok throughout session
} else {
  console.log('⚠️ Grok backend unavailable, using local AI only');
  // Fall back to transformers.js (local AI)
}
```

---

## Step 5: Error Handling

Always wrap Grok calls in try-catch:

```javascript
async function getGrokAdvice(context) {
  try {
    const advice = await grokClient.getAccessibilityRecommendations(
      context,
      currentSettings
    );
    return advice;
  } catch (error) {
    if (error.message.includes('401')) {
      console.error('❌ Backend authentication failed. Check API key.');
    } else if (error.message.includes('429')) {
      console.error('⚠️ Rate limited. Waiting before next request...');
    } else {
      console.error('⚠️ Grok unavailable, falling back to local AI');
    }
    
    // Fall back to local AI (transformers.js)
    return await getLocalAIRecommendations(context);
  }
}
```

---

## Integration Points (Where to Add Grok Calls)

### 1. Pattern Detection (Recommended Primary Use)

**File:** `src/content/content_script.js` → `analyzePatterns()` function

```javascript
function analyzePatterns() {
  // ... existing pattern analysis code ...
  
  if (detectedPatterns.length > 0) {
    // High-severity patterns detected
    const criticalPatterns = detectedPatterns.filter(p => p.severity === 'high');
    
    if (criticalPatterns.length > 0) {
      // Get Grok's specialized advice
      grokClient.getAccessibilityRecommendations(
        `Detected: ${criticalPatterns.map(p => p.description).join(', ')}`,
        state
      ).then(advice => {
        // Show Grok suggestion to user
        showAccessibilityPanel(advice);
      });
    }
  }
}
```

### 2. AI Recommendations (When Applying Assists)

**File:** `src/content/adapt/apply_assists.ts`

```typescript
async function applyAIRecommendations(patterns: Pattern[]) {
  const grokAdvice = await grokClient.getAccessibilityRecommendations(
    `User patterns: ${JSON.stringify(patterns)}`,
    getCurrentState()
  );
  
  // Apply changes based on Grok advice
  if (grokAdvice.includes('Reading Ease')) {
    enableReadingEase();
  }
  if (grokAdvice.includes('Focus Guide')) {
    enableFocusGuide();
  }
  // ... etc
}
```

### 3. On-Demand (When User Clicks Help Button)

**File:** `src/content/ui/toolbar.ts`

```typescript
helpButton.addEventListener('click', async () => {
  const currentContext = describeCurrentPageState();
  
  const grokResponse = await grokClient.getAccessibilityRecommendations(
    `User is requesting help. Page context: ${currentContext}`,
    state
  );
  
  showHelpPanel(grokResponse);
});
```

### 4. Onboarding Follow-Up (Personalized Suggestions)

**File:** `src/onboarding/onboarding.ts`

```typescript
async function showPersonalizedSuggestions(onboardingAnswers) {
  const personalizedAdvice = await grokClient.chat(
    `User answers: ${JSON.stringify(onboardingAnswers)}. What accessibility features would help?`
  );
  
  displaySuggestions(personalizedAdvice);
}
```

---

## Example Integration (Complete)

Here's a complete example showing Grok integrated into `content_script.js`:

```javascript
// ========== INITIALIZATION ==========
if (window.__A11Y_INJECTED__) return;
window.__A11Y_INJECTED__ = true;

const grokClient = new GrokClient('http://localhost:3000');
let grokReady = false;

// Check backend on startup
grokClient.checkAvailability().then(available => {
  grokReady = available;
  console.log(grokReady ? '✅ Grok ready' : '⚠️ Grok unavailable');
});

// ========== PATTERN DETECTION WITH GROK ==========
async function monitorPatterns() {
  setInterval(async () => {
    const patterns = detectPatterns();
    
    if (patterns.find(p => p.severity === 'high') && grokReady) {
      try {
        const advice = await grokClient.getAccessibilityRecommendations(
          patterns.map(p => p.description).join('; '),
          state
        );
        
        // Apply recommendations
        updateUI(advice);
      } catch (error) {
        console.warn('Grok request failed:', error);
        // Continue without Grok
      }
    }
  }, 5000); // Check every 5 seconds
}

// ========== USER INTERACTION ==========
orbButton.addEventListener('click', async () => {
  if (!grokReady) {
    showNotification('⚠️ AI assistance unavailable');
    return;
  }
  
  const context = describeCurrentPage();
  const suggestions = await grokClient.getAccessibilityRecommendations(context, state);
  
  showSuggestionPanel(suggestions);
});

// Start monitoring
monitorPatterns();
```

---

## Testing Your Integration

### 1. In DevTools Console

Make sure backend is running (`npm start` in `/backend`), then:

```javascript
// Test initialization
console.log(typeof GrokClient); // Should be 'function'

const grok = new GrokClient('http://localhost:3000');

// Test health check
await grok.checkAvailability(); // Should log true

// Test simple chat
const response = await grok.chat('Hello');
console.log(response); // Should show Grok's response

// Test accessibility recommendations
const advice = await grok.getAccessibilityRecommendations(
  'User struggling with visual overload',
  { cursorSize: 'large', cursorColour: 'blue' }
);
console.log(advice); // Should show personalized accessibility advice
```

### 2. Verify in Extension Console

1. Open any website
2. Right-click the website → **Inspect**
3. Find **Console** tab
4. Type the commands from step 1 above
5. Should see no errors and proper responses

### 3. Check Backend Logs

When testing, your backend terminal should show:
```
POST /api/grok/accessibility 200 Ok (12ms)
POST /api/grok 200 Ok (15ms)
GET /health 200 Ok (1ms)
```

---

## Troubleshooting Integration

| Error | Solution |
|-------|----------|
| `ReferenceError: GrokClient is not defined` | Make sure `grok_client.js` is listed in manifest BEFORE `content_script.js` |
| `Failed to fetch from http://localhost:3000` | Backend not running. Run `npm start` in `/backend` folder |
| `401 Unauthorized` | Check your Grok API key in `.env` file |
| `Timeout: 5000ms` | Backend is slow. Check network, API key validity |
| `chrome-extension:// origin not allowed` | Add extension origin to `server.js` CORS config |

---

## Next Steps

1. ✅ Add `grok_client.js` to manifest
2. ✅ Start backend server
3. ✅ Initialize `grokClient` in content script
4. ✅ Add calls at pattern detection points
5. ✅ Test with DevTools console (step above)
6. ✅ Deploy backend to production
7. ✅ Update `BACKEND_URL` to production domain

---

## Questions?

- **Extension issues?** Check DevTools console on any webpage
- **Backend issues?** Check terminal where `npm start` is running
- **API issues?** Visit [docs.x.ai](https://docs.x.ai)
- **Need help?** Check conversation history for examples

Good luck! 🚀
