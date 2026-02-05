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

  toggleBtn.textContent = focusEnabled ? "ON" : "OFF";
  status.textContent = focusEnabled ? "ON" : "OFF";
  intensitySelect.value = intensity;
}

// ---- Ensure content script + css are injected ----
// This keeps the content script always present for messaging.
async function ensureInjected(tabId) {
  // Inject JS (safe if run multiple times; content script guards with a global flag)
  await chrome.scripting.executeScript({
    target: { tabId },
    files: ["src/content/content_script.js"]
  });
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

document.addEventListener("DOMContentLoaded", async () => {
  // Load initial state
  const settings = await loadSettings();
  setUI(settings);

  const toggleBtn = document.getElementById("toggleBtn");
  const intensitySelect = document.getElementById("intensitySelect");

  // Toggle Focus Mode
  toggleBtn.addEventListener("click", async () => {
    const tab = await getActiveTab();
    if (!tab?.id) return;

    const current = await loadSettings();
    const nextEnabled = !current.focusEnabled;

    await saveSettings({ focusEnabled: nextEnabled });
    setUI({ ...current, focusEnabled: nextEnabled });

    await ensureInjected(tab.id);

    // Contract message #1:
    await sendToContent(tab.id, { type: "TOGGLE_FOCUS", enabled: nextEnabled });

    // Also send current intensity so content can apply correct level
    await sendToContent(tab.id, { type: "SET_INTENSITY", level: (await loadSettings()).intensity });
  });

  // Set Intensity
  intensitySelect.addEventListener("change", async (e) => {
    const tab = await getActiveTab();
    if (!tab?.id) return;

    const level = e.target.value; // mild | med | strong
    await saveSettings({ intensity: level });

    const current = await loadSettings();
    setUI(current);

    await ensureInjected(tab.id);

    // Contract message #2:
    await sendToContent(tab.id, { type: "SET_INTENSITY", level });

    // If focus is ON, we can resend focus to ensure consistency
    if (current.focusEnabled) {
      await sendToContent(tab.id, { type: "TOGGLE_FOCUS", enabled: true });
    }
  });

  // OPTIONAL: auto-apply saved state when opening popup (nice UX)
  // This makes it feel "persistent".
  // Only do this if you want it: it will message the content script each time popup opens.
  try {
    const tab = await getActiveTab();
    if (tab?.id) {
      await ensureInjected(tab.id);
      await sendToContent(tab.id, { type: "SET_INTENSITY", level: settings.intensity });
      await sendToContent(tab.id, { type: "TOGGLE_FOCUS", enabled: settings.focusEnabled });
    }
  } catch (_) {}
});
