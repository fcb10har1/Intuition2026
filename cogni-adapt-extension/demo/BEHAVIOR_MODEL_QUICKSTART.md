# Behavior Model - Quick Start Integration

## 30-Minute Setup

### Step 1: Import the Model (2 min)

Add this to the top of your `src/content/content_script.js`:

```javascript
import { getBehaviorModel } from '../background/policy_engine/behaviour_model.ts';

let model = null;

// Initialize on script load
(async () => {
  model = await getBehaviorModel();
  console.log('[BehaviorModel] Loaded:', model.getSummary());
})();
```

---

### Step 2: Record When User Toggles Focus Mode (5 min)

Find this function in your `content_script.js`:

```javascript
// BEFORE:
function apply(enabled, level, announce = true) {
  injectCssOnce();
  setFocusEnabled(enabled);
  setLevel(level);
  if (announce) {
    if (enabled) showToast(`Focus Mode: ON (${level})`);
    else showToast("Focus Mode: OFF");
  }
}
```

Replace with:

```javascript
// AFTER:
async function apply(enabled, level, announce = true) {
  injectCssOnce();
  setFocusEnabled(enabled);
  setLevel(level);
  
  // RECORD THE EVENT
  if (model) {
    if (enabled) {
      model.recordEvent({
        assist: 'focus_mode',
        action: 'applied',
        domain: window.location.hostname,
        timestamp: Date.now(),
        context: { intensity: level }
      });
    } else {
      model.recordEvent({
        assist: 'focus_mode',
        action: 'rejected',
        domain: window.location.hostname,
        timestamp: Date.now()
      });
    }
    await model.save();
  }
  
  if (announce) {
    if (enabled) showToast(`Focus Mode: ON (${level})`);
    else showToast("Focus Mode: OFF");
  }
}
```

---

### Step 3: Auto-Enable on Familiar Sites (8 min)

In your `loadInitialStateFromStorage()` function, add this after applying saved settings:

```javascript
async function loadInitialStateFromStorage() {
  try {
    const res = await chrome.storage.sync.get([
      "focusEnabled",
      "intensityLevel",
      "onboardingResponses"
    ]);

    const enabled = typeof res.focusEnabled === "boolean" ? res.focusEnabled : false;
    const level = normalizeLevel(res.intensityLevel);

    apply(enabled, level, false);

    // Get AI recommendations (existing code)
    if (res.onboardingResponses && monitorState.aiClient) {
      const interactions = {
        scrollReversals: monitorState.scrollReversals,
        idlePeriods: monitorState.idlePeriods,
        overloadScore: monitorState.score
      };
      const recommendations = await monitorState.aiClient.getAIRecommendations(
        res.onboardingResponses,
        interactions
      );
      if (recommendations) {
        applyAIRecommendations(recommendations);
      }
    }

    // NEW: Check behavior model for learned preferences
    if (model && model.getConfidence() > 0.3) {
      const predictions = model.predictAssistsForDomain(window.location.hostname);
      const learnedIntensity = model.predictIntensity(window.location.hostname);
      
      // Auto-enable if we're confident
      if (model.shouldAutoEnable('focus_mode', window.location.hostname)) {
        console.log(`[BehaviorModel] Auto-enabling focus_mode on ${window.location.hostname}`);
        apply(true, learnedIntensity, true);
      }
    }
  } catch {
    apply(false, DEFAULT_LEVEL, false);
  }
}
```

---

### Step 4: Show User Their Learned Profile in Popup (15 min)

Add this to `src/popup/popup.html`:

```html
<div id="learnedProfile" class="card" style="margin-top: 20px; font-size: 11px; background: #f0f9ff; border: 1px solid #bfdbfe;">
  <strong>Your Learned Profile</strong>
  <div id="profileContent" style="margin-top: 8px; color: #666;">
    <p>Loading...</p>
  </div>
  <button id="resetProfileBtn" style="margin-top: 10px; padding: 6px 10px; font-size: 11px;">
    🗑 Reset Learning
  </button>
</div>
```

Add this to `src/popup/popup.js`:

```javascript
// NEW: Load and display behavior profile
async function loadLearnedProfile() {
  try {
    const tab = await getActiveTab();
    if (!tab?.id) return;

    const response = await chrome.tabs.sendMessage(tab.id, {
      action: 'getBehaviorProfile'
    });

    const profile = response.profile;
    if (!profile) {
      document.getElementById('profileContent').innerHTML = 
        '<p style="color: #999;">No profile yet. Use the extension to build your profile.</p>';
      return;
    }

    // Show summary
    const confidence = (profile.learningLevel * 100).toFixed(0);
    const domainCount = Object.keys(profile.domainProfiles).length;
    const eventCount = Object.keys(profile.globalPreferences).reduce(
      (sum, key) => sum + profile.globalPreferences[key].timesApplied + profile.globalPreferences[key].timesRejected,
      0
    );

    const html = `
      <p><strong>Confidence:</strong> ${confidence}% 
        ${confidence < 30 ? '(keep using to learn more)' : 
          confidence < 70 ? '(learning...)' : 
          '(very confident)'}
      </p>
      <p><strong>Sites tracked:</strong> ${domainCount}</p>
      <p><strong>Events recorded:</strong> ${eventCount}</p>
      <p style="color: #999; font-size: 10px; margin-top: 6px;">
        Your preferences are stored locally on this device, never sent to any server.
      </p>
    `;

    document.getElementById('profileContent').innerHTML = html;
  } catch (e) {
    console.warn('Could not load profile:', e);
  }
}

// Hook up button
document.getElementById('resetProfileBtn')?.addEventListener('click', async () => {
  if (confirm('Reset all learned preferences? This cannot be undone.')) {
    const tab = await getActiveTab();
    if (tab?.id) {
      await chrome.tabs.sendMessage(tab.id, { action: 'resetBehavior' });
    }
    await loadLearnedProfile();
  }
});

// Load on popup open
document.addEventListener('DOMContentLoaded', async () => {
  // ... existing code ...
  await loadLearnedProfile();
});
```

---

### Step 5: Add Message Handler to Content Script (3 min)

Add this to your `chrome.runtime.onMessage.addListener`:

```javascript
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  // ... existing handlers ...

  // NEW: Handle profile requests
  if (msg.action === 'getBehaviorProfile') {
    const profile = model?.export() || null;
    sendResponse({ profile });
    return true;
  }

  if (msg.action === 'resetBehavior') {
    if (model) {
      model.reset().then(() => {
        sendResponse({ ok: true });
      });
    }
    return true;  // Keep channel open for async response
  }
});
```

---

## Testing It

### Test 1: Simple Recording
1. Open any LMS page
2. Open DevTools (`F12 → Console`)
3. Toggle focus mode ON/OFF
4. Check console for: `[BehaviorModel] Recorded: focus_mode applied on canvas.instructure.com`

### Test 2: Auto-Enable
1. Use focus mode on Canvas 3-4 times (keep it ON each time)
2. Close and reopen Canvas page
3. Focus mode should auto-enable silently
4. Check console: `[BehaviorModel] Auto-enabling focus_mode`

### Test 3: Learned Profile
1. Use extension on 2-3 different sites
2. Open popup
3. See "Your Learned Profile" card with stats
4. Confidence should increase as you use more

---

## Full Integration Checklist

- [ ] Import `getBehaviorModel` in content script
- [ ] Make `apply()` function async and record events
- [ ] Add profile check in `loadInitialStateFromStorage()`
- [ ] Add profile UI to popup.html
- [ ] Add profile display logic to popup.js
- [ ] Add message handler for `getBehaviorProfile` and `resetBehavior`
- [ ] Test recording events (DevTools console)
- [ ] Test auto-enable after 3-4 uses
- [ ] Test profile display in popup

---

## What Happens Now

**After User's First Session:**
```
Global profile created
focus_mode: 1 application recorded
No auto-enable yet (need more data)
```

**After 5 Sessions:**
```
Canvas profile: focus_mode likelihood = 0.9
Blackboard profile: focus_mode likelihood = -0.5 (user rejects it here)
Confidence: 0.25 (not yet auto-enabling)
```

**After 15 Sessions:**
```
Canvas: Auto-enable focus_mode (0.95 likelihood, high confidence)
Blackboard: Skip focus_mode (user rejects it)
Gmail: Use global preference (neutral ground)
Confidence: 0.8 (very sure now)
```

---

## Advanced: Track Other Assists

Once this works, add more assists:

```javascript
// In apply() or other assist functions:

async function applyReadingEase(enabled) {
  if (model) {
    model.recordEvent({
      assist: 'reading_ease',
      action: enabled ? 'applied' : 'rejected',
      domain: window.location.hostname,
      timestamp: Date.now()
    });
    await model.save();
  }
  document.body.classList.toggle('assist-reading-ease', enabled);
}

// Same for:
// - reduce_distractions
// - step_by_step
// - time_control
// - error_support
```

---

## Troubleshooting

**Q: Events not recording**
- Check: Is `model` initialized? (Check console log)
- Check: Are you calling `await model.save()` after each event?

**Q: Auto-enable not working**
- Check: Need at least 5 uses before confident enough
- Check: `shouldAutoEnable()` requires likelihood > 0.6 AND confidence >= 0.4

**Q: Profile not showing in popup**
- Check: Content script loaded? (Check for `[BehaviorModel] Loaded` in console)
- Check: Message handler added to `chrome.runtime.onMessage`?

**Q: Data not persisting**
- Check: `model.save()` called?
- Check: Using `chrome.storage.local` (local to device, not synced)
- Check: On Chrome, not Chromium-based browser?

---

**That's it!** Your extension now learns and remembers user preferences automatically. 🎉
