/**
 * demo/adapt.js
 * 
 * Dev 3 Deliverable: "Smart" Overload Detection + Text Simplification
 * 
 * RULES-BASED HEURISTICS (no AI):
 * - Detects scroll reversals (thrashing behavior)
 * - Detects idle/pause periods (user stuck)
 * - Accumulates "overload score" from these signals
 * - Triggers callback when score exceeds threshold
 * 
 * CONTRACT FOR DEV 2 (Content Script Integration):
 * ================================================
 * Expose globally: window.startOverloadMonitor(onOverload)
 * 
 * Example usage in content script:
 * ```
 * window.startOverloadMonitor(() => {
 *   // When overload detected, tell the extension to:
 *   // - Apply Focus Mode CSS
 *   // - Log to metrics store
 *   // - Show in-page notification
 * });
 * ```
 * 
 * Returns: stop() function to halt monitoring
 */

(function () {
  const state = {
    score: 0,
    triggered: false,
    lastActionT: performance.now(),
    lastScrollY: window.scrollY,
    lastDir: 0,
    reversalTimes: [],
    originalDense: new Map(), // for reset
  };

  function createBadge() {
    let badge = document.getElementById("intuition-overload-badge");
    if (badge) return badge;

    badge = document.createElement("div");
    badge.id = "intuition-overload-badge";
    badge.style.cssText = `
      position: fixed; right: 16px; bottom: 16px; z-index: 999999;
      background: linear-gradient(135deg, #111827 0%, #1f2937 100%);
      color: #fff; padding: 12px 14px; border-radius: 12px;
      font: 12px/1.4 system-ui, -apple-system, Segoe UI, Roboto, Arial;
      box-shadow: 0 10px 25px rgba(0,0,0,0.2);
      max-width: 280px;
      border: 1px solid rgba(255, 255, 255, 0.1);
      backdrop-filter: blur(10px);
      transition: all 0.3s ease;
    `;
    badge.textContent = "📊 Overload monitor: running…";
    document.body.appendChild(badge);
    return badge;
  }

  function toast(msg, type = "success") {
    const t = document.createElement("div");
    t.textContent = msg;
    
    const bgColor = type === "success" ? "#16a34a" : type === "warning" ? "#ea580c" : "#1e40af";
    
    t.style.cssText = `
      position: fixed; left: 50%; top: 90px; transform: translateX(-50%);
      z-index: 999999; background: ${bgColor}; color: #fff;
      padding: 10px 14px; border-radius: 999px;
      font: 13px system-ui, -apple-system, Segoe UI, Roboto, Arial;
      box-shadow: 0 10px 25px rgba(0,0,0,0.15);
      animation: toastSlideIn 0.3s ease;
    `;
    document.body.appendChild(t);
    setTimeout(() => {
      t.style.animation = "toastSlideOut 0.3s ease";
      setTimeout(() => t.remove(), 300);
    }, 2400);
  }
  
  // Add toast animations to document if not present
  if (!document.getElementById("intuition-toast-styles")) {
    const style = document.createElement("style");
    style.id = "intuition-toast-styles";
    style.textContent = `
      @keyframes toastSlideIn {
        from { opacity: 0; transform: translateX(-50%) translateY(-10px); }
        to { opacity: 1; transform: translateX(-50%) translateY(0); }
      }
      @keyframes toastSlideOut {
        from { opacity: 1; transform: translateX(-50%) translateY(0); }
        to { opacity: 0; transform: translateX(-50%) translateY(-10px); }
      }
    `;
    document.head.appendChild(style);
  }

  function recordAction() {
    state.lastActionT = performance.now();
  }

  function onScroll() {
    const y = window.scrollY;
    const dy = y - state.lastScrollY;
    const dir = dy === 0 ? 0 : (dy > 0 ? 1 : -1);

    // detect reversal (scroll direction changes)
    if (dir !== 0 && state.lastDir !== 0 && dir !== state.lastDir) {
      state.reversalTimes.push(performance.now());
    }

    state.lastDir = dir;
    state.lastScrollY = y;
    recordAction();
  }

  function simplifyDenseText() {
    const paras = document.querySelectorAll(".dense");
    let simplified = 0;

    paras.forEach((p) => {
      if (!(p instanceof HTMLElement)) return;
      const text = p.innerText.trim();
      if (text.length < 100) return;
      if (p.dataset.chunkified === "true") return;

      state.originalDense.set(p, text);

      // Split by sentence boundaries
      const sentences = text.split(/(?<=[.!?])\s+/).filter(Boolean);
      if (sentences.length < 2) return;

      // Create bullet-point list
      const ul = document.createElement("ul");
      ul.style.cssText = "margin:12px 0; padding-left:20px; line-height:1.6; color: inherit;";
      
      sentences.slice(0, 8).forEach((s) => {
        const li = document.createElement("li");
        li.textContent = s.replace(/\s+/g, " ").trim();
        li.style.cssText = "margin-bottom: 8px;";
        ul.appendChild(li);
      });

      p.innerHTML = "";
      p.appendChild(ul);
      p.dataset.chunkified = "true";
      simplified++;
    });

    const msg = simplified > 0 
      ? `✓ Simplified ${simplified} dense paragraph(s) into digestible points`
      : "No dense text found to simplify";
    toast(msg, "success");
  }

  function resetDenseText() {
    let reset = 0;
    state.originalDense.forEach((text, el) => {
      el.textContent = text;
      delete el.dataset.chunkified;
      reset++;
    });
    state.originalDense.clear();
    toast(`↻ Reset ${reset} simplified paragraph(s) (demo)`, "success");
  }

  /**
   * Main contract function exposed for Dev 2.
   * 
   * @param {Function} onOverload - Callback when overload is detected (score >= threshold)
   * @returns {Function} stop() - Call to halt monitoring
   * 
   * Algorithm:
   * 1. Track scroll direction changes (reversals = thrashing)
   * 2. Track idle time (no interaction for IDLE_MS)
   * 3. Accumulate "overload score" from signals
   * 4. Decay score over time (natural recovery)
   * 5. Trigger callback when score exceeds threshold
   */
  function startOverloadMonitor(onOverload) {
    const badge = createBadge();

    // ===== TUNING PARAMETERS =====
    // Adjust these to control overload sensitivity
    const WINDOW_MS = 6000;        // ms: recent reversals window
    const REVERSAL_CLUSTER = 3;    // count: reversals to trigger thrashing
    const REVERSAL_POINTS = 18;    // points: added per thrash cluster
    const IDLE_MS = 5000;          // ms: pause threshold before "stuck"
    const IDLE_POINTS = 12;        // points: added if idle
    const DECAY = 4;               // points: decay per tick (slower recovery)
    const THRESHOLD = 35;          // trigger at this score
    const TICK_MS = 800;           // ms: check interval

    // Event listeners: track user interactions
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("click", recordAction, true);
    window.addEventListener("keydown", recordAction, true);
    window.addEventListener("input", recordAction, true);

    const interval = setInterval(() => {
      const t = performance.now();

      // Keep only reversals within recent window
      state.reversalTimes = state.reversalTimes.filter((rt) => t - rt <= WINDOW_MS);

      // Signal 1: Scroll thrashing (rapid direction reversals)
      if (state.reversalTimes.length >= REVERSAL_CLUSTER) {
        state.score += REVERSAL_POINTS;
        // Prevent infinite stacking of the same reversals
        state.reversalTimes.splice(0, Math.min(2, state.reversalTimes.length));
      }

      // Signal 2: Idle / stuck (no interaction for extended period)
      const idleFor = t - state.lastActionT;
      if (idleFor >= IDLE_MS) {
        state.score += IDLE_POINTS;
        // Avoid stacking idle points every tick
        state.lastActionT = t - 2500;
      }

      // Natural score decay (user recovers over time)
      state.score = Math.max(0, state.score - DECAY);

      // Update badge with real-time metrics
      const reversalStr = state.reversalTimes.length > 0 
        ? `${state.reversalTimes.length} reversals` 
        : "normal scrolling";
      badge.textContent = `📊 Score: ${Math.round(state.score)} | ${reversalStr}`;

      // Trigger overload callback and cleanup
      if (!state.triggered && state.score >= THRESHOLD) {
        state.triggered = true;
        badge.style.background = "linear-gradient(135deg, #dc2626 0%, #991b1b 100%)";
        badge.textContent = "⚠️ Overload detected → Enabling Focus Mode…";
        try { onOverload?.(); } catch (e) { console.error("Overload callback error:", e); }
        clearInterval(interval);
      }
    }, TICK_MS);

    // Expose stop function for cleanup
    return function stop() {
      clearInterval(interval);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("click", recordAction, true);
      window.removeEventListener("keydown", recordAction, true);
      window.removeEventListener("input", recordAction, true);
      badge.textContent = "⏹ Monitor stopped";
    };
  }

  // ===== GLOBAL EXPOSURE FOR DEV 2 =====
  window.startOverloadMonitor = startOverloadMonitor;

  // ===== DEMO PAGE WIRING (local testing) =====
  // On the demo page, attach the simplify/reset buttons and auto-start monitoring
  
  const simplifyBtn = document.getElementById("simplifyBtn");
  const resetBtn = document.getElementById("resetBtn");
  
  if (simplifyBtn) simplifyBtn.addEventListener("click", simplifyDenseText);
  if (resetBtn) resetBtn.addEventListener("click", resetDenseText);

  // Auto-start overload detection on demo page
  // When triggered, toggle Focus Mode CSS class
  startOverloadMonitor(() => {
    document.documentElement.dataset.cogFocus = "true";
    toast("⚡ Overload detected → Focus Mode ACTIVATED (demo)", "warning");
    setTimeout(() => {
      toast("💡 In production, this would disable ads, sidebars, and distractions", "success");
    }, 800);
  });
})();
