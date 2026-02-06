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

  // Interaction tracking for AI context
  const monitorState = {
    score: 0,
    scrollReversals: 0,
    idlePeriods: 0,
    lastActionT: performance.now(),
    lastScrollY: window.scrollY,
    lastDir: 0,
    reversalTimes: [],
    lastAIAdjustT: 0,
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

      apply(enabled, level, false);

      // If questionnaire completed, get AI recommendations
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
    } catch {
      apply(false, DEFAULT_LEVEL, false);
    }
  }

  function applyAIRecommendations(recs) {
    if (!recs) return;

    const source = recs.source || "unknown";
    const focusLevel = normalizeLevel(recs.focus_level || DEFAULT_LEVEL);
    const shouldEnable = recs.focus_mode || recs.reduce_distractions;

    if (shouldEnable) {
      apply(true, focusLevel, true);
    }

    if (recs.reading_ease) {
      HTML.classList.add("assist-reading-ease");
    }
    if (recs.reduce_distractions) {
      HTML.classList.add("assist-reduce-distractions");
    }
    if (recs.step_by_step) {
      HTML.classList.add("assist-step-by-step");
    }
    if (recs.time_control) {
      HTML.classList.add("assist-time-control");
    }

    const sourceLabel = source === "ai" ? "AI" : "Smart defaults";
    console.log(`[Content] Applied recommendations from ${sourceLabel}`);
    showToast(`✨ ${sourceLabel} adapted your view`);
  }

  function recordAction() {
    monitorState.lastActionT = performance.now();
  }

  function onScroll() {
    const y = window.scrollY;
    const dy = y - monitorState.lastScrollY;
    const dir = dy === 0 ? 0 : (dy > 0 ? 1 : -1);

    if (dir !== 0 && monitorState.lastDir !== 0 && dir !== monitorState.lastDir) {
      monitorState.reversalTimes.push(performance.now());
      monitorState.scrollReversals++;
    }

    monitorState.lastDir = dir;
    monitorState.lastScrollY = y;
    recordAction();
  }

  async function maybeRefreshAIRecommendations() {
    const now = performance.now();
    if (!monitorState.aiClient || now - monitorState.lastAIAdjustT < 8000) return;

    try {
      const res = await chrome.storage.sync.get(["onboardingResponses"]);
      if (!res.onboardingResponses) return;

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
        monitorState.lastAIAdjustT = now;
      }
    } catch (e) {
      console.warn("[Content] Failed to refresh recommendations:", e.message);
    }
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
    window.addEventListener("click", recordAction, true);
    window.addEventListener("keydown", recordAction, true);
    window.addEventListener("input", recordAction, true);

    setInterval(async () => {
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

      monitorState.score = Math.max(0, monitorState.score - DECAY);

      // Periodically refresh AI recommendations based on new interaction data
      await maybeRefreshAIRecommendations();
    }, TICK_MS);
  }

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
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
  });

  loadInitialStateFromStorage();
  startInteractionMonitoring();
})();
