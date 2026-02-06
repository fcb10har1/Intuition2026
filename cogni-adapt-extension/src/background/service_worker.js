// MV3 Service Worker (self-contained)

// ===== tiny local "AI client" (rules-based) =====
function clamp01(x) {
  const n = Number(x);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function recommendAssists(signals) {
  const density = clamp01(signals?.densityScore);
  const wordCount = Number(signals?.wordCount || 0);
  const linkCount = Number(signals?.linkCount || 0);
  const hasForms = !!signals?.hasForms;

  const recs = [];

  if (density > 0.55 || linkCount > 80) {
    recs.push("reduce_distractions", "focus_mode");
  }
  if (wordCount > 1200) {
    recs.push("reading_ease");
  }
  if (hasForms) {
    recs.push("error_support");
  }

  return Array.from(new Set(recs));
}

// ===== default stored state =====
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

chrome.runtime.onInstalled.addListener(async () => {
  const existing = await chrome.storage.sync.get(["state"]);
  if (!existing.state) {
    await chrome.storage.sync.set({ state: DEFAULT_STATE });
  }
});

// Best-effort injection (helpful after extension reload without page refresh)
async function injectContentScript(tabId) {
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ["src/content/content_script.js"]
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e?.message || e) };
  }
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || !msg.type) return;

  if (msg.type === "INJECT_CONTENT_SCRIPT") {
    injectContentScript(msg.tabId).then(sendResponse);
    return true;
  }

  if (msg.type === "AI_RECOMMEND") {
    const signals = msg.signals || {};
    const recs = recommendAssists(signals);
    sendResponse({ ok: true, recommendations: recs });
    return true;
  }
});
