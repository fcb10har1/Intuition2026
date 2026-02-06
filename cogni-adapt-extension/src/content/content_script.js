// src/content/content_script.js

const STORAGE_KEY = "cogState";

const BASE_CSS = [
  "src/content/adapt/css/base.css",
  "src/content/adapt/css/orb.css",
  "src/content/adapt/css/focus_overlay.css",
  "src/content/adapt/css/cursor.css"
];

const ASSIST_CSS = {
  focusMode: "src/content/adapt/css/focus_mode.css",
  reduceDistractions: "src/content/adapt/css/reduce_distractions.css",
  readingEase: "src/content/adapt/css/reading_ease.css",
  stepByStep: "src/content/adapt/css/step_by_step.css",
  timeControl: "src/content/adapt/css/time_control.css",
  focusGuide: "src/content/adapt/css/focus_guide.css",
  errorSupport: "src/content/adapt/css/error_support.css",
  darkMode: "src/content/adapt/css/dark_mode.css"
};

const defaultState = {
  enabled: true,
  intensity: 0.6,
  assists: {
    focusMode: true,
    reduceDistractions: false,
    readingEase: true,
    stepByStep: false,
    timeControl: false,
    focusGuide: false,
    errorSupport: false,
    darkMode: false
  }
};

let state = structuredClone(defaultState);

// ---------- helpers ----------
function cssIdFor(path) {
  return `cog-css:${path.replace(/[^\w-]/g, "_")}`;
}

function ensureLink(id, href) {
  if (document.getElementById(id)) return;
  const el = document.createElement("link");
  el.id = id;
  el.rel = "stylesheet";
  el.href = href;
  document.head.appendChild(el);
}

function removeLink(id) {
  const el = document.getElementById(id);
  if (el) el.remove();
}

function setHtmlFlag(name, value) {
  const attr = `data-cog-${name}`;
  if (value) document.documentElement.setAttribute(attr, "1");
  else document.documentElement.removeAttribute(attr);
}

function applyStateToDom() {
  setHtmlFlag("enabled", !!state.enabled);
  document.documentElement.style.setProperty("--cog-intensity", String(state.intensity ?? 0.6));

  setHtmlFlag("focus-mode", !!state.assists.focusMode);
  setHtmlFlag("reduce-distractions", !!state.assists.reduceDistractions);
  setHtmlFlag("reading-ease", !!state.assists.readingEase);
  setHtmlFlag("step-by-step", !!state.assists.stepByStep);
  setHtmlFlag("time-control", !!state.assists.timeControl);
  setHtmlFlag("focus-guide", !!state.assists.focusGuide);
  setHtmlFlag("error-support", !!state.assists.errorSupport);
  setHtmlFlag("dark-mode", !!state.assists.darkMode);

  // CSS injection (must be in web_accessible_resources)
  if (state.enabled) {
    for (const p of BASE_CSS) ensureLink(cssIdFor(p), chrome.runtime.getURL(p));
  } else {
    for (const p of BASE_CSS) removeLink(cssIdFor(p));
  }

  for (const [assist, path] of Object.entries(ASSIST_CSS)) {
    const on = !!state.enabled && !!state.assists[assist];
    const id = cssIdFor(path);
    if (on) ensureLink(id, chrome.runtime.getURL(path));
    else removeLink(id);
  }
}

async function loadStateFromStorage() {
  const obj = await chrome.storage.sync.get(STORAGE_KEY);
  const saved = obj[STORAGE_KEY];
  if (saved && typeof saved === "object") {
    state = {
      ...structuredClone(defaultState),
      ...saved,
      assists: { ...structuredClone(defaultState.assists), ...(saved.assists || {}) }
    };
  } else {
    state = structuredClone(defaultState);
  }
}

async function saveStateToStorage() {
  await chrome.storage.sync.set({ [STORAGE_KEY]: state });
}

// Fix for: "Extension context invalidated"
async function safeSendMessage(message) {
  try {
    if (!chrome?.runtime?.id) return { ok: false, error: "no-runtime" };
    const res = await chrome.runtime.sendMessage(message);
    return res ?? { ok: true };
  } catch (e) {
    const msg = String(e?.message || e);
    // swallow this common MV3 error
    if (msg.includes("Extension context invalidated")) return { ok: false, error: "context-invalidated" };
    return { ok: false, error: msg };
  }
}

// Example lightweight “signals”
function computeSignals() {
  const linkCount = document.querySelectorAll("a").length;
  const textLen = document.body?.innerText?.length || 0;

  return {
    manyLinks: linkCount > 120,
    densePage: textLen > 20000
  };
}

let signalTimer = null;
function maybeRefreshAIRecommendations() {
  // debounce
  if (signalTimer) clearTimeout(signalTimer);
  signalTimer = setTimeout(async () => {
    const signals = computeSignals();
    await safeSendMessage({ type: "SIGNALS_UPDATE", payload: { signals } });
  }, 600);
}

// ---------- message handling ----------
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  (async () => {
    try {
      if (!msg || !msg.type) return sendResponse({ ok: false });

      if (msg.type === "PING") return sendResponse({ ok: true });

      if (msg.type === "GET_STATE") return sendResponse({ ok: true, state });

      if (msg.type === "SET_ENABLED") {
        state.enabled = !!msg.payload?.enabled;
        await saveStateToStorage();
        applyStateToDom();
        return sendResponse({ ok: true, state });
      }

      if (msg.type === "SET_INTENSITY") {
        const v = Number(msg.payload?.intensity);
        state.intensity = Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : state.intensity;
        await saveStateToStorage();
        applyStateToDom();
        return sendResponse({ ok: true, state });
      }

      if (msg.type === "TOGGLE_ASSIST") {
        const key = msg.payload?.assistKey;
        if (key && Object.prototype.hasOwnProperty.call(state.assists, key)) {
          state.assists[key] = !state.assists[key];
          await saveStateToStorage();
          applyStateToDom();
        }
        return sendResponse({ ok: true, state });
      }

      if (msg.type === "APPLY_RECOMMENDED") {
        const payload = msg.payload || {};
        if (typeof payload.intensity === "number") {
          state.intensity = Math.max(0, Math.min(1, payload.intensity));
        }
        if (payload.assists && typeof payload.assists === "object") {
          for (const [k, v] of Object.entries(payload.assists)) {
            if (Object.prototype.hasOwnProperty.call(state.assists, k) && typeof v === "boolean") {
              state.assists[k] = v;
            }
          }
        }
        await saveStateToStorage();
        applyStateToDom();
        return sendResponse({ ok: true, state });
      }

      if (msg.type === "REFRESH_RECOMMENDATIONS") {
        maybeRefreshAIRecommendations();
        return sendResponse({ ok: true });
      }

      return sendResponse({ ok: false, error: "unknown-type" });
    } catch (e) {
      return sendResponse({ ok: false, error: String(e?.message || e) });
    }
  })();

  return true;
});

// ---------- init ----------
(async function init() {
  await loadStateFromStorage();
  applyStateToDom();

  // refresh signals on user interaction
  window.addEventListener("scroll", maybeRefreshAIRecommendations, { passive: true });
  window.addEventListener("click", maybeRefreshAIRecommendations, { passive: true });
  window.addEventListener("keydown", maybeRefreshAIRecommendations, { passive: true });

  // initial signal push
  maybeRefreshAIRecommendations();
})();
