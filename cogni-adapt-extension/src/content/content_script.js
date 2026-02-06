/**
 * Accessibility Layer - Content Script
 * Cursor magnification and control orb
 */

(() => {
  'use strict';

  if (window.__A11Y_INJECTED__) return;
  window.__A11Y_INJECTED__ = true;

  const CONFIG = {
    PREFIX: 'a11y',
    STORAGE_KEY: 'a11y_settings',
    Z_INDEX: 2147483640,
    CURSOR_DEFAULTS: {
      size: 'normal',
      colour: 'blue'
    },
    CURSOR_COLOURS: {
      blue: '#2563eb',
      teal: '#0d9488',
      purple: '#7c3aed',
      coral: '#f97316'
    }
  };

  let state = {
    cursorSize: CONFIG.CURSOR_DEFAULTS.size,
    cursorColour: CONFIG.CURSOR_DEFAULTS.colour,
    orbX: null,
    orbY: null,
    isDraggingOrb: false,
    dragOffsetX: 0,
    dragOffsetY: 0
  };

  async function loadSettings() {
    try {
      const stored = await chrome.storage.local.get(CONFIG.STORAGE_KEY);
      if (stored[CONFIG.STORAGE_KEY]) {
        state = { ...state, ...stored[CONFIG.STORAGE_KEY] };
      }
    } catch (e) {
      console.warn('Failed to load settings:', e);
    }
  }

  async function saveSettings() {
    try {
      await chrome.storage.local.set({ [CONFIG.STORAGE_KEY]: state });
    } catch (e) {
      console.warn('Failed to save settings:', e);
    }
  }

  function injectStyleSheet() {
    if (document.getElementById(`${CONFIG.PREFIX}-styles`)) return;

    const style = document.createElement('style');
    style.id = `${CONFIG.PREFIX}-styles`;
    style.textContent = `
      .${CONFIG.PREFIX}-orb {
        position: fixed;
        z-index: ${CONFIG.Z_INDEX};
        width: 56px;
        height: 56px;
        background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
        border: none;
        border-radius: 50%;
        cursor: grab;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 4px 16px rgba(37, 99, 235, 0.3);
        transition: box-shadow 0.2s ease;
        padding: 0;
        font-size: 0;
        user-select: none;
      }

      .${CONFIG.PREFIX}-orb:active {
        cursor: grabbing;
      }

      .${CONFIG.PREFIX}-orb:hover {
        box-shadow: 0 6px 24px rgba(37, 99, 235, 0.4);
      }

      .${CONFIG.PREFIX}-orb svg {
        width: 28px;
        height: 28px;
        fill: white;
      }

      .${CONFIG.PREFIX}-panel {
        position: fixed;
        bottom: 96px;
        right: 32px;
        z-index: ${CONFIG.Z_INDEX - 1};
        width: 320px;
        background: #ffffff;
        border-radius: 16px;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.12);
        border: 1px solid #e5e7eb;
        overflow: hidden;
        display: flex;
        flex-direction: column;
        max-height: 75vh;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        animation: slideUp 0.2s ease;
      }

      @keyframes slideUp {
        from {
          opacity: 0;
          transform: translateY(12px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }

      .${CONFIG.PREFIX}-panel-header {
        padding: 20px;
        border-bottom: 1px solid #e5e7eb;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }

      .${CONFIG.PREFIX}-panel-title {
        font-size: 16px;
        font-weight: 600;
        color: #111827;
      }

      .${CONFIG.PREFIX}-panel-close {
        background: none;
        border: none;
        font-size: 20px;
        color: #6b7280;
        cursor: pointer;
        padding: 4px;
        transition: all 0.2s;
      }

      .${CONFIG.PREFIX}-panel-close:hover {
        background: #f3f4f6;
        color: #111827;
      }

      .${CONFIG.PREFIX}-panel-body {
        flex: 1;
        overflow-y: auto;
        padding: 20px;
        display: flex;
        flex-direction: column;
        gap: 20px;
      }

      .${CONFIG.PREFIX}-section {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }

      .${CONFIG.PREFIX}-label {
        font-size: 12px;
        font-weight: 700;
        color: #6b7280;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }

      .${CONFIG.PREFIX}-select {
        display: grid;
        grid-template-columns: 1fr 1fr 1fr;
        gap: 6px;
      }

      .${CONFIG.PREFIX}-select-btn {
        padding: 10px;
        background: #f3f4f6;
        border: 1px solid #e5e7eb;
        border-radius: 8px;
        cursor: pointer;
        font-size: 12px;
        font-weight: 600;
        color: #6b7280;
        transition: all 0.15s;
      }

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
})();
