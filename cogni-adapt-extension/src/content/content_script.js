// JS-only content script (MV3)

const STORAGE_KEY = "state";

const CSS_MAP = {
  focus_mode: "src/content/adapt/css/focus_mode.css",
  reduce_distractions: "src/content/adapt/css/reduce_distractions.css",
  reading_ease: "src/content/adapt/css/reading_ease.css",
  step_by_step: "src/content/adapt/css/step_by_step.css",
  time_control: "src/content/adapt/css/time_control.css",
  focus_guide: "src/content/adapt/css/focus_guide.css",
  error_support: "src/content/adapt/css/error_support.css",
  dark_mode: "src/content/adapt/css/dark_mode.css"
};

const DEFAULT_STATE = {
  enabled: true,
  intensity: 60,
  assists: {
    focus_mode: false,
    reduce_distractions: false,
    reading_ease: false,
    step_by_step: false,
    time_control: false,
    focus_guide: false,
    error_support: false,
    dark_mode: false
  }
};

function runtimeAlive() {
  try {
    return !!(chrome && chrome.runtime && chrome.runtime.id);
  } catch {
    return false;
  }
}

function safeGetURL(path) {
  try {
    if (!runtimeAlive()) return null;
    return chrome.runtime.getURL(path);
  } catch {
    return null;
  }
}

async function loadState() {
  if (!runtimeAlive()) return { ...DEFAULT_STATE };
  try {
    const obj = await chrome.storage.sync.get([STORAGE_KEY]);
    return obj[STORAGE_KEY] ? obj[STORAGE_KEY] : { ...DEFAULT_STATE };
  } catch {
    return { ...DEFAULT_STATE };
  }
}

async function saveState(state) {
  if (!runtimeAlive()) return;
  try {
    await chrome.storage.sync.set({ [STORAGE_KEY]: state });
  } catch {
    // ignore (can happen if extension reloaded)
  }
}

function setHtmlFlag(name, value) {
  const html = document.documentElement;
  html.dataset[name] = value ? "1" : "0";
}

function setIntensity(intensity) {
  const html = document.documentElement;
  html.style.setProperty("--cog-intensity", String(intensity));
}

function ensureCssForAssist(key, on) {
  const id = `cog-css-${key}`;
  const existing = document.getElementById(id);

  if (!on) {
    if (existing) existing.remove();
    return;
  }

  if (existing) return;

  const path = CSS_MAP[key];
  const url = safeGetURL(path);
  if (!url) return;

  const link = document.createElement("link");
  link.id = id;
  link.rel = "stylesheet";
  link.href = url;
  document.documentElement.appendChild(link);
}

function applyAll(state) {
  const enabled = !!state.enabled;
  setHtmlFlag("cogEnabled", enabled);
  setIntensity(Number(state.intensity ?? 60));

  for (const key of Object.keys(CSS_MAP)) {
    const active = enabled && !!(state.assists && state.assists[key]);
    setHtmlFlag(`cog_${key}`, active);
    ensureCssForAssist(key, active);
  }
}

// Simple DOM signals for recommendations
function collectSignals() {
  const text = document.body ? document.body.innerText || "" : "";
  const wordCount = text.trim().split(/\s+/).filter(Boolean).length;

  const linkCount = document.querySelectorAll("a").length;
  const buttonCount = document.querySelectorAll("button,[role='button'],input[type='button'],input[type='submit']").length;
  const headingCount = document.querySelectorAll("h1,h2,h3,h4,h5,h6").length;
  const hasForms = document.querySelectorAll("form,input,textarea,select").length > 0;

  // crude density score
  const densityScore = Math.max(
    0,
    Math.min(
      1,
      (wordCount / 2000) * 0.6 +
        (linkCount / 120) * 0.3 +
        (buttonCount / 60) * 0.1
    )
  );

  return { wordCount, linkCount, buttonCount, headingCount, hasForms, densityScore };
}

function sendToBG(message) {
  return new Promise((resolve, reject) => {
    if (!runtimeAlive()) return reject(new Error("Extension context invalidated"));
    chrome.runtime.sendMessage(message, (resp) => {
      const err = chrome.runtime.lastError;
      if (err) return reject(err);
      resolve(resp);
    });
  });
}

let CURRENT_STATE = null;

async function init() {
  CURRENT_STATE = await loadState();
  applyAll(CURRENT_STATE);
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || !msg.type) return;

  if (msg.type === "PING") {
    sendResponse({ ok: true, where: "content_script" });
    return true;
  }

  if (msg.type === "GET_STATE") {
    sendResponse(CURRENT_STATE || DEFAULT_STATE);
    return true;
  }

  if (msg.type === "SET_ENABLED") {
    (async () => {
      CURRENT_STATE = CURRENT_STATE || (await loadState());
      CURRENT_STATE.enabled = !!msg.enabled;
      await saveState(CURRENT_STATE);
      applyAll(CURRENT_STATE);
      sendResponse({ ok: true });
    })();
    return true;
  }

  if (msg.type === "SET_INTENSITY") {
    (async () => {
      CURRENT_STATE = CURRENT_STATE || (await loadState());
      const v = Math.max(0, Math.min(100, Number(msg.intensity)));
      CURRENT_STATE.intensity = v;
      await saveState(CURRENT_STATE);
      applyAll(CURRENT_STATE);
      sendResponse({ ok: true });
    })();
    return true;
  }

  if (msg.type === "TOGGLE_ASSIST") {
    (async () => {
      const key = msg.key;
      if (!CSS_MAP[key]) return sendResponse({ ok: false, error: "Unknown assist" });

      CURRENT_STATE = CURRENT_STATE || (await loadState());
      const cur = !!CURRENT_STATE.assists[key];
      CURRENT_STATE.assists[key] = !cur;

      await saveState(CURRENT_STATE);
      applyAll(CURRENT_STATE);
      sendResponse({ ok: true });
    })();
    return true;
  }

  if (msg.type === "SET_ASSIST") {
    (async () => {
      const key = msg.key;
      if (!CSS_MAP[key]) return sendResponse({ ok: false, error: "Unknown assist" });

      CURRENT_STATE = CURRENT_STATE || (await loadState());
      CURRENT_STATE.assists[key] = !!msg.value;

      await saveState(CURRENT_STATE);
      applyAll(CURRENT_STATE);
      sendResponse({ ok: true });
    })();
    return true;
  }

  if (msg.type === "REQUEST_RECOMMENDATIONS") {
    (async () => {
      try {
        const signals = collectSignals();
        const resp = await sendToBG({ type: "AI_RECOMMEND", signals });
        sendResponse({ ok: true, recommendations: resp.recommendations || [] });
      } catch (e) {
        sendResponse({ ok: false, error: String(e?.message || e) });
      }
    })();
    return true;
  }
});

init();
