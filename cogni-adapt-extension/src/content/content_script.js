/**
 * Dev 2 – Content Script (JS version)
 * Chrome loads THIS file
 */

(() => {
  // Prevent double injection
  if (window.__COGNI_FOCUS_INIT__) return;
  window.__COGNI_FOCUS_INIT__ = true;

  const HTML = document.documentElement;
  const STYLE_ID = "cogni-focus-style";
  const TOAST_ID = "cogni-focus-toast";

  const DEFAULT_LEVEL = "med";

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
      ]);

      const enabled =
        typeof res.focusEnabled === "boolean" ? res.focusEnabled : false;

      const level = normalizeLevel(res.intensityLevel);

      apply(enabled, level, false);
    } catch {
      apply(false, DEFAULT_LEVEL, false);
    }
  }

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (!msg || typeof msg.type !== "string") return;

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
})();
