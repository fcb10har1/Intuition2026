declare const chrome: any;

/**
 * demo/dev2_integration_template.ts
 */

type AssistKey =
  | "focusMode"
  | "reduceDistractions"
  | "readingEase"
  | "stepByStep"
  | "timeControl"
  | "focusGuide"
  | "errorSupport"
  | "darkMode";

export type RecommendPayload = {
  assists?: Partial<Record<AssistKey, boolean>>;
  intensity?: number;
};

declare global {
  interface Window {
    demoA11y?: {
      setEnabled: (v: boolean) => void;
      setIntensity: (v01: number) => void;
      toggle: (k: AssistKey) => void;
      getState: () => any;
    };
  }
}

/** DEMO MODE */
export function demoApplyRecommended(payload: RecommendPayload) {
  if (!window.demoA11y) return;
  if (typeof payload.intensity === "number") window.demoA11y.setIntensity(payload.intensity);

  if (payload.assists) {
    for (const [k, v] of Object.entries(payload.assists)) {
      const key = k as AssistKey;
      const current = window.demoA11y.getState()?.assists?.[key];
      if (typeof v === "boolean" && current !== v) window.demoA11y.toggle(key);
    }
  }
}

/** EXTENSION MODE */
export async function extensionApplyRecommendedToTab(tabId: number, payload: RecommendPayload) {
  await chrome.tabs.sendMessage(tabId, { type: "APPLY_RECOMMENDED", payload });
}
