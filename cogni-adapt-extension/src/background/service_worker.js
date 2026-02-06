// src/background/service_worker.js
// MV3 service worker (module)

import { getRecommendation } from "../shared/ai_client.js";

chrome.runtime.onInstalled.addListener(() => {
  // optional init
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  (async () => {
    try {
      if (!msg || !msg.type) return;

      // Popup asks background to compute recommendation
      if (msg.type === "REQUEST_RECOMMENDATION") {
        const { signals, currentState } = msg.payload || {};
        const rec = await getRecommendation({ signals, currentState });

        sendResponse({ ok: true, recommendation: rec });
        return;
      }

      // Content script might send signals here (optional)
      if (msg.type === "SIGNALS_UPDATE") {
        // You can store / aggregate if you want
        sendResponse({ ok: true });
        return;
      }
    } catch (e) {
      sendResponse({ ok: false, error: String(e?.message || e) });
    }
  })();

  // IMPORTANT: keep channel open for async
  return true;
});
