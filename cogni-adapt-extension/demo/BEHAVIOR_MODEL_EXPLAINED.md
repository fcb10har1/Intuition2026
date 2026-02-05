# Behavior Model Deep Dive

## What It Does

The **Behavior Model** learns user preferences over time and remembers them across sessions. It builds a profile of:
- Which adaptations (focuses mode, reading ease, etc.) the user prefers
- Per-domain preferences (Canvas vs Blackboard have different profiles)
- How confident we are in our predictions
- Whether to auto-enable assists next time

---

## Key Concepts

### 1. **Events** - What we track
```typescript
{
  assist: "focus_mode",           // Which adaptation
  action: "applied" | "rejected" | "toggled_off",  // What user did
  domain: "canvas.instructure.com", // Which site
  duration: 300000,               // How long it was enabled (in ms)
  timestamp: 1707000000000,
  context: {
    intensity: "strong",
    pageTitle: "Week 6 Assignment",
  }
}
```

### 2. **Preferences** - What we learn
```typescript
{
  assist: "focus_mode",
  likelihood: 0.85,              // 0-1: probability user wants this
  timesApplied: 5,               // User turned it ON
  timesRejected: 1,              // User turned it OFF
  totalTimeEnabled: 1200000,     // Total time: 20 minutes
  lastUsed: 1707000000000,       // When they last used it
  favoriteIntensity: "strong"    // Their preferred level
}
```

### 3. **Likelihood Score** - How we calculate preference
```
Formula:
  likelihood = (applied - rejected) / (applied + rejected) + time_bonus

Example:
  User: applied focus_mode 5 times, rejected 1 time, kept on for 20 min
  likelihood = (5 - 1) / (5 + 1) + bonus
  likelihood = 0.67 + 0.3 = 0.97 (very high!)

Interpretation:
  > 0.7 = "User loves this"
  0.4-0.7 = "User is neutral"
  < 0.4 = "User doesn't like this"
```

### 4. **Confidence** - How sure are we?
```
Confidence = 0.0  → Brand new, just installed
Confidence = 0.3  → ~15 events tracked
Confidence = 0.6  → ~30 events tracked
Confidence = 1.0  → ~50+ events tracked, very confident

We only auto-enable assists when:
  - Likelihood > 0.6 (user clearly wants it)
  - Confidence >= 0.4 (we have enough data)
```

---

## How It Learning Process Works

### Session 1: Canvas.instructure.com
```
User opens Canvas
→ AI recommends: focus_mode (from onboarding answers)
→ User clicks "ON" → Event recorded:
   { assist: "focus_mode", action: "applied", domain: "canvas..." }
→ User keeps it on for 10 minutes
→ User clicks "OFF" → Event recorded:
   { assist: "focus_mode", action: "toggled_off", duration: 600000 }
→ Profile after Session 1:
   Canvas focus_mode: likelihood = 0.67, totalTime = 10min, timesApplied = 1
   Global focus_mode: likelihood = 0.67, totalTime = 10min, timesApplied = 1
```

### Session 2: Canvas.instructure.com (2 days later)
```
User opens Canvas again
→ Behavior model predicts: "focus_mode likelihood = 0.67"
→ Auto-enable with toast: "✨ AI remembers you liked this"
→ User keeps it on for 15 minutes
→ Profile after Session 2:
   Canvas focus_mode: likelihood = 0.80, totalTime = 25min, timesApplied = 2
   Global focus_mode: likelihood = 0.80, totalTime = 25min, timesApplied = 2
   Confidence: 0.04 (2 events)
```

### Session 3: Blackboard.learn.com (new site)
```
User opens Blackboard (unknown site)
→ No domain-specific profile yet
→ Fall back to global: focus_mode likelihood = 0.80
→ Auto-enable (same preference carries over)
→ User rejects it (clicks OFF immediately)
→ Event recorded:
   { assist: "focus_mode", action: "rejected", domain: "blackboard..." }
→ Profile after Session 3:
   Blackboard focus_mode: likelihood = -1.0 (user rejected), timesRejected = 1
   Canvas focus_mode: still 0.80 (unaffected)
   Global focus_mode: likelihood = 0.60 (mixed signals: 2 applied, 1 rejected)
```

### Session 4-10: Pattern emerges
```
User continues using:
- Canvas: Always keeps focus_mode ON → Canvas likelihood → 0.95
- Blackboard: Always turns focus_mode OFF → Blackboard likelihood → -0.90
- Gmail: Sometimes ON, sometimes OFF → Gmail likelihood → 0.50
- Global: Average of all sites → likelihood → 0.60

After ~5-10 sessions:
- Confidence: 1.0 (50+ events)
- We're very sure about user's preferences
- Auto-enable only on sites where they prefer it (Canvas yes, Blackboard no)
```

---

## Example Usage Flow

### In Content Script (when user toggles focus mode):

```javascript
// User clicks "ON"
async function handleToggleFocusMode() {
  await recordAssistApplied('focus_mode', 'strong');
  apply(true, 'strong', true);
}

// Behind the scenes, behavior model records:
{
  assist: "focus_mode",
  action: "applied",
  domain: "canvas.instructure.com",
  context: { intensity: "strong", pageTitle: "Week 6" },
  timestamp: 1707000000000
}

// When user clicks "OFF" after 10 minutes:
await recordAssistToggled('focus_mode', false);

// Behavior model records:
{
  assist: "focus_mode",
  action: "toggled_off",
  domain: "canvas.instructure.com",
  duration: 600000,  // 10 minutes
  timestamp: 1707000600000
}

// Can now predict:
const likelihood = behaviorModel.predictAssistsForDomain('canvas.instructure.com');
// → { focus_mode: 0.85, reading_ease: 0.40, reduce_distractions: 0.20, ... }

// And decide:
if (behaviorModel.shouldAutoEnable('focus_mode', 'canvas.instructure.com')) {
  console.log('Auto-enabling focus_mode - user likes it here!');
  apply(true, 'strong', true);  // Silent, no toast
}
```

---

## Stored Data Structure

```typescript
UserBehaviorProfile = {
  globalPreferences: {
    "focus_mode": { likelihood: 0.8, applied: 5, rejected: 1, ... },
    "reading_ease": { likelihood: 0.5, applied: 2, rejected: 2, ... },
    "reduce_distractions": { likelihood: 0.9, applied: 9, rejected: 0, ... },
    ...
  },
  
  domainProfiles: {
    "canvas.instructure.com": {
      assists: {
        "focus_mode": { likelihood: 0.95, applied: 10, rejected: 0, ... },
        "reduce_distractions": { likelihood: 0.85, ... },
      },
      visitCount: 12,
      lastSeen: 1707000000000,
    },
    
    "blackboard.learn.com": {
      assists: {
        "focus_mode": { likelihood: -0.90, applied: 0, rejected: 9, ... },
        "reading_ease": { likelihood: 0.70, ... },
      },
      visitCount: 8,
      lastSeen: 1706900000000,
    },
  },
  
  learningLevel: 0.95,  // 95% confident in predictions
  lastUpdated: 1707000000000,
}

// Stored in: chrome.storage.local (local to device, not synced)
// Key: "userBehaviorProfile"
```

---

## Privacy Implications

**What the behavior model learns:**
- Which sites you visit (domain names)
- Which accessibility features you prefer
- How long you use each feature
- Your intensity preference (mild/med/strong)

**What it does NOT learn:**
- Page content or URLs (just domain)
- What you type or click
- Form data or passwords
- Search queries

**Where it's stored:**
- `chrome.storage.local` (device only, NOT synced to Google account)
- Not sent to any server
- User can export/backup/delete anytime

**User control:**
```javascript
// User can reset all learning anytime
await resetBehaviorModel();
```

---

## Integration Points

### 1. **During Onboarding**
- Behavior model initializes empty
- Ready to start learning immediately after setup

### 2. **In Content Script**
- Records events when user applies/rejects assists
- Tracks duration of each assist
- Predicts preferences on next visit

### 3. **In Popup**
- Can show user their learned profile
- Can show confidence level
- Can offer "reset learning" button

### 4. **In Policy Engine** (when you build it)
- Query behavior model for predictions
- Merge with AI recommendations
- Only auto-enable when confident

---

## Example Scenarios

### Scenario 1: Consistent User
```
User always enables focus_mode on Canvas
- Session 1: applies, keeps for 30 min
- Session 2: applies, keeps for 25 min
- Session 3: applies, keeps for 28 min
- After Session 3:
  Canvas.focus_mode: likelihood = 1.0
  Auto-enable: YES (with silent apply, no toast)
```

### Scenario 2: Experimental User
```
User tries different assists on Medium.com
- Session 1: tries reading_ease, keeps for 5 min, turns OFF
- Session 2: tries step_by_step, rejects immediately
- Session 3: tries reduce_distractions, keeps for 20 min, keeps ON
- After Session 3:
  Medium.reading_ease: likelihood = -0.5 (rejected)
  Medium.step_by_step: likelihood = -1.0 (rejected immediately)
  Medium.reduce_distractions: likelihood = 0.9 (kept on)
- Next visit: auto-enable reduce_distractions only
```

### Scenario 3: Site-Specific Preference
```
User has different needs on different LMS:
- Canvas: loves focus_mode for lectures (likelihood 0.95)
- Blackboard: hates focus_mode, prefers step_by_step (likelihood -0.8)
- Moodle: neutral on both (likelihood 0.3)
- Local dev site: loves reading_ease (likelihood 0.9)
- Behavior model remembers ALL of these independently
```

---

## Metrics the Model Tracks

Per assist, per domain:
- ✓ Times applied
- ✓ Times rejected  
- ✓ Total duration enabled
- ✓ Last used timestamp
- ✓ Favorite intensity level
- ✓ Calculated likelihood score

Per user (global):
- ✓ Learning confidence level (0-1)
- ✓ Number of domains seen
- ✓ Total events recorded
- ✓ Last updated timestamp

---

## Next Steps

Once behavior model ships, you can:

1. **Add logging** - Track why certain assists are recommended
2. **Add visualization** - Show user their learned profile in popup
3. **Add export** - Let users backup their preferences
4. **Add sync** - Sync preferences across devices (via cloud)
5. **Add A/B testing** - Test if auto-enable improves satisfaction
6. **Add telemetry** - See which assists work best across all users

---

**Summary:** The behavior model turns your extension from "static" to "personalized". After a few uses, each user gets a completely customized experience based on their actual usage patterns.
