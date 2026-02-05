// demo/adapt.js
// Dev 3 deliverable: overload detection + optional simplification (no AI)
// Contract for Dev 2: startOverloadMonitor(onOverload)

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
      background: #111827; color: #fff; padding: 10px 12px; border-radius: 12px;
      font: 12px/1.2 system-ui, -apple-system, Segoe UI, Roboto, Arial;
      box-shadow: 0 10px 20px rgba(0,0,0,.15);
      max-width: 260px;
    `;
    badge.textContent = "Overload monitor: running…";
    document.body.appendChild(badge);
    return badge;
  }

  function toast(msg) {
    const t = document.createElement("div");
    t.textContent = msg;
    t.style.cssText = `
      position: fixed; left: 50%; top: 76px; transform: translateX(-50%);
      z-index: 999999; background: #16a34a; color: #fff;
      padding: 8px 12px; border-radius: 999px;
      font: 12px system-ui;
      box-shadow: 0 10px 20px rgba(0,0,0,.12);
    `;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 2400);
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
    paras.forEach((p) => {
      if (!(p instanceof HTMLElement)) return;
      const text = p.innerText.trim();
      if (text.length < 180) return;
      if (p.dataset.chunkified === "true") return;

      state.originalDense.set(p, text);

      const sentences = text.split(/(?<=[.!?])\s+/).filter(Boolean);
      if (sentences.length < 3) return;

      const ul = document.createElement("ul");
      ul.style.cssText = "margin:10px 0; padding-left:18px; line-height:1.55;";
      sentences.slice(0, 6).forEach((s) => {
        const li = document.createElement("li");
        li.textContent = s.replace(/\s+/g, " ").trim();
        ul.appendChild(li);
      });

      p.innerHTML = "";
      p.appendChild(ul);
      p.dataset.chunkified = "true";
    });

    toast("Simplified dense text (demo)");
  }

  function resetDenseText() {
    state.originalDense.forEach((text, el) => {
      el.textContent = text;
      delete el.dataset.chunkified;
    });
    state.originalDense.clear();
    toast("Reset text (demo)");
  }

  // -------- CONTRACT FUNCTION --------
  function startOverloadMonitor(onOverload) {
    const badge = createBadge();

    // tuning knobs
    const WINDOW_MS = 8000;        // how far back to consider reversals
    const REVERSAL_CLUSTER = 4;    // number of reversals in window to count as "thrashing"
    const REVERSAL_POINTS = 14;    // score added per thrash cluster
    const IDLE_MS = 7000;          // pause threshold
    const IDLE_POINTS = 8;         // score added if user seems stuck
    const DECAY = 3;               // score decay per tick
    const THRESHOLD = 40;          // trigger overload

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("click", recordAction, true);
    window.addEventListener("keydown", recordAction, true);

    const interval = setInterval(() => {
      const t = performance.now();

      // keep only reversals in the recent window
      state.reversalTimes = state.reversalTimes.filter((rt) => t - rt <= WINDOW_MS);

      // if many reversals recently, increase score
      if (state.reversalTimes.length >= REVERSAL_CLUSTER) {
        state.score += REVERSAL_POINTS;
        // prevent instant repeat
        state.reversalTimes.splice(0, Math.min(3, state.reversalTimes.length));
      }

      // if idle for too long, increase score
      const idleFor = t - state.lastActionT;
      if (idleFor >= IDLE_MS) {
        state.score += IDLE_POINTS;
        // avoid stacking idle points every tick
        state.lastActionT = t - 2000;
      }

      // decay score
      state.score = Math.max(0, state.score - DECAY);

      badge.textContent = `Overload score: ${state.score} • reversals: ${state.reversalTimes.length}`;

      if (!state.triggered && state.score >= THRESHOLD) {
        state.triggered = true;
        badge.textContent = "⚠️ Overload detected — activating Focus Mode…";
        try { onOverload?.(); } catch {}
        clearInterval(interval);
      }
    }, 900);

    // optional stop function
    return function stop() {
      clearInterval(interval);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("click", recordAction, true);
      window.removeEventListener("keydown", recordAction, true);
      badge.textContent = "Overload monitor: stopped";
    };
  }

  // Expose globally for Dev 2 to merge into content script
  window.startOverloadMonitor = startOverloadMonitor;

  // Demo wiring (so it works even without the extension)
  const simplifyBtn = document.getElementById("simplifyBtn");
  const resetBtn = document.getElementById("resetBtn");
  if (simplifyBtn) simplifyBtn.addEventListener("click", simplifyDenseText);
  if (resetBtn) resetBtn.addEventListener("click", resetDenseText);

  // Auto-run on the demo page: when overload triggers, toggle Focus Mode visually
  startOverloadMonitor(() => {
    document.documentElement.dataset.cogFocus = "true";
    toast("Overload detected → Focus Mode ON (demo)");
  });
})();
