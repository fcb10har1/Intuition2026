# Intuition - Cognitive Accessibility Extension

**Intuition** is a Chrome extension that uses AI to dynamically adapt website interfaces for users with cognitive disabilities, ADHD, and learning differences.

## Overview

- 🧠 **AI-Powered:** Real-time detection of cognitive load patterns
- ♿ **Accessible:** Customizable cursor sizes, color filters, reading assistance
- 🔒 **Private:** All personalization stored locally on device
- 🚀 **Intelligent:** Adapts recommendations based on user behavior
- 🎯 **User-Centric:** No configuration burden—just install and use

## Quick Start

### For End Users

1. Clone this repo
2. Navigate to `chrome://extensions`
3. Turn on **Developer mode** (top right)
4. Click **Load unpacked**
5. Select the `cogni-adapt-extension/` folder
6. Visit any website and click the Intuition orb button!

### For Developers

**Extension Development:**
```bash
cd cogni-adapt-extension
npm install
npm run build
```

**Backend Setup (Grok AI Integration):**
```bash
cd backend
npm install
cp .env.example .env          # Add your Grok API key
npm start                      # Starts on http://localhost:3000
```

See [backend/SETUP.md](backend/SETUP.md) for detailed setup instructions.

---

## Architecture

### Extension Structure

```
cogni-adapt-extension/
├── src/
│   ├── background/              # Background service worker
│   │   └── service_worker.ts    # Manages background tasks
│   ├── content/                 # Content script (injected into pages)
│   │   ├── content_script.js    # Main injection point
│   │   ├── adapt/               # Accessibility adaptations
│   │   │   ├── apply_assists.ts # Applies CSS + UI mods
│   │   │   └── assists/         # Individual modules (cursor, focus, etc)
│   │   ├── signals/             # Pattern detection
│   │   │   ├── dom_analyzer.ts
│   │   │   └── feature_extractor.ts
│   │   └── ui/                  # Floating UI components
│   │       ├── banner.ts        # Status banner
│   │       ├── toolbar.ts       # Control panel
│   │       └── panels/          # Expandable panels
│   ├── popup/                   # Popup UI
│   │   ├── popup.html
│   │   └── popup.js
│   ├── onboarding/              # Onboarding flow
│   │   ├── onboarding.html
│   │   ├── questions.ts         # Questionnaire (10 Qs)
│   │   └── scoring.ts           # Score-based recommendations
│   ├── options/                 # Settings page
│   ├── shared/                  # Shared utilities
│   │   ├── grok_client.js       # Grok API wrapper
│   │   ├── ai_client.js         # Transformers.js wrapper
│   │   ├── types.ts             # TypeScript types
│   │   ├── constants.ts         # Configuration
│   │   └── utils.ts             # Helper functions
│   └── eval/                    # Analytics dashboard
└── scripts/                     # Build scripts
    ├── build.mjs
    └── pack.mjs
```

### Backend Structure

```
backend/
├── server.js                    # Express proxy server
├── package.json                 # Dependencies
├── .env.example                 # Configuration template
├── .gitignore                   # Protect secrets
└── SETUP.md                     # Deployment guide
```

---

## Features

### 🎨 User Interface

- **Floating Orb Button** (56×56px)
  - Customizable position (stored in `chrome.storage.local`)
  - Draggable (>6px threshold to distinguish from clicks)
  - Symmetric 8-dot icon with center graphic
  
- **Customizable Cursor Magnifier**
  - 3 sizes: Normal, Enhanced (28-40px), Large (40-56px)
  - 4 colors: Blue, Teal, Purple, Coral
  - Clip-art pointing hand style
  - Persistent across sessions

- **Control Panel**
  - Size/Color segmented selectors
  - No emoji icons (professional design)
  - Slides up from bottom of page

### 🧠 AI System

**Client-Side (In-Browser):**
- Transformers.js for lightweight inference
- No external API calls for basic recommendations
- Runs distilgpt2 for contextual suggestions

**Server-Side (Grok API via Backend):**
- Two specialized endpoints:
  - `/api/grok` - Generic chat with conversation history
  - `/api/grok/accessibility` - Domain-specific recommendations
- Centralized API key management (never exposed to users)
- Conversation history auto-memory (20 messages)

### 📊 Pattern Detection

Real-time monitoring for:
- **Scroll Thrashing:** Rapid up/down scrolling → Reduce Distractions
- **Focus Loss:** Frequent tab switches → Focus Mode
- **Cognitive Overload:** Dense text + high click rate → Reading Ease
- **Time Pressure:** Fast interactions → Time Control

### 💾 Storage

- **Cloud Sync** (via `chrome.storage.sync`):
  - Onboarding responses
  - Adaptation history
  - Sync across user's devices
  
- **Device-Local** (via `chrome.storage.local`):
  - Orb position
  - Cursor settings
  - UI preferences

---

## Current Adaptations

### Step-by-Step Mode
- Breaks complex tasks into numbered steps
- Highlights current step
- CSS animations guide user through process

### Reading Ease
- Increased line spacing
- Larger font sizes
- Better contrast ratios
- Focus line for tracking

### Focus Guide
- Highlight active elements
- Dim irrelevant content
- Reduce visual noise

### Reduce Distractions
- Hide auto-playing videos
- Disable animations
- Gray out ads
- Simplify color scheme

### Error Support
- Highlight form errors in red
- Show correction suggestions
- Prevent form submission without fixes

### Time Control
- Delay auto-submit actions
- Show countdown timers
- Pause on blur

---

## Integration Points

### Using Grok AI in Extension

```javascript
// In content_script.js or any extension page
const grok = new GrokClient('http://localhost:3000');

// Check availability
const available = await grok.checkAvailability();

// Get recommendations
const advice = await grok.getAccessibilityRecommendations(
  'User is overwhelmed by dense financial tables',
  { cursorSize: 'large', currentTheme: 'dark' }
);

// Use in UI
showNotification(advice);
```

### Backend Authentication (Optional)

Currently, backend accepts all requests. To add authentication:

1. Update `server.js` to validate extension origin
2. Add API key validation
3. Implement rate limiting per IP
4. Add user tracking (optional)

---

## Deployment

### Extension

1. Build: `npm run build`
2. Pack: `npm run pack` → creates `.zip` for Chrome Web Store

### Backend

See [backend/SETUP.md](backend/SETUP.md) for options:
- **Vercel** (recommended—free, serverless)
- **Railway.app** (free tier, auto-deploys)
- **Self-hosted** (VPS, dedicated server)

---

## Security & Privacy

### What Data Is Collected?

**Extension:**
- Interaction patterns (clicks, scrolls)
- Accessibility settings (cursor size, colors)
- Onboarding responses (disability categories)
- ✅ **All stored locally on device**

**Backend:**
- API requests (count, domain)
- Error logs (for monitoring)
- ❌ **No personal data sent**

### API Key Safety

- ✅ API key stored **only on backend**
- ✅ Never exposed to users or client code
- ✅ `.env` file excluded from git
- ✅ CORS validation on backend

---

## Development

### Build Extension

```bash
cd cogni-adapt-extension
npm install
npm run build        # Outputs to src/ (TypeScript compiled)
```

### Start Backend (Dev Mode)

```bash
cd backend
npm install
npm run dev          # Auto-reload with nodemon
```

### Testing

1. Load extension: `chrome://extensions` → Load unpacked
2. Open test page
3. Check extension console: right-click orb → Inspect

### Debugging

- Content script console: Open DevTools on any page (extension runs there)
- Popup console: right-click extension icon → Inspect popup
- Background service worker: `chrome://extensions` → Click service worker link

---

## Keyboard Shortcuts (Planned)

- **Alt+O:** Toggle orb
- **Alt+M:** Toggle cursor magnifier
- **Alt+F:** Toggle focus mode

---

## Browser Support

- ✅ Chrome/Edge (Manifest V3)
- ⚠️ Firefox (some MV3 features not supported)
- ❌ Safari (no MV3 support yet)

---

## File Reference

### Key Files Explained

| File | Purpose |
|------|---------|
| `content_script.js` | Injects UI and patterns into every page |
| `grok_client.js` | Client wrapper for Grok API backend |
| `ai_client.js` | Transformers.js local inference |
| `service_worker.ts` | Background coordination & messaging |
| `apply_assists.ts` | Applies CSS & UI modifications |
| `questions.ts` | Onboarding questionnaire (10 questions) |
| `types.ts` | TypeScript interfaces & enums |

---

## Contributing

Issues, PRs, and feedback welcome! Please:

1. Fork the repo
2. Create a feature branch
3. Make changes
4. Test thoroughly
5. Submit PR with description

---

## License

MIT - See LICENSE file for details

---

## Support

- 📧 Email: support@intuition.example.com
- 💬 Discord: [Community server]
- 🐛 Issues: GitHub Issues
- 📖 Docs: [Full Documentation]

---

## Questions?

**For Extension Development:**
- See `cogni-adapt-extension/` folder structure
- Check TypeScript types in `src/shared/types.ts`

**For Backend Setup:**
- Read [backend/SETUP.md](backend/SETUP.md)
- Grok API docs: https://docs.x.ai/

**For Debugging:**
- Extension console logs appear in page DevTools
- Backend logs appear in terminal where you ran `npm start`

---

Made with ♥️ for accessibility
