// src/content/content_script.js

const STORAGE_KEY = "cogState";

const BASE_CSS = [
  "src/content/adapt/css/base.css",
  "src/content/adapt/css/orb.css",
  "src/content/adapt/css/focus_overlay.css",
  "src/content/adapt/css/cursor.css"
];

const ASSIST_CSS = {
  focusMode: "src/content/adapt/css/focus_mode.css",
  reduceDistractions: "src/content/adapt/css/reduce_distractions.css",
  readingEase: "src/content/adapt/css/reading_ease.css",
  stepByStep: "src/content/adapt/css/step_by_step.css",
  timeControl: "src/content/adapt/css/time_control.css",
  focusGuide: "src/content/adapt/css/focus_guide.css",
  errorSupport: "src/content/adapt/css/error_support.css",
  darkMode: "src/content/adapt/css/dark_mode.css"
};

const defaultState = {
  enabled: true,
  intensity: 0.6,
  assists: {
    focusMode: true,
    reduceDistractions: false,
    readingEase: true,
    stepByStep: false,
    timeControl: false,
    focusGuide: false,
    errorSupport: false,
    darkMode: false
  }
};

let state = structuredClone(defaultState);

// ---------- helpers ----------
function cssIdFor(path) {
  return `cog-css:${path.replace(/[^\w-]/g, "_")}`;
}

function ensureLink(id, href) {
  if (document.getElementById(id)) return;
  const el = document.createElement("link");
  el.id = id;
  el.rel = "stylesheet";
  el.href = href;
  document.head.appendChild(el);
}

function removeLink(id) {
  const el = document.getElementById(id);
  if (el) el.remove();
}

function setHtmlFlag(name, value) {
  const attr = `data-cog-${name}`;
  if (value) document.documentElement.setAttribute(attr, "1");
  else document.documentElement.removeAttribute(attr);
}

function applyStateToDom() {
  setHtmlFlag("enabled", !!state.enabled);
  document.documentElement.style.setProperty("--cog-intensity", String(state.intensity ?? 0.6));

  setHtmlFlag("focus-mode", !!state.assists.focusMode);
  setHtmlFlag("reduce-distractions", !!state.assists.reduceDistractions);
  setHtmlFlag("reading-ease", !!state.assists.readingEase);
  setHtmlFlag("step-by-step", !!state.assists.stepByStep);
  setHtmlFlag("time-control", !!state.assists.timeControl);
  setHtmlFlag("focus-guide", !!state.assists.focusGuide);
  setHtmlFlag("error-support", !!state.assists.errorSupport);
  setHtmlFlag("dark-mode", !!state.assists.darkMode);

  // CSS injection (must be in web_accessible_resources)
  if (state.enabled) {
    for (const p of BASE_CSS) ensureLink(cssIdFor(p), chrome.runtime.getURL(p));
  } else {
    for (const p of BASE_CSS) removeLink(cssIdFor(p));
  }

  for (const [assist, path] of Object.entries(ASSIST_CSS)) {
    const on = !!state.enabled && !!state.assists[assist];
    const id = cssIdFor(path);
    if (on) ensureLink(id, chrome.runtime.getURL(path));
    else removeLink(id);
  }
}

async function loadStateFromStorage() {
  const obj = await chrome.storage.sync.get(STORAGE_KEY);
  const saved = obj[STORAGE_KEY];
  if (saved && typeof saved === "object") {
    state = {
      ...structuredClone(defaultState),
      ...saved,
      assists: { ...structuredClone(defaultState.assists), ...(saved.assists || {}) }
    };
  } else {
    state = structuredClone(defaultState);
  }
}

async function saveStateToStorage() {
  await chrome.storage.sync.set({ [STORAGE_KEY]: state });
}

// Fix for: "Extension context invalidated"
async function safeSendMessage(message) {
  try {
    if (!chrome?.runtime?.id) return { ok: false, error: "no-runtime" };
    const res = await chrome.runtime.sendMessage(message);
    return res ?? { ok: true };
  } catch (e) {
    const msg = String(e?.message || e);
    // swallow this common MV3 error
    if (msg.includes("Extension context invalidated")) return { ok: false, error: "context-invalidated" };
    return { ok: false, error: msg };
  }
}

// Example lightweight “signals”
function computeSignals() {
  const linkCount = document.querySelectorAll("a").length;
  const textLen = document.body?.innerText?.length || 0;

  return {
    manyLinks: linkCount > 120,
    densePage: textLen > 20000
  };
}

let signalTimer = null;
function maybeRefreshAIRecommendations() {
  // debounce
  if (signalTimer) clearTimeout(signalTimer);
  signalTimer = setTimeout(async () => {
    const signals = computeSignals();
    await safeSendMessage({ type: "SIGNALS_UPDATE", payload: { signals } });
  }, 600);
}

// ---------- message handling ----------
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  (async () => {
    try {
      if (!msg || !msg.type) return sendResponse({ ok: false });

      if (msg.type === "PING") return sendResponse({ ok: true });

      if (msg.type === "GET_STATE") return sendResponse({ ok: true, state });

      if (msg.type === "SET_ENABLED") {
        state.enabled = !!msg.payload?.enabled;
        await saveStateToStorage();
        applyStateToDom();
        return sendResponse({ ok: true, state });
      }

      if (msg.type === "SET_INTENSITY") {
        const v = Number(msg.payload?.intensity);
        state.intensity = Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : state.intensity;
        await saveStateToStorage();
        applyStateToDom();
        return sendResponse({ ok: true, state });
      }

      if (msg.type === "TOGGLE_ASSIST") {
        const key = msg.payload?.assistKey;
        if (key && Object.prototype.hasOwnProperty.call(state.assists, key)) {
          state.assists[key] = !state.assists[key];
          await saveStateToStorage();
          applyStateToDom();
        }
        return sendResponse({ ok: true, state });
      }

      if (msg.type === "APPLY_RECOMMENDED") {
        const payload = msg.payload || {};
        if (typeof payload.intensity === "number") {
          state.intensity = Math.max(0, Math.min(1, payload.intensity));
        }
        if (payload.assists && typeof payload.assists === "object") {
          for (const [k, v] of Object.entries(payload.assists)) {
            if (Object.prototype.hasOwnProperty.call(state.assists, k) && typeof v === "boolean") {
              state.assists[k] = v;
            }
          }
        }
        await saveStateToStorage();
        applyStateToDom();
        return sendResponse({ ok: true, state });
      }

      if (msg.type === "REFRESH_RECOMMENDATIONS") {
        maybeRefreshAIRecommendations();
        return sendResponse({ ok: true });
      }

      return sendResponse({ ok: false, error: "unknown-type" });
    } catch (e) {
      return sendResponse({ ok: false, error: String(e?.message || e) });
      .${CONFIG.PREFIX}-select-btn:hover {
        background: #e5e7eb;
      }

      .${CONFIG.PREFIX}-select-btn.active {
        background: #2563eb;
        color: white;
        border-color: #2563eb;
      }

      .${CONFIG.PREFIX}-toast {
        position: fixed;
        bottom: 100px;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(0, 0, 0, 0.9);
        color: white;
        padding: 12px 16px;
        border-radius: 8px;
        font-size: 13px;
        z-index: ${CONFIG.Z_INDEX - 2};
      }
    `;
    document.head.appendChild(style);
  }

  let cursorOverlay = null;
  let rafId = null;
  let lastMousePos = { x: 0, y: 0 };

  function applyCursorStyles() {
    const htmlEl = document.documentElement;

    if (state.cursorSize === 'normal') {
      if (cursorOverlay) cursorOverlay.style.display = 'none';
      if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
      htmlEl.style.cursor = 'auto';
    } else {
      htmlEl.style.cursor = 'none';
      showCursorOverlay(state.cursorSize, state.cursorColour);
    }
  }

  function showCursorOverlay(size, colour) {
    if (!cursorOverlay) {
      cursorOverlay = document.createElement('div');
      cursorOverlay.id = `${CONFIG.PREFIX}-cursor-magnifier`;
      cursorOverlay.style.cssText = `
        position: fixed;
        pointer-events: none;
        z-index: ${CONFIG.Z_INDEX - 2};
        display: none;
      `;
      document.body.appendChild(cursorOverlay);

      document.addEventListener('mousemove', (e) => {
        lastMousePos.x = e.clientX;
        lastMousePos.y = e.clientY;
      });
    }

    cursorOverlay.style.display = 'block';

    const sizes = { 'enhanced': 48, 'large': 72 };
    const pixelSize = sizes[size] || 48;
    const arrowColour = CONFIG.CURSOR_COLOURS[colour] || '#2563eb';
    const strokeWidth = Math.max(1.5, (3 * pixelSize) / 48);

    // Symmetric teardrop cursor: tip at -12px, width 20px, height 28px
    const teardropSVG = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 28" width="${pixelSize}" height="${Math.round(pixelSize * 1.167)}" preserveAspectRatio="xMidYMid meet" style="position:absolute; left:0; top:0;">
        <path d="M 10 0 C 14.4 4.8 18 10.5 18 15.5 C 18 21 14.9 25.5 10 25.5 C 5.1 25.5 2 21 2 15.5 C 2 10.5 5.6 4.8 10 0 Z" 
              fill="${arrowColour}" 
              stroke="#111111" 
              stroke-width="${strokeWidth}"
              stroke-linejoin="round"
              stroke-linecap="round"
              opacity="0.95"/>
      </svg>
    `;

    cursorOverlay.innerHTML = teardropSVG;

    if (!rafId) {
      function updateCursorPosition() {
        if (cursorOverlay && cursorOverlay.style.display === 'block') {
          // Offset so tip of teardrop (top point) aligns with actual cursor
          cursorOverlay.style.left = (lastMousePos.x - pixelSize * 0.5) + 'px';
          cursorOverlay.style.top = (lastMousePos.y - pixelSize * 0.1) + 'px';
        }
        rafId = requestAnimationFrame(updateCursorPosition);
      }
      rafId = requestAnimationFrame(updateCursorPosition);
    }
  }

  function setCursorSize(size) {
    state.cursorSize = size;
    applyCursorStyles();
    saveSettings();
    updatePanelUI();
  }

  function setCursorColour(colour) {
    state.cursorColour = colour;
    applyCursorStyles();
    saveSettings();
    updatePanelUI();
  }

  function createPanel() {
    const panel = document.createElement('div');
    panel.id = `${CONFIG.PREFIX}-panel`;
    panel.className = `${CONFIG.PREFIX}-panel`;

    panel.innerHTML = `
      <div class="${CONFIG.PREFIX}-panel-header">
        <div class="${CONFIG.PREFIX}-panel-title">Cursor</div>
        <button class="${CONFIG.PREFIX}-panel-close">×</button>
      </div>

      <div class="${CONFIG.PREFIX}-panel-body">
        <div class="${CONFIG.PREFIX}-section">
          <div class="${CONFIG.PREFIX}-label">Size</div>
          <div class="${CONFIG.PREFIX}-select">
            <button class="${CONFIG.PREFIX}-select-btn ${state.cursorSize === 'normal' ? 'active' : ''}" data-cursor-size="normal">Normal</button>
            <button class="${CONFIG.PREFIX}-select-btn ${state.cursorSize === 'enhanced' ? 'active' : ''}" data-cursor-size="enhanced">Enhanced</button>
            <button class="${CONFIG.PREFIX}-select-btn ${state.cursorSize === 'large' ? 'active' : ''}" data-cursor-size="large">Large</button>
          </div>
        </div>

        <div class="${CONFIG.PREFIX}-section">
          <div class="${CONFIG.PREFIX}-label">Colour</div>
          <div class="${CONFIG.PREFIX}-select" style="grid-template-columns: 1fr 1fr;">
            <button class="${CONFIG.PREFIX}-select-btn ${state.cursorColour === 'blue' ? 'active' : ''}" data-cursor-colour="blue">Blue</button>
            <button class="${CONFIG.PREFIX}-select-btn ${state.cursorColour === 'teal' ? 'active' : ''}" data-cursor-colour="teal">Teal</button>
            <button class="${CONFIG.PREFIX}-select-btn ${state.cursorColour === 'purple' ? 'active' : ''}" data-cursor-colour="purple">Purple</button>
            <button class="${CONFIG.PREFIX}-select-btn ${state.cursorColour === 'coral' ? 'active' : ''}" data-cursor-colour="coral">Coral</button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(panel);
    attachPanelListeners(panel);
  }

  function attachPanelListeners(panel) {
    panel.querySelector(`.${CONFIG.PREFIX}-panel-close`).addEventListener('click', hidePanel);

    panel.querySelectorAll(`[data-cursor-size]`).forEach(btn => {
      btn.addEventListener('click', () => setCursorSize(btn.dataset.cursorSize));
    });

    panel.querySelectorAll(`[data-cursor-colour]`).forEach(btn => {
      btn.addEventListener('click', () => setCursorColour(btn.dataset.cursorColour));
    });
  }
  function updatePanelUI() {
    const panel = document.getElementById(`${CONFIG.PREFIX}-panel`);
    if (!panel) return;

    panel.querySelectorAll(`[data-cursor-size]`).forEach(btn => {
      btn.classList.toggle('active', btn.dataset.cursorSize === state.cursorSize);
    });

    panel.querySelectorAll(`[data-cursor-colour]`).forEach(btn => {
      btn.classList.toggle('active', btn.dataset.cursorColour === state.cursorColour);
    });
  }

  function hidePanel() {
    const panel = document.getElementById(`${CONFIG.PREFIX}-panel`);
    if (panel) panel.remove();
  }

  function showPanel() {
    if (document.getElementById(`${CONFIG.PREFIX}-panel`)) return;
    createPanel();
  }

  function togglePanel() {
    if (document.getElementById(`${CONFIG.PREFIX}-panel`)) {
      hidePanel();
    } else {
      showPanel();
    }
  }

  function getOrbSVG() {
    const dots = [];
    const radius = 8;
    const dotRadius = 1.4;
    
    // 8 evenly spaced dots in a perfect circle
    for (let i = 0; i < 8; i++) {
      const angle = (i * Math.PI * 2) / 8 - Math.PI / 2; // Start from top
      const x = 12 + radius * Math.cos(angle);
      const y = 12 + radius * Math.sin(angle);
      dots.push(`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${dotRadius}" fill="white"/>`);
    }
    
    return `
      <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        ${dots.join('')}
        <circle cx="12" cy="12" r="2.8" fill="white"/>
      </svg>
    `;
  }

  function createOrb() {
    const orb = document.createElement('button');
    orb.id = `${CONFIG.PREFIX}-orb`;
    orb.className = `${CONFIG.PREFIX}-orb`;
    orb.innerHTML = getOrbSVG();
    orb.setAttribute('aria-label', 'Cursor Controls');

    // Set initial position
    if (state.orbX !== null && state.orbY !== null) {
      orb.style.left = state.orbX + 'px';
      orb.style.top = state.orbY + 'px';
    } else {
      orb.style.right = '24px';
      orb.style.top = '50%';
      orb.style.transform = 'translateY(-50%)';
    }
  })();

  return true;
});

// ---------- init ----------
(async function init() {
  await loadStateFromStorage();
  applyStateToDom();

  // refresh signals on user interaction
  window.addEventListener("scroll", maybeRefreshAIRecommendations, { passive: true });
  window.addEventListener("click", maybeRefreshAIRecommendations, { passive: true });
  window.addEventListener("keydown", maybeRefreshAIRecommendations, { passive: true });

  // initial signal push
  maybeRefreshAIRecommendations();
    let dragStartX = 0;
    let dragStartY = 0;
    let hasMovedEnough = false;

    orb.addEventListener('pointerdown', (e) => {
      state.isDraggingOrb = true;
      hasMovedEnough = false;
      dragStartX = e.clientX;
      dragStartY = e.clientY;

      const rect = orb.getBoundingClientRect();
      state.dragOffsetX = e.clientX - rect.left;
      state.dragOffsetY = e.clientY - rect.top;
      orb.style.transition = 'none';
      orb.setPointerCapture(e.pointerId);
    });

    document.addEventListener('pointermove', (e) => {
      if (!state.isDraggingOrb) return;

      const dx = Math.abs(e.clientX - dragStartX);
      const dy = Math.abs(e.clientY - dragStartY);

      if (!hasMovedEnough && (dx > 6 || dy > 6)) {
        hasMovedEnough = true;
        orb.style.cursor = 'grabbing';
      }

      if (hasMovedEnough) {
        const newX = e.clientX - state.dragOffsetX;
        const newY = e.clientY - state.dragOffsetY;

        orb.style.left = newX + 'px';
        orb.style.top = newY + 'px';
        orb.style.right = 'auto';
        orb.style.transform = 'none';
      }
    });

    document.addEventListener('pointerup', (e) => {
      if (state.isDraggingOrb) {
        state.isDraggingOrb = false;
        orb.style.cursor = 'grab';

        if (hasMovedEnough) {
          const rect = orb.getBoundingClientRect();
          state.orbX = rect.left;
          state.orbY = rect.top;
          saveSettings();
        } else {
          togglePanel();
        }

        orb.style.transition = 'box-shadow 0.2s ease';
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') hidePanel();
    });

    document.addEventListener('click', (e) => {
      if (!e.target.closest(`#${CONFIG.PREFIX}-orb`) && !e.target.closest(`#${CONFIG.PREFIX}-panel`)) {
        hidePanel();
      }
    });

    document.body.appendChild(orb);
  }

  async function init() {
    await loadSettings();
    injectStyleSheet();
    createOrb();
    applyCursorStyles();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
