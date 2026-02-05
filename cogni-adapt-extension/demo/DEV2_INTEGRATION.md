# Dev 2 Integration Guide: Overload Detection

## Overview
Dev 3 has delivered a **rules-based overload detection system** that tracks scroll reversals and idle time to estimate cognitive load. This guide explains how to integrate it into the content script.

## What You're Getting

**File**: `adapt.js` (181 lines)
**Contract**: `window.startOverloadMonitor(onOverload)`
**Returns**: `stop()` function to cleanup

## Integration Strategy

### Option A: Direct Copy (Simplest)
1. Copy the entire `adapt.js` content into your [content/content_script.ts](../src/content/content_script.ts)
2. After copying, wrap the IIFE and expose the function globally
3. Call `startOverloadMonitor()` when the content script initializes

### Option B: Load as Module (Cleaner)
1. Host `adapt.js` in a `src/shared/` folder as a utility
2. Import it as a module in content script
3. Call the exposed function

## Step-by-Step Integration

### 1. Add to Content Script Initialization

In [src/content/content_script.ts](../src/content/content_script.ts), after initialization:

```typescript
// Initialize overload detection
const stopMonitoring = window.startOverloadMonitor(() => {
  handleOverloadDetected();
});

// Store cleanup function for when tab is closed
window.addEventListener('beforeunload', () => {
  stopMonitoring?.();
});
```

### 2. Write the Overload Handler

```typescript
function handleOverloadDetected() {
  // Log to metrics store
  metricsStore.recordEvent('overload_detected', {
    timestamp: Date.now(),
    url: window.location.href,
  });

  // Get current user profile from policy engine
  chrome.runtime.sendMessage(
    { action: 'getAdaptationProfile' },
    (profile) => {
      // Suggest overload-mitigation adaptations
      applyAdaptations({
        focusMode: true,
        hideSidebars: true,
        hideAds: true,
        simplifyText: true,
      });
    }
  );

  // Show in-page notification (optional)
  showNotification('Cognitive overload detected. Enabling simplified view...');
}
```

### 3. Apply Adaptations via Policy Engine

After overload is detected, trigger:

```typescript
function applyAdaptations(suggestions) {
  // Send to background service worker via policy engine
  chrome.runtime.sendMessage({
    action: 'applyAdaptations',
    adaptations: suggestions,
    source: 'overload_detector',
  });
}
```

### 4. Handle Focus Mode Styling

The `adapt.js` sets `document.documentElement.dataset.cogFocus = "true"` for demo purposes. In production, you should:

**Option A**: Use the existing CSS classes in [src/content/adapt/css/focus_mode.css](../src/content/adapt/css/focus_mode.css)
```typescript
// Instead of relying on adapt.js CSS:
function enableFocusMode() {
  document.documentElement.dataset.cogFocus = "true";
  // OR inject your own CSS module:
  applyStylesheet('focus_mode.css');
}
```

**Option B**: Let the policy engine handle styling
```typescript
// Policy engine applies CSS classes based on recommended assists
recommendedAssists.forEach(assist => {
  document.body.classList.add(`assist-${assist}`);
});
```

## Customization: Tuning Sensitivity

The `adapt.js` exposes tuning parameters inside `startOverloadMonitor()`:

```javascript
const WINDOW_MS = 6000;        // How far back to look for scroll reversals
const REVERSAL_CLUSTER = 3;    // Number of reversals to count as "thrashing"
const REVERSAL_POINTS = 18;    // Score added per cluster
const IDLE_MS = 5000;          // How long before "stuck" (pause)
const IDLE_POINTS = 12;        // Score added per idle period
const DECAY = 4;               // Score decay per tick (recovery rate)
const THRESHOLD = 35;          // Score needed to trigger overload
const TICK_MS = 800;           // Monitoring interval
```

If detection feels too sensitive/lenient, adjust these in [demo/adapt.js](./adapt.js) lines 168-175.

## Testing on Demo Page

The demo page is self-contained:
1. Open [demo/index.html](./index.html) in a browser
2. Scroll up/down rapidly multiple times
3. Notice the score badge in the bottom-right corner
4. When score exceeds threshold, Focus Mode activates automatically:
   - Sidebars disappear
   - Main content widens
   - Dense text gains more spacing
   - Ads/promotions hidden

This is a **reference implementation** of how the production system should work.

## Integration Checklist

- [ ] Copy the appropriate parts of `adapt.js`
- [ ] Expose `window.startOverloadMonitor` globally
- [ ] Implement `handleOverloadDetected()` callback
- [ ] Connect to `metricsStore` for logging
- [ ] Hook to `PolicyEngine` for recommendations
- [ ] Test on LMS-style site (Canvas, Blackboard, etc.)
- [ ] Tune sensitivity parameters if needed
- [ ] Remove demo styling (if using Option A copy-paste)

## Expected Behavior

**Normal Browsing**
- Score stays low (< 20)
- Badge shows real-time score and reversal count
- No action taken

**Scroll Thrashing** (rapid up/down)
- Score jumps quickly
- Badge updates frequently
- User sees "thrashing" indicator

**Idle/Pause** (no interaction for 5+ seconds)
- Score increases gradually
- If combined with thrashing → reaches threshold faster

**Threshold Crossed** (score ≥ 35)
- Badge turns red with warning icon
- Callback fires immediately
- Monitoring stops to avoid repeated triggers

## Performance Notes

- Monitoring adds ~0.1ms per 800ms tick
- Event listeners are passive (non-blocking scroll)
- No DOM mutations unless `simplifyDenseText()` called manually
- Memory footprint: ~50KB (mainly the Map of original text)

## Next Steps for Dev 2

1. **Integrate** this into content script
2. **Connect** to policy engine's `recommender` module
3. **Log** metrics to `metricsStore`
4. **Test** on actual LMS platforms
5. **Refine** thresholds based on user testing

---

**Questions?** Reference [src/content/signals/interaction_logger.ts](../src/content/signals/interaction_logger.ts) for similar event tracking patterns in the codebase.
