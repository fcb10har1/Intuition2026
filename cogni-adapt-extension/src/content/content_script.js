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

    const sizes = { 'enhanced': 48, 'large': 72 };
    const pixelSize = sizes[size] || 48;
    const arrowColour = CONFIG.CURSOR_COLOURS[colour] || '#2563eb';
    const strokeWidth = (2 * pixelSize) / 48;

    const teardropSVG = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 32" width="${pixelSize}" height="${pixelSize}" preserveAspectRatio="xMinYMin meet">
        <path d="M 12 2 C 16 6 20 12 20 17 C 20 23 16.4 28 12 28 C 7.6 28 4 23 4 17 C 4 12 8 6 12 2 Z" 
              fill="${arrowColour}" 
              stroke="#111111" 
              stroke-width="${strokeWidth}"
              stroke-linejoin="round"
              stroke-linecap="round"/>
      </svg>
    `;

    cursorOverlay.innerHTML = teardropSVG;

    if (!rafId) {
      function updateCursorPosition() {
        if (cursorOverlay && cursorOverlay.style.display === 'block') {
          cursorOverlay.style.left = lastMousePos.x + 'px';
          cursorOverlay.style.top = lastMousePos.y + 'px';
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
          <div class="${CONFIG.PREFIX}-select">
            <button class="${CONFIG.PREFIX}-select-btn ${state.cursorColour === 'blue' ? 'active' : ''}" data-cursor-colour="blue">Blue</button>
            <button class="${CONFIG.PREFIX}-select-btn ${state.cursorColour === 'teal' ? 'active' : ''}" data-cursor-colour="teal">Teal</button>
            <button class="${CONFIG.PREFIX}-select-btn ${state.cursorColour === 'purple' ? 'active' : ''}" data-cursor-colour="purple">Purple</button>
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
    for (let i = 0; i < 8; i++) {
      const angle = (i * Math.PI * 2) / 8;
      const x = 12 + 7 * Math.cos(angle);
      const y = 12 + 7 * Math.sin(angle);
      dots.push(`<circle cx="${x}" cy="${y}" r="1.2" fill="white"/>`);
    }
    return `
      <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        ${dots.join('')}
        <circle cx="12" cy="12" r="2.5" fill="white"/>
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
      orb.style.right = '32px';
      orb.style.top = '50%';
      orb.style.transform = 'translateY(-50%)';
    }

    let isClickDrag = false;
    let clickTimeout;

    orb.addEventListener('mousedown', (e) => {
      state.isDraggingOrb = true;
      isClickDrag = false;
      clickTimeout = setTimeout(() => {
        isClickDrag = true;
      }, 100);

      const rect = orb.getBoundingClientRect();
      state.dragOffsetX = e.clientX - rect.left;
      state.dragOffsetY = e.clientY - rect.top;
      orb.style.transition = 'none';
    });

    document.addEventListener('mousemove', (e) => {
      if (!state.isDraggingOrb) return;

      const newX = e.clientX - state.dragOffsetX;
      const newY = e.clientY - state.dragOffsetY;

      orb.style.left = newX + 'px';
      orb.style.top = newY + 'px';
      orb.style.right = 'auto';
      orb.style.transform = 'none';
    });

    document.addEventListener('mouseup', () => {
      if (state.isDraggingOrb) {
        clearTimeout(clickTimeout);
        state.isDraggingOrb = false;

        const rect = orb.getBoundingClientRect();
        state.orbX = rect.left;
        state.orbY = rect.top;
        saveSettings();

        orb.style.transition = 'box-shadow 0.2s ease';

        if (!isClickDrag) {
          togglePanel();
        }
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
