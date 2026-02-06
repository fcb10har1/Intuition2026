/**
 * Content Script - Focus Mode Manager
 * Receives popup messages: TOGGLE_FOCUS, SET_INTENSITY
 */

(() => {
  if (window.__COGNI_FOCUS_INIT__) return;
  window.__COGNI_FOCUS_INIT__ = true;

  const HTML = document.documentElement;
  const STYLE_ID = "cogni-focus-style";
  const TOAST_ID = "cogni-focus-toast";
  const DEFAULT_LEVEL = "med";

  function normalizeLevel(level) {
    if (level === "mild" || level === "med" || level === "strong") return level;
    return DEFAULT_LEVEL;
  }

  function injectCssOnce() {
    if (document.getElementById(STYLE_ID)) return;
    const link = document.createElement("link");
    link.id = STYLE_ID;
    link.rel = "stylesheet";
    link.type = "text/css";
    link.href = chrome.runtime.getURL("src/content/adapt/css/focus_mode.css");
    (document.head || document.documentElement).appendChild(link);
  }

  function setFocusEnabled(enabled) {
    HTML.dataset.cogFocus = enabled ? "on" : "off";
  }

  function setLevel(level) {
    HTML.dataset.cogLevel = level;
  }

  function showToast(text) {
    let toast = document.getElementById(TOAST_ID);
    if (!toast) {
      toast = document.createElement("div");
      toast.id = TOAST_ID;
      toast.style.position = "fixed";
      toast.style.right = "16px";
      toast.style.bottom = "16px";
      toast.style.zIndex = "2147483647";
      toast.style.maxWidth = "280px";
      toast.style.padding = "10px 12px";
      toast.style.borderRadius = "12px";
      toast.style.fontFamily = "system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif";
      toast.style.fontSize = "13px";
      toast.style.lineHeight = "1.2";
      toast.style.background = "rgba(20, 20, 20, 0.92)";
      toast.style.color = "#fff";
      toast.style.boxShadow = "0 8px 20px rgba(0,0,0,0.25)";
      toast.style.backdropFilter = "blur(8px)";
      toast.style.border = "1px solid rgba(255,255,255,0.12)";
      toast.style.opacity = "0";
      toast.style.transition = "opacity 120ms ease";
      document.documentElement.appendChild(toast);
    }
    toast.textContent = text;
    toast.style.opacity = "1";
    if (toast.__hideTimer) clearTimeout(toast.__hideTimer);
    toast.__hideTimer = setTimeout(() => {
      toast.style.opacity = "0";
    }, 1800);
  }

  function apply(enabled, level, announce = true) {
    injectCssOnce();
    setFocusEnabled(enabled);
    setLevel(level);
    if (announce) {
      if (enabled) showToast(`Focus Mode: ON (${level})`);
      else showToast("Focus Mode: OFF");
    }
  }

  async function loadInitialStateFromStorage() {
    try {
      const res = await chrome.storage.sync.get(["focusEnabled", "intensityLevel"]);
      const enabled = typeof res.focusEnabled === "boolean" ? res.focusEnabled : false;
      const level = normalizeLevel(res.intensityLevel);
      apply(enabled, level, false);
    } catch (e) {
      apply(false, DEFAULT_LEVEL, false);
    }
  }

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (!msg || typeof msg.type !== "string") return;

    if (msg.type === "TOGGLE_FOCUS") {
      const enabled = !!msg.enabled;
      const currentLevel = normalizeLevel(HTML.dataset.cogLevel);
      apply(enabled, currentLevel, true);
      sendResponse?.({ ok: true });
      return true;
    }

    cursorOverlay.style.display = 'block';

    const sizes = { 'enhanced': 40, 'large': 56 };
    const pixelSize = sizes[size] || 40;
    const cursorColour = CONFIG.CURSOR_COLOURS[colour] || '#2563eb';

    // Clip art style pointing hand cursor - thick outline, rounded
    const handCursorSVG = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 50" width="${pixelSize}" height="${Math.round(pixelSize * 1.25)}" preserveAspectRatio="xMidYMid meet" style="position:absolute; left:0; top:0;">
        <!-- Index finger -->
        <path d="M 18 2 Q 20 2 22 3 Q 25 5 25 10 L 25 20 Q 25 24 22 26 L 18 26 Q 15 24 15 20 L 15 5 Q 15 2 18 2" 
              fill="${cursorColour}" 
              stroke="#1a1a1a" 
              stroke-width="2.2"
              stroke-linejoin="round"
              stroke-linecap="round"/>
        
        <!-- Middle finger -->
        <path d="M 26 10 Q 28 10 30 11 Q 32 13 32 18 Q 32 22 30 24 Q 28 25 26 25 L 26 15" 
              fill="${cursorColour}" 
              stroke="#1a1a1a" 
              stroke-width="2.2"
              stroke-linejoin="round"
              stroke-linecap="round"/>
        
        <!-- Ring finger -->
        <path d="M 32 18 Q 34 18 35 19 Q 37 21 37 25 Q 37 28 35 29 Q 33 30 31 30 L 31 22" 
              fill="${cursorColour}" 
              stroke="#1a1a1a" 
              stroke-width="2.2"
              stroke-linejoin="round"
              stroke-linecap="round"/>
        
        <!-- Pinky finger -->
        <path d="M 37 25 Q 38 26 38 28 Q 38 31 36 32 Q 34 33 32 33 L 32 27" 
              fill="${cursorColour}" 
              stroke="#1a1a1a" 
              stroke-width="2.2"
              stroke-linejoin="round"
              stroke-linecap="round"/>
        
        <!-- Thumb -->
        <path d="M 15 18 Q 12 20 10 23 Q 8 25 10 28 Q 13 29 16 26 L 16 22" 
              fill="${cursorColour}" 
              stroke="#1a1a1a" 
              stroke-width="2.2"
              stroke-linejoin="round"
              stroke-linecap="round"/>
        
        <!-- Palm/base -->
        <ellipse cx="22" cy="33" rx="12" ry="10" 
                 fill="${cursorColour}" 
                 stroke="#1a1a1a" 
                 stroke-width="2.2"
                 stroke-linejoin="round"/>
        
        <!-- Connect palm to fingers -->
        <path d="M 15 26 L 16 32 L 32 33 L 32 27" 
              fill="none"
              stroke="#1a1a1a" 
              stroke-width="2.2"
              stroke-linejoin="round"
              stroke-linecap="round"/>
      </svg>
    `;

    cursorOverlay.innerHTML = handCursorSVG;

    if (!rafId) {
      function updateCursorPosition() {
        if (cursorOverlay && cursorOverlay.style.display === 'block') {
          // Position so index finger tip aligns with cursor
          cursorOverlay.style.left = (lastMousePos.x - pixelSize * 0.3) + 'px';
          cursorOverlay.style.top = (lastMousePos.y - pixelSize * 0.08) + 'px';
        }
        rafId = requestAnimationFrame(updateCursorPosition);
      }
      rafId = requestAnimationFrame(updateCursorPosition);
    }
  }
          cursorOverlay.style.left = (lastMousePos.x - pixelSize * 0.4) + 'px';
          cursorOverlay.style.top = (lastMousePos.y - pixelSize * 0.05) + 'px';
        }
        rafId = requestAnimationFrame(updateCursorPosition);
      }
      rafId = requestAnimationFrame(updateCursorPosition);
    if (msg.type === "SET_INTENSITY") {
      const level = normalizeLevel(msg.level);
      const enabled = HTML.dataset.cogFocus === "on";
      apply(enabled, level, true);
      sendResponse?.({ ok: true });
      return true;
    }
  });

<<<<<<< HEAD
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
    // Prevent duplicate orbs
    if (document.getElementById(`${CONFIG.PREFIX}-orb`)) return;
    
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

  // Only call init once
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
=======
  void loadInitialStateFromStorage();
>>>>>>> 2c20c989c2d4e8fbfb1d3a2616875ebbc0a780af
})();





