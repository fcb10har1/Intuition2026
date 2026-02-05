/**
 * DEV 2 INTEGRATION TEMPLATE
 * 
 * Copy & adapt this into your content_script.ts
 * This shows how to wire up the overload detection from Dev 3
 */

import { metricsStore } from '../background/telemetry/metrics_store';
import { policyEngine } from '../background/policy_engine/policy_engine';

// ============ STEP 1: Initialize Overload Monitoring ============

let overloadMonitorStop: (() => void) | null = null;

export function initOverloadDetection() {
  // Call the function exposed by adapt.js
  if (typeof (window as any).startOverloadMonitor !== 'function') {
    console.warn('[Dev3] startOverloadMonitor not found - ensure adapt.js is loaded');
    return;
  }

  overloadMonitorStop = (window as any).startOverloadMonitor(() => {
    handleOverloadDetected();
  });

  console.log('[Dev3] Overload monitoring initialized');
}

// ============ STEP 2: Handle Overload Detection ============

function handleOverloadDetected() {
  // 1. Log the event
  metricsStore.recordInteraction({
    type: 'overload_detected',
    domain: window.location.hostname,
    timestamp: Date.now(),
    source: 'content_script',
  });

  // 2. Get user adaptation profile
  const profile = chrome.storage.sync.get('adaptationProfile', (data) => {
    console.log('[Dev3] User profile:', data);

    // 3. Query policy engine for recommendations
    const recommendations = policyEngine.recommend({
      userBehavior: 'overload_detected',
      currentAssists: getCurrentActiveAssists(),
      userPreferences: data.adaptationProfile || {},
    });

    console.log('[Dev3] Policy engine recommends:', recommendations);

    // 4. Apply recommended adaptations
    applyAdaptations(recommendations);

    // 5. Show user feedback
    showOverloadNotification();
  });
}

// ============ STEP 3: Apply Adaptations ============

function applyAdaptations(recommendations: any) {
  // Apply focus mode
  if (recommendations.focusMode) {
    enableFocusMode();
  }

  // Apply step-by-step guidance
  if (recommendations.stepByStep) {
    enableStepByStep();
  }

  // Simplify dense text
  if (recommendations.readingEase) {
    simplifyText();
  }

  // Reduce visual distractions
  if (recommendations.reduceDistractions) {
    reduceDistractions();
  }

  // Enable time control
  if (recommendations.timeControl) {
    enableTimeControl();
  }

  // Log what was actually applied
  metricsStore.recordInteraction({
    type: 'adaptations_applied',
    adaptations: Object.keys(recommendations).filter(k => recommendations[k]),
    timestamp: Date.now(),
  });
}

// ============ STEP 4: Individual Adaptation Activators ============

function enableFocusMode() {
  // Set CSS class that was already in focus_mode.css
  document.documentElement.dataset.cogFocus = 'true';
  
  // OR use the assist module:
  // import { applyFocusGuide } from './adapt/assists/focus_guide';
  // applyFocusGuide();

  console.log('[Dev3] Focus Mode enabled');
}

function enableStepByStep() {
  // import { applyStepByStep } from './adapt/assists/step_by_step';
  // applyStepByStep();
  console.log('[Dev3] Step-by-Step enabled');
}

function simplifyText() {
  // Call the simplify function from adapt.js if available
  if (typeof (window as any).simplifyDenseText === 'function') {
    (window as any).simplifyDenseText();
  }
  console.log('[Dev3] Text simplification triggered');
}

function reduceDistractions() {
  // import { applyReduceDistractions } from './adapt/assists/reduce_distractions';
  // applyReduceDistractions();
  console.log('[Dev3] Reduce Distractions enabled');
}

function enableTimeControl() {
  // import { applyTimeControl } from './adapt/assists/time_control';
  // applyTimeControl();
  console.log('[Dev3] Time Control enabled');
}

// ============ STEP 5: User Feedback ============

function showOverloadNotification() {
  // Import banner module or create simple toast
  // import { showBanner } from './ui/banner';
  // showBanner({
  //   type: 'info',
  //   title: 'Cognitive Overload Detected',
  //   message: 'We\'ve simplified this page for you',
  //   duration: 5000,
  // });

  // Simple fallback
  const notification = document.createElement('div');
  notification.style.cssText = `
    position: fixed; 
    bottom: 80px; 
    left: 50%; 
    transform: translateX(-50%);
    z-index: 99999;
    background: #2563eb;
    color: #fff;
    padding: 12px 16px;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    font-size: 14px;
    animation: slideUp 0.3s ease;
  `;
  notification.textContent = '⚡ Overload detected - simplified view enabled';

  document.body.appendChild(notification);
  setTimeout(() => notification.remove(), 5000);
}

// ============ STEP 6: Cleanup ============

export function stopOverloadDetection() {
  if (overloadMonitorStop) {
    overloadMonitorStop();
    overloadMonitorStop = null;
    console.log('[Dev3] Overload monitoring stopped');
  }
}

// Call on page unload
window.addEventListener('beforeunload', () => {
  stopOverloadDetection();
});

// ============ STEP 7: Helper Functions ============

function getCurrentActiveAssists(): string[] {
  // Return list of currently active assists
  const assists: string[] = [];
  if (document.documentElement.dataset.cogFocus) assists.push('focus_mode');
  if (document.body.classList.contains('assist-reading-ease')) assists.push('reading_ease');
  if (document.body.classList.contains('assist-step-by-step')) assists.push('step_by_step');
  return assists;
}

// ============ USAGE IN CONTENT SCRIPT ============
/**
 * In your main content_script.ts:
 * 
 * import { initOverloadDetection, stopOverloadDetection } from './overload_monitor';
 * 
 * // Initialize after DOM is ready
 * document.addEventListener('DOMContentLoaded', () => {
 *   initOverloadDetection();
 * });
 * 
 * // Cleanup on unload
 * window.addEventListener('beforeunload', () => {
 *   stopOverloadDetection();
 * });
 */

export { initOverloadDetection, stopOverloadDetection };
