const ASSIST_KEYS = [
  "focus_mode",
  "reduce_distractions",
  "reading_ease",
  "step_by_step",
  "time_control",
  "focus_guide",
  "error_support",
  "dark_mode"
];

function $(id) {
  return document.getElementById(id);
}

function setStatus(msg, isOk = false) {
  const el = $("status");
  if (!msg) {
    el.style.display = "none";
    el.textContent = "";
    el.className = "danger";
    return;
  }
  el.style.display = "block";
  el.textContent = msg;
  el.className = isOk ? "ok" : "danger";
}

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

function sendToTab(tabId, message) {
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tabId, message, (resp) => {
      const err = chrome.runtime.lastError;
      if (err) return reject(err);
      resolve(resp);
    });
  });
}

function sendToBG(message) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, (resp) => {
      const err = chrome.runtime.lastError;
      if (err) return reject(err);
      resolve(resp);
    });
  });
}

async function ensureContentScript(tabId) {
  // Ask service worker to inject content script (useful right after extension reload)
  try {
    await sendToBG({ type: "INJECT_CONTENT_SCRIPT", tabId });
  } catch (_) {
    // ignore; we’ll still try ping
  }
}

async function ping(tabId) {
  try {
    const resp = await sendToTab(tabId, { type: "PING" });
    return resp && resp.ok;
  } catch (_) {
    return false;
  }
}

async function loadStateToUI(tabId) {
  setStatus("");

  // 1) Try ping; if missing, inject; ping again
  let alive = await ping(tabId);
  if (!alive) {
    await ensureContentScript(tabId);
    alive = await ping(tabId);
  }

  if (!alive) {
    setStatus("Content script not responding. Refresh the page and reopen popup.");
    return null;
  }

  // 2) Get current state from content script
  const state = await sendToTab(tabId, { type: "GET_STATE" });
  $("enabled").checked = !!state.enabled;
  $("intensity").value = String(state.intensity ?? 60);

  // update buttons
  document.querySelectorAll("button.assist").forEach((btn) => {
    const key = btn.getAttribute("data-key");
    const on = !!(state.assists && state.assists[key]);
    btn.dataset.active = on ? "1" : "0";
  });

  setStatus("Connected", true);
  return state;
}

async function applyEnabled(tabId, enabled) {
  await sendToTab(tabId, { type: "SET_ENABLED", enabled: !!enabled });
}

async function applyIntensity(tabId, intensity) {
  const v = Math.max(0, Math.min(100, Number(intensity)));
  await sendToTab(tabId, { type: "SET_INTENSITY", intensity: v });
}

async function toggleAssist(tabId, key) {
  await sendToTab(tabId, { type: "TOGGLE_ASSIST", key });
}

async function recommend(tabId) {
  // Ask content script to collect signals + ask BG AI client for recommendations
  const resp = await sendToTab(tabId, { type: "REQUEST_RECOMMENDATIONS" });

  if (!resp || !resp.ok) {
    setStatus(resp?.error || "Recommendation failed.");
    return;
  }

  const recs = resp.recommendations || [];
  if (recs.length === 0) {
    setStatus("No recommendations right now.", true);
    return;
  }

  // Turn on recommended assists
  for (const key of recs) {
    if (ASSIST_KEYS.includes(key)) {
      await sendToTab(tabId, { type: "SET_ASSIST", key, value: true });
    }
  }

  setStatus(`Recommended: ${recs.map((x) => x.replace(/_/g, " ")).join(", ")}`, true);
  await loadStateToUI(tabId);
}

async function main() {
  const tab = await getActiveTab();
  if (!tab || !tab.id) {
    setStatus("No active tab.");
    return;
  }
  const tabId = tab.id;

  await loadStateToUI(tabId);

  $("enabled").addEventListener("change", async (e) => {
    try {
      await applyEnabled(tabId, e.target.checked);
      await loadStateToUI(tabId);
    } catch {
      setStatus("Content script not responding. Refresh the page and reopen popup.");
    }
  });

  $("intensity").addEventListener("input", async (e) => {
    try {
      await applyIntensity(tabId, e.target.value);
    } catch {
      setStatus("Content script not responding. Refresh the page and reopen popup.");
    }
  });

  document.querySelectorAll("button.assist").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const key = btn.getAttribute("data-key");
      try {
        await toggleAssist(tabId, key);
        await loadStateToUI(tabId);
      } catch {
        setStatus("Content script not responding. Refresh the page and reopen popup.");
      }
    });
  });

  $("recommend").addEventListener("click", async () => {
    try {
      await recommend(tabId);
    } catch {
      setStatus("Recommendation failed. Try refreshing the page.");
    }
  });

  $("refresh").addEventListener("click", async () => {
    await loadStateToUI(tabId);
  });
}

main().catch(() => setStatus("Popup error."));
