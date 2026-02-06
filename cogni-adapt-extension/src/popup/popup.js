// src/popup/popup.js

const STORAGE_KEY = "cogState";

function $(id) {
  return document.getElementById(id);
}

async function getActiveTabId() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab?.id;
}

async function ping(tabId) {
  try {
    const res = await chrome.tabs.sendMessage(tabId, { type: "PING" });
    return !!res?.ok;
  } catch {
    return false;
  }
}

async function getState(tabId) {
  // Prefer content script state (authoritative for that tab)
  try {
    const res = await chrome.tabs.sendMessage(tabId, { type: "GET_STATE" });
    if (res?.ok && res.state) return res.state;
  } catch {}

  // fallback: storage
  const obj = await chrome.storage.sync.get(STORAGE_KEY);
  return obj[STORAGE_KEY] || null;
}

function setStatus(text, ok = true) {
  const el = $("status");
  el.textContent = text;
  el.style.color = ok ? "#118a3c" : "#b00020";
}

function render(state) {
  if (!state) return;

  $("enabledToggle").checked = !!state.enabled;
  $("intensitySlider").value = String(state.intensity ?? 0.6);

  const buttons = document.querySelectorAll("button.assist");
  buttons.forEach((btn) => {
    const key = btn.dataset.assist;
    const on = !!state.assists?.[key];
    btn.classList.toggle("on", on);
  });
}

async function setEnabled(tabId, enabled) {
  await chrome.tabs.sendMessage(tabId, { type: "SET_ENABLED", payload: { enabled } });
}

async function setIntensity(tabId, intensity) {
  await chrome.tabs.sendMessage(tabId, { type: "SET_INTENSITY", payload: { intensity } });
}

async function toggleAssist(tabId, assistKey) {
  await chrome.tabs.sendMessage(tabId, { type: "TOGGLE_ASSIST", payload: { assistKey } });
}

async function requestRecommendation(currentState) {
  // Ask background for recommendation
  const res = await chrome.runtime.sendMessage({
    type: "REQUEST_RECOMMENDATION",
    payload: {
      signals: null, // background can be improved later to store signals
      currentState
    }
  });
  if (!res?.ok) throw new Error(res?.error || "Failed to get recommendation");
  return res.recommendation;
}

async function applyRecommendation(tabId, recommendation) {
  await chrome.tabs.sendMessage(tabId, { type: "APPLY_RECOMMENDED", payload: recommendation });
}

(async function init() {
  const tabId = await getActiveTabId();
  if (!tabId) {
    setStatus("No active tab", false);
    return;
  }

  const connected = await ping(tabId);
  if (!connected) {
    setStatus("Content script not responding. Refresh the page and reopen popup.", false);
    return;
  }

  setStatus("Connected", true);

  let state = await getState(tabId);
  render(state);

  $("enabledToggle").addEventListener("change", async (e) => {
    await setEnabled(tabId, e.target.checked);
    state = await getState(tabId);
    render(state);
  });

  $("intensitySlider").addEventListener("input", async (e) => {
    await setIntensity(tabId, Number(e.target.value));
    state = await getState(tabId);
    render(state);
  });

  document.querySelectorAll("button.assist").forEach((btn) => {
    btn.addEventListener("click", async () => {
      await toggleAssist(tabId, btn.dataset.assist);
      state = await getState(tabId);
      render(state);
    });
  });

  $("refreshBtn").addEventListener("click", async () => {
    try {
      await chrome.tabs.sendMessage(tabId, { type: "REFRESH_RECOMMENDATIONS" });
      state = await getState(tabId);
      render(state);
      setStatus("Connected", true);
    } catch {
      setStatus("Refresh failed. Reload the page.", false);
    }
  });

  $("recommendBtn").addEventListener("click", async () => {
    try {
      state = await getState(tabId);
      const rec = await requestRecommendation(state);
      await applyRecommendation(tabId, rec);
      state = await getState(tabId);
      render(state);
      setStatus("Recommendation applied", true);
    } catch (e) {
      setStatus(String(e?.message || e), false);
    }
  });
})();
