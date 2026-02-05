// ---- Config: names used in chrome.storage ----
const STORAGE_DEFAULTS = {
  focusEnabled: false,
  intensity: "med" // mild | med | strong
};

// ---- Helper: get active tab ----
async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

// ---- Storage helpers ----
async function loadSettings() {
  const data = await chrome.storage.sync.get(STORAGE_DEFAULTS);
  return {
    focusEnabled: !!data.focusEnabled,
    intensity: data.intensity || "med"
  };
}

async function saveSettings(patch) {
  const current = await loadSettings();
  await chrome.storage.sync.set({ ...current, ...patch });
}

// ---- UI helpers ----
function setUI({ focusEnabled, intensity }) {
  const toggleBtn = document.getElementById("toggleBtn");
  const status = document.getElementById("status");
  const intensitySelect = document.getElementById("intensitySelect");

  if (toggleBtn) toggleBtn.textContent = focusEnabled ? "ON" : "OFF";
  if (status) status.textContent = focusEnabled ? "ON" : "OFF";
  if (intensitySelect) intensitySelect.value = intensity;
}

// ---- Ensure content script + css are injected ----
// IMPORTANT: Dev 2 must create content.js (+ content.css if you use it).
async function ensureInjected(tabId) {
  // Inject JS (safe if run multiple times; Dev 2 should guard with a global flag)
  await chrome.scripting.executeScript({
    target: { tabId },
    files: ["content.js"]
  });

  // Inject CSS if present (avoid crashing if content.css doesn't exist)
  try {
    await chrome.scripting.insertCSS({
      target: { tabId },
      files: ["content.css"]
    });
  } catch (_) {
    // It's okay if you don't have content.css (e.g., you load CSS via getURL in content.js)
  }
}

// ---- Send messages to content script ----
async function sendToContent(tabId, message) {
  try {
    await chrome.tabs.sendMessage(tabId, message);
  } catch (e) {
    // If content script isn't ready, try injecting once then resend
    await ensureInjected(tabId);
    await chrome.tabs.sendMessage(tabId, message);
  }
}

// ---- Nice-to-have: apply current saved settings to page ----
async function applySavedStateToTab(tabId) {
  const settings = await loadSettings();
  await ensureInjected(tabId);

  // Send intensity first, then focus
  await sendToContent(tabId, { type: "SET_INTENSITY", level: settings.intensity });
  await sendToContent(tabId, { type: "TOGGLE_FOCUS", enabled: settings.focusEnabled });
}

document.addEventListener("DOMContentLoaded", async () => {
  // Load initial state
  const settings = await loadSettings();
  setUI(settings);

  const toggleBtn = document.getElementById("toggleBtn");
  const intensitySelect = document.getElementById("intensitySelect");
  const resetBtn = document.getElementById("resetBtn");

  // Nice-to-have #1: auto-apply saved state when opening popup (persistent feel)
  try {
    const tab = await getActiveTab();
    if (tab?.id) await applySavedStateToTab(tab.id);
  } catch (_) {}

  // Toggle Focus Mode
  toggleBtn?.addEventListener("click", async () => {
    const tab = await getActiveTab();
    if (!tab?.id) return;

    const current = await loadSettings();
    const nextEnabled = !current.focusEnabled;

    await saveSettings({ focusEnabled: nextEnabled });
    setUI({ ...current, focusEnabled: nextEnabled });

    await ensureInjected(tab.id);

    // Contract message #1:
    await sendToContent(tab.id, { type: "TOGGLE_FOCUS", enabled: nextEnabled });

    // Also send intensity so content can apply correct level
    const latest = await loadSettings();
    await sendToContent(tab.id, { type: "SET_INTENSITY", level: latest.intensity });
  });

  // Set Intensity
  intensitySelect?.addEventListener("change", async (e) => {
    const tab = await getActiveTab();
    if (!tab?.id) return;

    const level = e.target.value; // mild | med | strong
    await saveSettings({ intensity: level });

    const current = await loadSettings();
    setUI(current);

    await ensureInjected(tab.id);

    // Contract message #2:
    await sendToContent(tab.id, { type: "SET_INTENSITY", level });

    // If focus is ON, resend focus to enforce styling consistency
    if (current.focusEnabled) {
      await sendToContent(tab.id, { type: "TOGGLE_FOCUS", enabled: true });
    }
  });

  // Nice-to-have #2: Reset button (Focus OFF + Intensity MED)
  resetBtn?.addEventListener("click", async () => {
    const tab = await getActiveTab();
    if (!tab?.id) return;

    const resetState = { focusEnabled: false, intensity: "med" };
    await chrome.storage.sync.set(resetState);
    setUI(resetState);

    await ensureInjected(tab.id);
    await sendToContent(tab.id, { type: "SET_INTENSITY", level: "med" });
    await sendToContent(tab.id, { type: "TOGGLE_FOCUS", enabled: false });
  });
});
