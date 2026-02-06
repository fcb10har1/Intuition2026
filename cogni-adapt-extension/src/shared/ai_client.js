// src/shared/ai_client.js
// Local, safe "AI" recommendation stub (no external calls)

function clamp01(x) {
  const n = Number(x);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

/**
 * @param {{signals?: any, currentState?: any}} input
 * @returns {{intensity:number, assists: Record<string, boolean>}}
 */
export async function getRecommendation(input = {}) {
  const current = input.currentState || {};
  const currIntensity = clamp01(current.intensity ?? 0.6);

  // Very simple heuristic:
  // - if page seems "dense", recommend reduceDistractions + readingEase
  // - keep focusMode on if already on
  const signals = input.signals || {};
  const dense = Boolean(signals?.densePage);
  const manyLinks = Boolean(signals?.manyLinks);

  const assists = {
    focusMode: Boolean(current?.assists?.focusMode),
    reduceDistractions: dense || manyLinks || Boolean(current?.assists?.reduceDistractions),
    readingEase: dense || Boolean(current?.assists?.readingEase),
    stepByStep: Boolean(current?.assists?.stepByStep),
    timeControl: Boolean(current?.assists?.timeControl),
    focusGuide: Boolean(current?.assists?.focusGuide),
    errorSupport: Boolean(current?.assists?.errorSupport),
    darkMode: Boolean(current?.assists?.darkMode)
  };

  const intensity = clamp01(dense ? Math.max(currIntensity, 0.7) : currIntensity);

  return { intensity, assists };
}
