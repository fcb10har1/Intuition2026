# Deployment Checklist

Use this checklist to ensure everything is ready before deploying to production.

---

## Pre-Deployment (Local Testing)

- [ ] Backend running locally (`npm start` in `/backend`)
- [ ] API key configured in `.env`
- [ ] Health check passes: `curl http://localhost:3000/health`
- [ ] Extension loads without errors: `chrome://extensions`
- [ ] Orb button appears on test websites
- [ ] Cursor magnifier works (all 3 sizes, 4 colors)
- [ ] Pattern detection triggers appropriately
- [ ] Grok API responds with recommendations
- [ ] No console errors on background.js or content script
- [ ] No manifest warnings

---

## Backend Deployment

### Pre-Deployment Prep

- [ ] Remove all `console.log()` debug statements from sensitive functions
- [ ] Test with `NODE_ENV=production` locally
- [ ] Verify `.gitignore` includes `.env`
- [ ] Database/secret management in place (if needed)
- [ ] Rate limiting configured (optional but recommended)
- [ ] CORS configuration updated with production domains

### Vercel Deployment (Recommended)

- [ ] Create Vercel account (free tier available)
- [ ] Install Vercel CLI: `npm i -g vercel`
- [ ] Deploy: `vercel` in `/backend` folder
- [ ] Add environment variable `GROK_API_KEY` in Vercel dashboard
- [ ] Note deployment URL: `https://your-project.vercel.app`
- [ ] Test health endpoint: `curl https://your-project.vercel.app/health`
- [ ] Note API endpoints ready:
  - `https://your-project.vercel.app/api/grok`
  - `https://your-project.vercel.app/api/grok/accessibility`

### Railway Deployment

- [ ] Create Railway account (free tier available)
- [ ] Connect GitHub or deploy via CLI
- [ ] Set `GROK_API_KEY` environment variable
- [ ] Note deployment URL (Railway generates automatically)
- [ ] Test endpoints
- [ ] Enable public networking if needed

### Self-Hosted (VPS/Dedicated Server)

- [ ] Obtain server (DigitalOcean, Linode, AWS, etc.)
- [ ] Install Node.js + npm
- [ ] Deploy code to server
- [ ] Set `.env` variables on server
- [ ] Configure firewall (allow port 3000 or your port)
- [ ] Set up SSL/HTTPS (Let's Encrypt recommended)
- [ ] Configure reverse proxy (nginx/Apache) if needed
- [ ] Set up monitoring/logging
- [ ] Test endpoints over HTTPS

---

## Extension Deployment

### Code Changes

- [ ] Update `BACKEND_URL` in `src/shared/grok_client.js` to production URL
- [ ] Test extension with updated URL locally
- [ ] No `http://localhost` references remaining in extension code
- [ ] All debug statements removed
- [ ] Manifest version bumped (for Chrome Web Store)

### Chrome Web Store (Distribution)

- [ ] Create developer account on [Chrome Web Store](https://chrome.google.com/webstore)
- [ ] Pay one-time developer fee ($5)
- [ ] Create extension listing:
  - [ ] Screenshots (1280×800)
  - [ ] Icon (128×128)
  - [ ] Description
  - [ ] Permissions explanation
- [ ] Build extension: `npm run build && npm run pack`
- [ ] Upload `.zip` file
- [ ] Review for violations (permissions, privacy, etc.)
- [ ] Set pricing (free or paid)
- [ ] Submit for review
- [ ] Monitor review status (typically 24-72 hours)

### Manual Distribution

If not using Chrome Web Store:
- [ ] Build: `npm run pack`
- [ ] Share `.zip` with users
- [ ] Provide installation instructions
- [ ] Document how to update (download new version)

---

## Security Checklist

- [ ] `.env` file is in `.gitignore` (confirmed)
- [ ] No API keys in source code
- [ ] HTTPS enabled for backend (not just HTTP)
- [ ] CORS restricted to extension origin (or auto-configured)
- [ ] Database credentials encrypted (if applicable)
- [ ] Rate limiting enabled for API endpoints
- [ ] Logging does not store sensitive data
- [ ] GROK_API_KEY rotated before deployment
- [ ] No hardcoded usernames/passwords
- [ ] Extension permissions minimized (only what's needed)

---

## Privacy Checklist

- [ ] Privacy policy written and linked in extension store listing
- [ ] Extension doesn't track user data
- [ ] No analytics service integrated (or explicitly disclosed)
- [ ] Local storage (not cloud) for user preferences
- [ ] No telemetry without explicit opt-in
- [ ] Onboarding clearly explains data collection
- [ ] Users can delete their data anytime

---

## Monitoring

Once deployed, set up monitoring:

### Backend

- [ ] Error logging configured (Sentry, LogRocket, etc.)
- [ ] Performance monitoring active (Vercel Analytics, etc.)
- [ ] Uptime monitoring (UptimeRobot, etc.)
- [ ] Alerts configured for:
  - [ ] High error rate (>5%)
  - [ ] API latency (>5s)
  - [ ] API key near quota limit
  - [ ] Server downtime

### Extension

- [ ] Chrome Web Store reviews monitored
- [ ] Error reports reviewed regularly
- [ ] User feedback considered
- [ ] Crash reports tracked
- [ ] Update schedule established

---

## Testing in Production

### Smoke Tests (Run After Deployment)

```bash
# Test health
curl https://your-backend-url.com/health

# Test Grok endpoint
curl -X POST https://your-backend-url.com/api/grok \
  -H "Content-Type: application/json" \
  -d '{"message": "test"}'

# Test accessibility endpoint
curl -X POST https://your-backend-url.com/api/grok/accessibility \
  -H "Content-Type: application/json" \
  -d '{"context": "test", "currentSettings": {}}'
```

### Extension Functional Tests

On production deployment:
- [ ] Extension loads from Chrome Web Store
- [ ] Orb button appears on test website
- [ ] Cursor magnifier works
- [ ] Settings persist across page reloads
- [ ] Grok recommendations appear in console (no errors)
- [ ] No connection errors to backend
- [ ] Network traffic shows calls to production backend URL

---

## Rollback Plan

If issues arise in production:

1. **Backend Issues**
   - Revert to previous Vercel/Railway deployment
   - Or scale down affected servers
   - Update extension pointing back to stable URL (if needed)

2. **Extension Issues**
   - Remove from Chrome Web Store (unpublish if critical)
   - Direct users to uninstall/wait for fix
   - Publish patched version

3. **API Key Issues**
   - Rotate key immediately in `.env`
   - Redeploy backend with new key
   - No extension-side changes needed

---

## Post-Deployment (First Week)

- [ ] Monitor error logs daily
- [ ] Check user reviews/ratings
- [ ] Respond to support emails
- [ ] Fix any critical bugs reported
- [ ] Verify analytics working correctly
- [ ] Performance metrics stable
- [ ] No unexpected rate limiting

---

## Long-Term Maintenance

- [ ] Weekly log review
- [ ] Monthly performance analysis
- [ ] Quarterly security audit
- [ ] Yearly dependency updates
- [ ] API quota monitoring
- [ ] User feedback integration
- [ ] Documentation updates

---

## Sign-Off

- [ ] Deployment lead: _______________  Date: _____
- [ ] QA: _______________  Date: _____
- [ ] Security review: _______________  Date: _____
- [ ] Product owner: _______________  Date: _____

---

**Deployment Date:** ________________

**Deployment URL:** ________________

**Notes:** ________________

---

See [backend/SETUP.md](backend/SETUP.md) and [INTEGRATION_GUIDE.md](INTEGRATION_GUIDE.md) for detailed instructions.
