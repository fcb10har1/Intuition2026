const ONBOARDING_URL = chrome.runtime.getURL("src/onboarding/onboarding.html");

chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason !== "install") return;

  const { onboardingCompleted } = await chrome.storage.sync.get(["onboardingCompleted"]);
  if (!onboardingCompleted) {
    await chrome.tabs.create({ url: ONBOARDING_URL });
  }
});

// ===== AI Status Service =====
// For Transformers.js (in-browser model):
// Status is tracked in content scripts via window.__aiClient.getAIStatus()
// We relay status from the active tab

const aiStatusState = {
  cachedStatus: "initializing", // initializing | ready | error
  lastCheckTab: null,
  lastCheckTime: 0
};

async function getAIStatus() {
  // Query the active tab for AI client status
  try {
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (!activeTab || !activeTab.id) {
      return "unknown";
    }

    return new Promise((resolve) => {
      chrome.tabs.sendMessage(
        activeTab.id,
        { action: "getAIStatus" },
        (response) => {
          if (chrome.runtime.lastError) {
            console.warn("[Service Worker] Could not query AI status:", chrome.runtime.lastError.message);
            resolve("unknown");
          } else {
            aiStatusState.cachedStatus = response?.status || "unknown";
            aiStatusState.lastCheckTime = Date.now();
            resolve(aiStatusState.cachedStatus);
          }
        }
      );
    });
  } catch (error) {
    console.warn("[Service Worker] AI Status query failed:", error.message);
    return "unknown";
  }
}

// Listen for status requests from popup
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === "checkAIHealth") {
    getAIStatus().then((status) => {
      // Map AI client status to health check response
      const healthStatus = status === "ready" ? "connected" : "unavailable";
      sendResponse({ status: healthStatus, aiStatus: status });
    });
    return true; // Keep channel open for async response
  }
});

console.log("[Service Worker] Initialized with Transformers.js in-browser AI");