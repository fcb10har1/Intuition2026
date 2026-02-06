(function () {
  function clamp01(x) {
    const n = Number(x);
    if (!Number.isFinite(n)) return 0;
    return Math.max(0, Math.min(1, n));
  }

  /**
   * signals example:
   * {
   *   wordCount: number,
   *   linkCount: number,
   *   buttonCount: number,
   *   headingCount: number,
   *   hasForms: boolean,
   *   densityScore: 0..1
   * }
   */
  function recommendAssists(signals) {
    const density = clamp01(signals.densityScore);
    const wordCount = Number(signals.wordCount || 0);
    const linkCount = Number(signals.linkCount || 0);
    const hasForms = !!signals.hasForms;

    const recs = [];

    // High density → reduce distractions + focus mode
    if (density > 0.55 || linkCount > 80) {
      recs.push("reduce_distractions", "focus_mode");
    }

    // Very text heavy → reading ease
    if (wordCount > 1200) {
      recs.push("reading_ease");
    }

    // If forms exist → error support (helps cognitive load with errors)
    if (hasForms) {
      recs.push("error_support");
    }

    // Keep unique, stable order
    return Array.from(new Set(recs));
  }

  globalThis.AIClient = { recommendAssists };
})();
