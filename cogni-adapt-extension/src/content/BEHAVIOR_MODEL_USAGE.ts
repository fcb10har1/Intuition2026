/**
 * BEHAVIOR MODEL USAGE GUIDE
 * 
 * How to integrate BehaviorModel into your extension
 */

// ============================================================
// STEP 1: IMPORT IN CONTENT SCRIPT
// ============================================================

// Add to src/content/content_script.js:
import { getBehaviorModel, resetBehaviorModel } from '../background/policy_engine/behaviour_model.ts';

let behaviorModel;

async function initBehaviorModel() {
  behaviorModel = await getBehaviorModel();
  console.log('[ContentScript] Behavior model loaded');
  console.log(behaviorModel.getSummary());
}

// Init on load
document.addEventListener('DOMContentLoaded', initBehaviorModel);


// ============================================================
// STEP 2: RECORD EVENTS WHEN USER APPLIES ASSISTS
// ============================================================

async function recordAssistApplied(assistName, intensity) {
  if (!behaviorModel) return;

  behaviorModel.recordEvent({
    assist: assistName,
    action: 'applied',
    domain: window.location.hostname,
    timestamp: Date.now(),
    context: {
      intensity: intensity,
      pageTitle: document.title,
    }
  });

  await behaviorModel.save();
  console.log(`[BehaviorModel] Recorded: ${assistName} applied on ${window.location.hostname}`);
}

// Also record when user REJECTS (toggles off)
async function recordAssistRejected(assistName) {
  if (!behaviorModel) return;

  behaviorModel.recordEvent({
    assist: assistName,
    action: 'rejected',
    domain: window.location.hostname,
    timestamp: Date.now(),
  });

  await behaviorModel.save();
  console.log(`[BehaviorModel] Recorded: ${assistName} rejected on ${window.location.hostname}`);
}

// Track how long user kept an assist enabled
let assistStartTimes = {};

async function recordAssistToggled(assistName, enabled) {
  if (!behaviorModel) return;

  if (enabled) {
    assistStartTimes[assistName] = Date.now();
  } else {
    const duration = Date.now() - (assistStartTimes[assistName] || 0);
    
    behaviorModel.recordEvent({
      assist: assistName,
      action: 'toggled_off',
      domain: window.location.hostname,
      duration: duration,
      timestamp: Date.now(),
    });

    await behaviorModel.save();
    console.log(`[BehaviorModel] ${assistName} was enabled for ${(duration / 1000).toFixed(0)}s`);
  }
}


// ============================================================
// STEP 3: USE PREDICTIONS TO AUTO-ENABLE ASSISTS
// ============================================================

async function applyAIRecommendations(recs) {
  if (!behaviorModel) return;

  // Get predictions based on learned behavior
  const predictions = behaviorModel.predictAssistsForDomain(window.location.hostname);
  const intensity = behaviorModel.predictIntensity(window.location.hostname);

  console.log('[BehaviorModel] Predictions:', predictions);
  console.log('[BehaviorModel] Preferred intensity:', intensity);

  // Merge AI recommendations with learned behavior
  const finalRecs = {
    ...recs,
    focus_level: intensity, // Use learned intensity
  };

  // Only auto-enable if we're confident
  for (const [assist, likelihood] of Object.entries(predictions)) {
    if (behaviorModel.shouldAutoEnable(assist, window.location.hostname)) {
      console.log(`[BehaviorModel] Auto-enabling ${assist} (${(likelihood * 100).toFixed(0)}% confidence)`);
      finalRecs[assist] = true;
    }
  }

  // Apply final recommendations
  applyFinalRecommendations(finalRecs);
}


// ============================================================
// STEP 4: HOOK INTO EXISTING TOGGLE LOGIC
// ============================================================

// Modify existing toggle handler:

async function handleFocusModeToggle(enabled) {
  const level = document.documentElement.dataset.cogLevel || 'med';
  
  // Record the action
  if (enabled) {
    await recordAssistApplied('focus_mode', level);
  } else {
    await recordAssistToggled('focus_mode', false);
  }

  // Apply to page
  apply(enabled, level, true);
}

async function handleIntensityChange(newIntensity) {
  await recordAssistApplied('focus_mode', newIntensity);
  apply(true, newIntensity, true);
}


// ============================================================
// STEP 5: EXPORT BEHAVIOR PROFILE (FOR USER TO INSPECT)
// ============================================================

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === 'getBehaviorProfile') {
    const profile = behaviorModel?.export() || null;
    sendResponse({ profile });
    return true;
  }

  if (msg.action === 'resetBehavior') {
    resetBehaviorModel();
    sendResponse({ ok: true });
    return true;
  }
});


// ============================================================
// WHAT THE BEHAVIOR MODEL LEARNS
// ============================================================

/**
 * Example: After 5 sessions on Canvas, behavior model learns:
 * 
 * Global Preferences:
 *  focus_mode: 75% likelihood (applied 3x, rejected 1x)
 *  reading_ease: 50% likelihood (applied 2x, rejected 2x)
 *  reduce_distractions: 80% likelihood (applied 4x, never rejected)
 *  step_by_step: 10% likelihood (applied 1x, rejected 9x)
 * 
 * Canvas-specific (canvas.instructure.com):
 *  focus_mode: 90% likelihood (applied every time)
 *  intensity preference: "strong"
 *  reduce_distractions: 100% likelihood
 * 
 * When user opens Canvas again:
 *  → Auto-enable focus_mode (90% confidence)
 *  → Use intensity: strong
 *  → Auto-enable reduce_distractions
 *  → Skip step_by_step (user rejected it 9 times)
 */


// ============================================================
// USAGE IN POPUP (SHOW USER THEIR LEARNED PROFILE)
// ============================================================

// In popup.js, add:

async function displayLearnedProfile() {
  try {
    const response = await chrome.tabs.sendMessage(activeTab.id, {
      action: 'getBehaviorProfile'
    });

    const profile = response.profile;
    if (!profile) return;

    const summaryEl = document.getElementById('userProfile');
    if (summaryEl) {
      summaryEl.innerHTML = `
        <div style="font-size: 11px; color: #666; margin-top: 10px;">
          <strong>Learned Profile:</strong><br>
          Learning Level: ${(profile.learningLevel * 100).toFixed(0)}%<br>
          <button onClick="resetProfile()">Reset Learning</button>
        </div>
      `;
    }
  } catch (e) {
    console.warn('Could not get profile:', e);
  }
}


// ============================================================
// EXPORT PROFILE FOR BACKUP (USER PRIVACY)
// ============================================================

// User could export their learned profile for:
// - Backup/restore
// - Use on other devices
// - Privacy audit (see what was learned about them)

function exportProfileAsJSON() {
  const profile = behaviorModel?.export();
  const json = JSON.stringify(profile, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = 'intuition-behavior-profile.json';
  a.click();
}
