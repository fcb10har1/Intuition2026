/**
 * Accessibility Layer - Content Script (Complete Rewrite)
 * Professional, minimal, functional UI injected into webpages
 */

(() => {
  // Prevent double injection
  if (window.__COGNI_FOCUS_INIT__) return;
  window.__COGNI_FOCUS_INIT__ = true;

  const HTML = document.documentElement;
  const STYLE_ID = "cogni-focus-style";
  const TOAST_ID = "cogni-focus-toast";

  const DEFAULT_LEVEL = "med";

  // Detailed interaction tracking for real-time AI recommendations
  const monitorState = {
    // Extension control
    extensionEnabled: false,
    
    // Basic cognitive load metrics
    score: 0,
    scrollReversals: 0,
    idlePeriods: 0,
    
    // Timing & scroll tracking
    lastActionT: performance.now(),
    lastScrollY: window.scrollY,
    lastDir: 0,
    reversalTimes: [],
    lastAIAdjustT: 0,
    
    // Detailed interaction patterns
    clickCount: 0,
    backspaceCount: 0,
    mistypingPattern: [],
    zoomLevel: window.devicePixelRatio || 1,
    scrollJitterEvents: [],
    rageClickTimes: [],
    keyboardEvents: 0,
    mouseEvents: 0,
    timeToClick: [],
    focusShifts: 0,
    
    // Device hints detection
    usesKeyboardOnly: false,
    usesScreenReader: false,
    prefersReducedMotion: false,
    systemFontScale: 1.0,
    windowWidth: window.innerWidth,
    
    aiClient: window.__aiClient
  };

  function normalizeLevel(level) {
    if (level === "mild" || level === "med" || level === "strong") {
      return level;
    }
    return DEFAULT_LEVEL;
  }

  function injectCssOnce() {
    if (document.getElementById(STYLE_ID)) return;

    const link = document.createElement("link");
    link.id = STYLE_ID;
    link.rel = "stylesheet";
    link.type = "text/css";

    link.href = chrome.runtime.getURL(
      "src/content/adapt/css/focus_mode.css"
    );

    (document.head || document.documentElement).appendChild(link);
  }

  function setFocusEnabled(enabled) {
    HTML.dataset.cogFocus = enabled ? "on" : "off";
  }

  function setLevel(level) {
    HTML.dataset.cogLevel = level;
  }

  function showToast(text) {
    let toast = document.getElementById(TOAST_ID);

    if (!toast) {
      toast = document.createElement("div");
      toast.id = TOAST_ID;

      toast.style.position = "fixed";
      toast.style.right = "16px";
      toast.style.bottom = "16px";
      toast.style.zIndex = "2147483647";
      toast.style.maxWidth = "280px";
      toast.style.padding = "10px 12px";
      toast.style.borderRadius = "12px";
      toast.style.fontFamily =
        "system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif";
      toast.style.fontSize = "13px";
      toast.style.lineHeight = "1.2";
      toast.style.background = "rgba(20, 20, 20, 0.92)";
      toast.style.color = "#fff";
      toast.style.boxShadow = "0 8px 20px rgba(0,0,0,0.25)";
      toast.style.backdropFilter = "blur(8px)";
      toast.style.border = "1px solid rgba(255,255,255,0.12)";
      toast.style.opacity = "0";
      toast.style.transition = "opacity 120ms ease";

      document.documentElement.appendChild(toast);
    }

    toast.textContent = text;
    toast.style.opacity = "1";

    if (toast.__hideTimer) clearTimeout(toast.__hideTimer);
    toast.__hideTimer = setTimeout(() => {
      toast.style.opacity = "0";
    }, 1800);
  }

  function apply(enabled, level, announce = true) {
    injectCssOnce();
    setFocusEnabled(enabled);
    setLevel(level);

    if (announce) {
      if (enabled) showToast(`Focus Mode: ON (${level})`);
      else showToast("Focus Mode: OFF");
    }
  }

  async function loadInitialStateFromStorage() {
    try {
      const res = await chrome.storage.sync.get([
        "focusEnabled",
        "intensityLevel",
        "onboardingResponses"
      ]);

      const enabled =
        typeof res.focusEnabled === "boolean" ? res.focusEnabled : false;

      const level = normalizeLevel(res.intensityLevel);

      // Set extension enabled flag
      monitorState.extensionEnabled = enabled;

      apply(enabled, level, false);

      // If questionnaire completed, get AI recommendations
      if (res.onboardingResponses && monitorState.aiClient) {
        // Prepare comprehensive interaction data
        const interactions = {
          // Basic metrics
          scrollReversals: monitorState.scrollReversals,
          idlePeriods: monitorState.idlePeriods,
          overloadScore: monitorState.score,
          
          // Detailed patterns
          clickCount: monitorState.clickCount,
          backspaceCount: monitorState.backspaceCount,
          keyboardEvents: monitorState.keyboardEvents,
          mouseEvents: monitorState.mouseEvents,
          rageClickTimes: monitorState.rageClickTimes,
          scrollJitterEvents: monitorState.scrollJitterEvents,
          focusShifts: monitorState.focusShifts,
          
          // Device hints
          usesKeyboardOnly: monitorState.usesKeyboardOnly,
          usesScreenReader: monitorState.usesScreenReader,
          prefersReducedMotion: monitorState.prefersReducedMotion,
          systemFontScale: monitorState.systemFontScale,
          zoomLevel: monitorState.zoomLevel
        };
        
        const recommendations = await monitorState.aiClient.getAIRecommendations(
          res.onboardingResponses,
          interactions
        );
        if (recommendations) {
          applyAIRecommendations(recommendations);
        }
      }
    } catch {
      apply(false, DEFAULT_LEVEL, false);
    }
  }

  function applyAIRecommendations(recs) {
    try {
      if (!recs) return;

      const source = recs.source || "unknown";
      const focusLevel = normalizeLevel(recs.focus_level || DEFAULT_LEVEL);
      const shouldEnable = recs.focus_mode || recs.reduce_distractions;

      // Track what's being applied for transparency
      const appliedChanges = [];
      const reasons = [];

      // Determine primary reason from patterns
      let primaryReason = "Optimizing your experience";
      if (recs.detectedPatterns && recs.detectedPatterns.length > 0) {
        const topPattern = recs.detectedPatterns.find(p => p.severity === 'high');
        if (topPattern) {
          primaryReason = topPattern.description;
        } else {
          primaryReason = recs.detectedPatterns[0].description;
        }
      }

      // ===== FOCUS MODE =====
      if (shouldEnable) {
        apply(true, focusLevel, true);
        appliedChanges.push(`Focus Mode (${focusLevel})`);
        
        let reason = "Clutter & visual overload detected → Simplified interface";
        if (recs.detectedPatterns) {
          const thrashPattern = recs.detectedPatterns.find(p => p.pattern === 'Scroll Thrashing');
          const overloadPattern = recs.detectedPatterns.find(p => p.pattern === 'Cognitive Overload');
          if (thrashPattern) reason = `${thrashPattern.description} → Simplifying layout`;
          else if (overloadPattern) reason = `${overloadPattern.description} → Focusing interface`;
        }
        reasons.push(reason);
        logChange("FOCUS_MODE", focusLevel, "Reduces distractions");
      }

      // ===== READING EASE =====
      if (recs.reading_ease) {
        HTML.classList.add("assist-reading-ease");
        appliedChanges.push("Reading Ease");
        
        let reason = "Dense text difficulty detected → Improved spacing & typography";
        if (recs.detectedPatterns) {
          const pausePattern = recs.detectedPatterns.find(p => p.pattern === 'Paused/Stuck');
          if (pausePattern) reason = `${pausePattern.description} → Enhancing readability`;
        }
        reasons.push(reason);
        logChange("READING_EASE", "enabled", "Larger fonts, better line-height");
      }

      // ===== REDUCE DISTRACTIONS =====
      if (recs.reduce_distractions) {
        HTML.classList.add("assist-reduce-distractions");
        appliedChanges.push("Reduce Distractions");
        
        let reason = "Motion sensitivity or distraction patterns → Hides ads & animated elements";
        if (recs.detectedPatterns) {
          const jitterPattern = recs.detectedPatterns.find(p => p.pattern === 'Scroll Jitter');
          if (jitterPattern) reason = `${jitterPattern.description} → Removing motion triggers`;
        }
        reasons.push(reason);
        logChange("REDUCE_DISTRACTIONS", "enabled", "Ads, popups, animations hidden");
      }

    // ===== STEP BY STEP =====
    if (recs.step_by_step) {
      HTML.classList.add("assist-step-by-step");
      appliedChanges.push("Step-by-Step Guidance");
      
      let reason = "Preference for structured guidance → Highlights primary actions";
      if (recs.detectedPatterns) {
        const rageClickPattern = recs.detectedPatterns.find(p => p.pattern === 'Rapid Clicking');
        if (rageClickPattern) reason = `${rageClickPattern.description} → Breaking tasks into steps`;
      }
      reasons.push(reason);
      logChange("STEP_BY_STEP", "enabled", "Forms & actions simplified");
    }

    // ===== TIME CONTROL =====
    if (recs.time_control) {
      HTML.classList.add("assist-time-control");
      appliedChanges.push("Time Control");
      reasons.push("Time management preference → Session timer displayed");
      logChange("TIME_CONTROL", "enabled", "Progress & time tracking shown");
    }

    // ===== ERROR SUPPORT =====
    if (recs.error_support) {
      HTML.classList.add("assist-error-support");
      appliedChanges.push("Error Support");
      
      let reason = "Error handling preference → Errors highlighted clearly";
      if (recs.detectedPatterns) {
        const correctionPattern = recs.detectedPatterns.find(p => p.pattern === 'Many Corrections');
        if (correctionPattern) reason = `${correctionPattern.description} → Making errors more visible`;
      }
      reasons.push(reason);
      logChange("ERROR_SUPPORT", "enabled", "Errors emphasized");
    }

    // Show comprehensive summary with pattern details
    showDetailedChanges(appliedChanges, reasons, source, primaryReason, recs.detectedPatterns);

    // Log for debugging
    const sourceLabel = source === "ai" ? "🤖 AI Model" : "📋 Smart Defaults";
    console.log(
      `%c[${sourceLabel}] Applied ${appliedChanges.length} adaptation(s)`,
      'color: #2563eb; font-weight: bold; background: #dbeafe; padding: 4px 8px; border-radius: 4px;'
    );
    for (const reason of reasons) {
      console.log(`  → ${reason}`);
    }
    } catch (error) {
      console.error("[Content] Error in applyAIRecommendations:", error.message);
    }
  }

  function logChange(adaptationName, value, explanation) {
    const emoji = {
      'FOCUS_MODE': '📌',
      'READING_EASE': '📖',
      'REDUCE_DISTRACTIONS': '🎯',
      'STEP_BY_STEP': '📋',
      'TIME_CONTROL': '⏱️',
    }[adaptationName] || '✨';

    console.log(
      `%c${emoji} ${adaptationName}%c = ${value}\n    ${explanation}`,
      'color: #047857; font-weight: 600;',
      'color: #666; font-weight: normal;'
    );
  }

  function showDetailedChanges(changes, reasons, source, primaryReason, patterns) {
    if (changes.length === 0) return;

    // Create detailed notification
    const notification = document.createElement('div');
    notification.id = 'cogni-detailed-changes';
    notification.style.cssText = `
      position: fixed;
      left: 16px;
      bottom: 16px;
      z-index: 999998;
      background: linear-gradient(135deg, #dbeafe 0%, #e0e7ff 100%);
      border: 1px solid #3b82f6;
      border-radius: 12px;
      padding: 12px 14px;
      max-width: 360px;
      font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
      animation: slideUpNotif 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
    `;

    const sourceEmoji = source === "ai" ? "🤖" : "📋";
    const sourceText = source === "ai" ? "AI adapted" : "Smart defaults applied";

    let html = `
      <div style="color: #1e40af; font-weight: 600; margin-bottom: 4px; font-size: 13px;">
        ${sourceEmoji} ${sourceText}
      </div>
    `;

    // Add primary reason
    if (primaryReason) {
      html += `
        <div style="
          color: #1f2937;
          font-size: 11px;
          margin-bottom: 8px;
          padding: 0 4px;
          font-style: italic;
        ">
          <strong>Why:</strong> ${primaryReason}
        </div>
      `;
    }

    // Add changes with reasons
    changes.forEach((change, idx) => {
      const reason = reasons[idx] || "";
      html += `
        <div style="
          margin: 6px 0;
          padding: 6px 8px;
          background: rgba(255,255,255,0.6);
          border-radius: 6px;
          font-size: 12px;
          color: #1f2937;
          border-left: 3px solid #3b82f6;
        ">
          <div style="font-weight: 500;">${change}</div>
          <div style="color: #666; font-size: 11px; margin-top: 2px;">${reason}</div>
        </div>
      `;
    });

    // Add collapsible pattern details
    if (patterns && patterns.length > 0) {
      html += `
        <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid rgba(59, 130, 246, 0.2);">
          <details style="cursor: pointer; outline: none;">
            <summary style="
              font-size: 10px;
              color: #3b82f6;
              font-weight: 600;
              text-transform: uppercase;
              letter-spacing: 0.5px;
              user-select: none;
            ">
              📊 Detection Details (${patterns.length})
            </summary>
            <div style="margin-top: 6px; padding-top: 6px; border-top: 1px solid rgba(59, 130, 246, 0.1);">
      `;

      patterns.forEach(p => {
        let severityColor = '#6b7280'; // gray for info
        if (p.severity === 'high') severityColor = '#dc2626'; // red
        else if (p.severity === 'medium') severityColor = '#f59e0b'; // amber

        html += `
          <div style="
            margin: 4px 0;
            padding: 4px 6px;
            background: rgba(255,255,255,0.4);
            border-left: 2px solid ${severityColor};
            border-radius: 3px;
            font-size: 10px;
            color: #1f2937;
          ">
            <span style="font-weight: 600; color: ${severityColor};">${p.icon} ${p.pattern}</span>
            <div style="color: #666; margin-top: 1px;">${p.description}</div>
          </div>
        `;
      });

      html += `
            </div>
          </details>
        </div>
      `;
    }

    html += `
      <div style="
        margin-top: 8px;
        font-size: 10px;
        color: #3b82f6;
        text-align: center;
        cursor: pointer;
        text-decoration: underline;
      " onclick="document.getElementById('cogni-detailed-changes').remove();">
        Dismiss
      </div>
    `;

    notification.innerHTML = html;
    document.documentElement.appendChild(notification);

    // Add animation styles if not present
    if (!document.getElementById('cogni-change-animations')) {
      const style = document.createElement('style');
      style.id = 'cogni-change-animations';
      style.textContent = `
        @keyframes slideUpNotif {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `;
      document.head.appendChild(style);
    }

    // Auto-dismiss after 6 seconds
    setTimeout(() => {
      const elem = document.getElementById('cogni-detailed-changes');
      if (elem) {
        elem.style.animation = 'slideUpNotif 0.3s ease-out reverse';
        setTimeout(() => elem.remove(), 300);
      }
    }, 6000);
  }

  function recordAction() {
    monitorState.lastActionT = performance.now();
  }
  
  function detectDeviceHints() {
    // Detect keyboard-only usage (no mouse/touch events for X seconds)
    if (monitorState.mouseEvents === 0 && monitorState.keyboardEvents > 5) {
      monitorState.usesKeyboardOnly = true;
    }
    
    // Detect screen reader via common ARIA attributes
    const hasAriaLive = document.querySelector('[aria-live]');
    const hasAriaLabel = document.querySelectorAll('[aria-label]').length > 5;
    if (hasAriaLive || hasAriaLabel) {
      monitorState.usesScreenReader = true;
    }
    
    // Detect reduced motion preference
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      monitorState.prefersReducedMotion = true;
    }
    
    // Detect system font scaling
    const htmlFontSize = parseInt(window.getComputedStyle(document.documentElement).fontSize);
    monitorState.systemFontScale = htmlFontSize / 16; // 16px is default
    
    // Detect zoom level (device pixel ratio may indicate user zoom)
    monitorState.zoomLevel = window.devicePixelRatio || 1;
  }
  
  function analyzeClickPatterns(deltaTime) {
    // Detect rage clicks: 3+ clicks in quick succession (< 500ms apart)
    const recentRageClicks = monitorState.rageClickTimes.filter(
      t => deltaTime - t < 2000
    );
    if (recentRageClicks.length > 0) {
      monitorState.score += Math.min(5, recentRageClicks.length);
    }
    monitorState.rageClickTimes = recentRageClicks;
  }
  
  function analyzeScrollJitter() {
    // Filter scroll jitter events from last 2 seconds
    const now = performance.now();
    monitorState.scrollJitterEvents = monitorState.scrollJitterEvents.filter(
      t => now - t < 2000
    );
    
    // If many small scroll events, it's jittery (sign of lack of control)
    if (monitorState.scrollJitterEvents.length > 4) {
      monitorState.score += 3;
    }
  }
  
  function analyzeMistypingPattern() {
    // Keep last 20 backspace events
    if (monitorState.mistypingPattern.length > 20) {
      monitorState.mistypingPattern.shift();
    }
    
    // High backspace rate = typing errors/uncertainty
    const backspaceRatio = monitorState.backspaceCount / (monitorState.keyboardEvents || 1);
    if (backspaceRatio > 0.15) { // > 15% backspaces = high error rate
      monitorState.score += 8;
    }
  }

  function onScroll() {
    const y = window.scrollY;
    const dy = y - monitorState.lastScrollY;
    const dir = dy === 0 ? 0 : (dy > 0 ? 1 : -1);

    if (dir !== 0 && monitorState.lastDir !== 0 && dir !== monitorState.lastDir) {
      monitorState.reversalTimes.push(performance.now());
      monitorState.scrollReversals++;
    }
    
    // Track scroll jitter (small scroll movements)
    if (Math.abs(dy) < 50 && dy !== 0) {
      monitorState.scrollJitterEvents.push(performance.now());
    }

    monitorState.lastDir = dir;
    monitorState.lastScrollY = y;
    recordAction();
  }

  async function maybeRefreshAIRecommendations() {
    const now = performance.now();
    // Only run if extension is enabled
    if (!monitorState.extensionEnabled || !monitorState.aiClient || now - monitorState.lastAIAdjustT < 8000) return;

    try {
      const res = await chrome.storage.sync.get(["onboardingResponses"]);
      if (!res.onboardingResponses) return;

      // Prepare comprehensive interaction data
      const interactions = {
        // Basic metrics
        scrollReversals: monitorState.scrollReversals,
        idlePeriods: monitorState.idlePeriods,
        overloadScore: monitorState.score,
        
        // Detailed patterns
        clickCount: monitorState.clickCount,
        backspaceCount: monitorState.backspaceCount,
        keyboardEvents: monitorState.keyboardEvents,
        mouseEvents: monitorState.mouseEvents,
        rageClickTimes: monitorState.rageClickTimes,
        scrollJitterEvents: monitorState.scrollJitterEvents,
        focusShifts: monitorState.focusShifts,
        
        // Device hints
        usesKeyboardOnly: monitorState.usesKeyboardOnly,
        usesScreenReader: monitorState.usesScreenReader,
        prefersReducedMotion: monitorState.prefersReducedMotion,
        systemFontScale: monitorState.systemFontScale,
        zoomLevel: monitorState.zoomLevel
      };

      // Analyze patterns for transparency
      const patterns = analyzePatterns(interactions);

      console.log(
        "%c[🔍 Real-time Analysis]",
        'color: #7c3aed; font-weight: bold; background: #ede9fe; padding: 4px 8px; border-radius: 4px;'
      );
      
      if (patterns.length > 0) {
        patterns.forEach(p => {
          console.log(`  → ${p.icon} ${p.pattern}: ${p.description}`);
        });
      }

      const recommendations = await monitorState.aiClient.getAIRecommendations(
        res.onboardingResponses,
        interactions
      );

      if (recommendations) {
        // Pass pattern info for more detailed explanations
        recommendations.detectedPatterns = patterns;
        applyAIRecommendations(recommendations);
        monitorState.lastAIAdjustT = now;
      }
    } catch (e) {
      console.warn("[Content] Failed to refresh recommendations:", e.message);
    }
  }

  function analyzePatterns(interactions) {
    const patterns = [];

    // Scroll thrashing
    if (interactions.scrollReversals >= 3) {
      patterns.push({
        icon: '🔄',
        pattern: 'Scroll Thrashing',
        description: `${interactions.scrollReversals} rapid direction changes detected — you're searching for content`,
        severity: 'high'
      });
    }

    // Idle/stuck
    if (interactions.idlePeriods >= 2) {
      patterns.push({
        icon: '⏸️',
        pattern: 'Paused/Stuck',
        description: `${interactions.idlePeriods} pause periods detected — you may be overwhelmed`,
        severity: 'high'
      });
    }

    // Overload score high
    if (interactions.overloadScore >= 30) {
      patterns.push({
        icon: '⚠️',
        pattern: 'Cognitive Overload',
        description: `Score: ${interactions.overloadScore}/100 — interface complexity detected`,
        severity: 'high'
      });
    }

    // Rage clicking
    if (interactions.rageClickTimes.length >= 3) {
      patterns.push({
        icon: '🖱️',
        pattern: 'Rapid Clicking',
        description: `${interactions.rageClickTimes.length} rapid clicks — possible frustration`,
        severity: 'medium'
      });
    }

    // Scroll jitter
    if (interactions.scrollJitterEvents.length >= 5) {
      patterns.push({
        icon: '📊',
        pattern: 'Scroll Jitter',
        description: `${interactions.scrollJitterEvents.length} erratic scroll events — motor coordination issues?`,
        severity: 'medium'
      });
    }

    // Keyboard-only
    if (interactions.usesKeyboardOnly) {
      patterns.push({
        icon: '⌨️',
        pattern: 'Keyboard Navigation',
        description: 'No mouse detected — keyboard-only user detected',
        severity: 'info'
      });
    }

    // Screen reader
    if (interactions.usesScreenReader) {
      patterns.push({
        icon: '🔊',
        pattern: 'Screen Reader',
        description: 'Screen reader activity detected',
        severity: 'info'
      });
    }

    // Reduced motion preference
    if (interactions.prefersReducedMotion) {
      patterns.push({
        icon: '🎬',
        pattern: 'Reduced Motion',
        description: 'System prefers reduced motion — animations disabled',
        severity: 'info'
      });
    }

    // Backspace/corrections
    if (interactions.backspaceCount >= 5) {
      patterns.push({
        icon: '⌫',
        pattern: 'Many Corrections',
        description: `${interactions.backspaceCount} backspaces — frequent typos or input errors`,
        severity: 'medium'
      });
    }

    return patterns;
  }

  function startInteractionMonitoring() {
    const WINDOW_MS = 6000;
    const REVERSAL_CLUSTER = 3;
    const REVERSAL_POINTS = 18;
    const IDLE_MS = 5000;
    const IDLE_POINTS = 12;
    const DECAY = 4;
    const TICK_MS = 800;

    window.addEventListener("scroll", onScroll, { passive: true });
    
    // Enhanced click tracking
    window.addEventListener("click", (e) => {
      monitorState.clickCount++;
      monitorState.mouseEvents++;
      monitorState.rageClickTimes.push(performance.now());
      recordAction();
    }, true);
    
    // Enhanced keyboard tracking
    window.addEventListener("keydown", (e) => {
      monitorState.keyboardEvents++;
      if (e.key === "Backspace") {
        monitorState.backspaceCount++;
        monitorState.mistypingPattern.push(performance.now());
      }
      recordAction();
    }, true);
    
    window.addEventListener("input", recordAction, true);
    
    // Track focus shifts (tab navigation)
    document.addEventListener("focusin", () => {
      monitorState.focusShifts++;
      recordAction();
    }, true);
    
    // Detect device hints on page load
    detectDeviceHints();

    setInterval(async () => {
      try {
        const t = performance.now();

        monitorState.reversalTimes = monitorState.reversalTimes.filter((rt) => t - rt <= WINDOW_MS);

        if (monitorState.reversalTimes.length >= REVERSAL_CLUSTER) {
          monitorState.score += REVERSAL_POINTS;
          monitorState.reversalTimes.splice(0, Math.min(2, monitorState.reversalTimes.length));
        }

        const idleFor = t - monitorState.lastActionT;
        if (idleFor >= IDLE_MS) {
          monitorState.score += IDLE_POINTS;
          monitorState.idlePeriods++;
          monitorState.lastActionT = t - 2500;
        }

        // Analyze detailed interaction patterns with safe error handling
        try {
          analyzeClickPatterns(t);
        } catch (e) {
          console.warn("[Content] Error in analyzeClickPatterns:", e.message);
        }
        
        try {
          analyzeScrollJitter();
        } catch (e) {
          console.warn("[Content] Error in analyzeScrollJitter:", e.message);
        }
        
        try {
          analyzeMistypingPattern();
        } catch (e) {
          console.warn("[Content] Error in analyzeMistypingPattern:", e.message);
        }
        
        try {
          detectDeviceHints(); // Re-check every tick
        } catch (e) {
          console.warn("[Content] Error in detectDeviceHints:", e.message);
        }

        monitorState.score = Math.max(0, monitorState.score - DECAY);

        // Periodically refresh AI recommendations based on new interaction data
        await maybeRefreshAIRecommendations();
      } catch (error) {
        console.error("[Content] Monitoring loop error:", error.message);
        // Loop continues running despite errors
      }
    }, TICK_MS);
  }

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    try {
      if (!msg) return;

      // Handle action-based messages (for service worker)
      if (msg.action === "getAIStatus") {
        const aiStatus = window.__aiClient?.getAIStatus?.() || "unknown";
        sendResponse({ status: aiStatus });
        return true;
      }

      // Handle legacy type-based messages (for popup)
      if (typeof msg.type !== "string") return;

      if (msg.type === "TOGGLE_FOCUS") {
        const enabled = !!msg.enabled;
        const currentLevel = normalizeLevel(HTML.dataset.cogLevel);

        // Update extension state and persist to storage
        monitorState.extensionEnabled = enabled;
        chrome.storage.sync.set({ focusEnabled: enabled });

        apply(enabled, currentLevel, true);

        if (sendResponse) sendResponse({ ok: true });
        return true;
      }

      if (msg.type === "SET_INTENSITY") {
        const level = normalizeLevel(msg.level);
        const enabled = HTML.dataset.cogFocus === "on";

        apply(enabled, level, true);

        if (sendResponse) sendResponse({ ok: true });
        return true;
      }
    } catch (error) {
      console.error("[Content] Error handling message:", error.message);
      if (sendResponse) sendResponse({ error: error.message });
    }
  });

  loadInitialStateFromStorage().catch(e => {
    console.error("[Content] Failed to load initial state:", e.message);
    // Extension still starts even if initial load fails
  });
  startInteractionMonitoring();
})();
