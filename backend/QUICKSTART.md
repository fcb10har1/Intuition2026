# Backend Quick Start (5 Minutes)

## Prerequisites
- Node.js 16+ installed
- Grok API key from [console.x.ai](https://console.x.ai/)

## Setup Steps

### 1️⃣ Install Dependencies
```bash
npm install
```

### 2️⃣ Create .env File
```bash
cp .env.example .env
```

Edit `.env` and replace:
```env
GROK_API_KEY=gsk_YOUR_ACTUAL_KEY_HERE
```

### 3️⃣ Start Server
```bash
npm start
```

You'll see:
```
🚀 Intuition Backend running on http://localhost:3000
📚 Grok API endpoint: POST /api/grok
♿ Accessibility endpoint: POST /api/grok/accessibility
🏥 Health check: GET /health
```

### 4️⃣ Test It
```bash
curl http://localhost:3000/health
```

Should return:
```json
{"status": "ok", "timestamp": "..."}
```

---

## Common Commands

| Command | Purpose |
|---------|---------|
| `npm start` | Run production server |
| `npm run dev` | Run dev server (auto-reload) |
| `npm test` | Run tests (if configured) |

---

## Next Steps

1. Update extension's `grok_client.js`:
   ```javascript
   const BACKEND_URL = 'http://localhost:3000'; // Change if not local
   ```

2. Test from extension:
   ```javascript
   const grok = new GrokClient('http://localhost:3000');
   const response = await grok.chat('Hello!');
   ```

3. For production, deploy to Vercel/Railway and update `BACKEND_URL`

---

## Troubleshooting

**Error: Cannot find module 'express'**
→ Run `npm install`

**Error: GROK_API_KEY not found**
→ Create `.env` with your API key

**Port 3000 already in use**
→ Edit `.env`: `PORT=3001`

**Backend unreachable from extension**
→ Verify `BACKEND_URL` in `grok_client.js` is correct

---

See [SETUP.md](SETUP.md) for detailed documentation.
