/**
 * Accessibility Layer - Content Script (Complete Rewrite)
 * Professional, minimal, functional UI injected into webpages
 */

(() => {
  'use strict';

  // ============================================================================
  // CONFIGURATION
  // ============================================================================

  const CONFIG = {
    PREFIX: 'a11y',
    STORAGE_KEY: 'a11y_settings',
    Z_INDEX: 2147483640,
    CURSOR_DEFAULTS: {
      size: 'normal',
      colour: 'blue'
    },
    CURSOR_SIZES: {
      normal: { overlay: false },
      enhanced: { overlay: true, size: '32px' },
      large: { overlay: true, size: '48px' }
    },
    CURSOR_COLOURS: {
      blue: '#2563eb',
      teal: '#0d9488',
      purple: '#7c3aed',
      coral: '#f97316'
    }
  };

  // ============================================================================
  // STATE & ACTION HISTORY
  // ============================================================================

  let state = {
    focusMode: false,
    dyslexiaMode: false,
    largeUIMode: false,
    distractionCleaner: false,
    cursorSize: CONFIG.CURSOR_DEFAULTS.size,
    cursorColour: CONFIG.CURSOR_DEFAULTS.colour,
    hiddenElements: [], // Track elements hidden by distraction cleaner
  };

  let actionHistory = []; // Stack for undo

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

  // ============================================================================
  // ACTION HISTORY (for undo/reset)
  // ============================================================================

  function recordAction(action) {
    actionHistory.push(action);
  }

  function undo() {
    const last = actionHistory.pop();
    if (!last) return;

    switch (last.type) {
      case 'toggle_mode':
        toggleMode(last.mode, true); // Don't record undo itself
        break;
      case 'cursor_change':
        restoreCursor(last.previous);
        break;
    }
  }

  function reset() {
    // Revert all modes
    state.focusMode && toggleMode('focus', true);
    state.dyslexiaMode && toggleMode('dyslexia', true);
    state.largeUIMode && toggleMode('largeUI', true);
    state.distractionCleaner && toggleMode('distractionCleaner', true);

    // Restore cursor to defaults
    state.cursorSize = CONFIG.CURSOR_DEFAULTS.size;
    state.cursorColour = CONFIG.CURSOR_DEFAULTS.colour;
    applyCursorStyles();

    // Clear history
    actionHistory = [];
  }

  // ============================================================================
  // STYLING & INJECTION
  // ============================================================================

  function injectStyleSheet() {
    if (document.getElementById(`${CONFIG.PREFIX}-styles`)) return;

    const style = document.createElement('style');
    style.id = `${CONFIG.PREFIX}-styles`;
    style.textContent = getStylesCSS();
    document.head.appendChild(style);
  }

  function getStylesCSS() {
    return `
      /* Accessibility Layer Styles */
      
      /* === FLOATING BUTTON === */
      .${CONFIG.PREFIX}-orb {
        position: fixed;
        bottom: 32px;
        right: 32px;
        z-index: ${CONFIG.Z_INDEX};
        width: 56px;
        height: 56px;
        background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
        border: none;
        border-radius: 50%;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 4px 16px rgba(37, 99, 235, 0.3);
        transition: all 0.2s ease;
        padding: 0;
        font-size: 0;
      }

      .${CONFIG.PREFIX}-orb:hover {
        transform: scale(1.08);
        box-shadow: 0 6px 24px rgba(37, 99, 235, 0.4);
      }

      .${CONFIG.PREFIX}-orb:active {
        transform: scale(0.96);
      }

      .${CONFIG.PREFIX}-orb:focus-visible {
        outline: 2px solid #2563eb;
        outline-offset: 2px;
      }

      .${CONFIG.PREFIX}-orb svg {
        width: 28px;
        height: 28px;
        fill: white;
      }

      /* === PANEL === */
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
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 4px;
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

      .${CONFIG.PREFIX}-panel-body::-webkit-scrollbar {
        width: 6px;
      }

      .${CONFIG.PREFIX}-panel-body::-webkit-scrollbar-thumb {
        background: #cbd5e1;
        border-radius: 3px;
      }

      /* === SECTION === */
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

      /* === TOGGLE BUTTONS (Modes) === */
      .${CONFIG.PREFIX}-mode-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 8px;
      }

      .${CONFIG.PREFIX}-mode-btn {
        padding: 12px;
        background: #f9fafb;
        border: 2px solid #e5e7eb;
        border-radius: 10px;
        cursor: pointer;
        font-size: 13px;
        font-weight: 600;
        color: #374151;
        transition: all 0.2s;
        font-family: inherit;
      }

      .${CONFIG.PREFIX}-mode-btn:hover {
        border-color: #2563eb;
        background: #f0f7ff;
      }

      .${CONFIG.PREFIX}-mode-btn.active {
        background: #dbeafe;
        border-color: #2563eb;
        color: #1d4ed8;
      }

      /* === SELECT / SEGMENTED CONTROL === */
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
        font-family: inherit;
      }

      .${CONFIG.PREFIX}-select-btn:hover {
        background: #e5e7eb;
      }

      .${CONFIG.PREFIX}-select-btn.active {
        background: #2563eb;
        color: white;
        border-color: #2563eb;
      }

      /* === ACTION BUTTONS === */
      .${CONFIG.PREFIX}-action-group {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 8px;
      }

      .${CONFIG.PREFIX}-action-btn {
        padding: 12px;
        background: #f3f4f6;
        border: 1px solid #e5e7eb;
        border-radius: 10px;
        cursor: pointer;
        font-size: 13px;
        font-weight: 600;
        color: #374151;
        transition: all 0.2s;
        font-family: inherit;
      }

      .${CONFIG.PREFIX}-action-btn:hover {
        background: #e5e7eb;
        border-color: #d1d5db;
      }

      .${CONFIG.PREFIX}-action-btn:active {
        transform: scale(0.98);
      }

      /* === CUSTOM CURSOR OVERLAY === */
      .${CONFIG.PREFIX}-cursor-overlay {
        position: fixed;
        width: var(--cursor-size, 32px);
        height: var(--cursor-size, 32px);
        border: 2px solid;
        border-color: var(--cursor-colour, #2563eb);
        border-radius: 50%;
        pointer-events: none;
        z-index: ${CONFIG.Z_INDEX - 2};
        display: none;
        opacity: 0.8;
        mix-blend-mode: multiply;
      }

      .${CONFIG.PREFIX}-cursor-overlay.active {
        display: block;
      }

      /* === MODES STYLING === */
      
      /* Focus Mode */
      html.${CONFIG.PREFIX}-focus-mode {
        filter: none;
      }

      html.${CONFIG.PREFIX}-focus-mode::before {
        content: '';
        display: none;
      }

      /* Dyslexia Mode */
      html.${CONFIG.PREFIX}-dyslexia-mode {
        font-family: 'Segoe UI', 'Arial', sans-serif;
        letter-spacing: 0.05em;
        line-height: 1.8;
      }

      html.${CONFIG.PREFIX}-dyslexia-mode body {
        background-color: #fffcf0 !important;
      }

      /* Large UI Mode */
      html.${CONFIG.PREFIX}-large-ui-mode button,
      html.${CONFIG.PREFIX}-large-ui-mode [role="button"],
      html.${CONFIG.PREFIX}-large-ui-mode a,
      html.${CONFIG.PREFIX}-large-ui-mode input {
        min-height: 48px !important;
        padding: 16px 20px !important;
        font-size: 16px !important;
      }

      /* Distraction Cleaner */
      html.${CONFIG.PREFIX}-distraction-mode .${CONFIG.PREFIX}-hidden {
        display: none !important;
      }

      /* Tooltip / Feedback */
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
        animation: fadeInUp 0.2s ease;
      }

      @keyframes fadeInUp {
        from {
          opacity: 0;
          transform: translateX(-50%) translateY(8px);
        }
        to {
          opacity: 1;
          transform: translateX(-50%) translateY(0);
        }
      }
    `;
  }

  // ============================================================================
  // MODE TOGGLES
  // ============================================================================

  function toggleMode(mode, skipRecord = false) {
    const recordActionFlag = !skipRecord;

    switch (mode) {
      case 'focus':
        state.focusMode = !state.focusMode;
        document.documentElement.classList.toggle(`${CONFIG.PREFIX}-focus-mode`);
        if (recordActionFlag) recordAction({ type: 'toggle_mode', mode: 'focus' });
        showNotification(state.focusMode ? 'Focus Mode enabled' : 'Focus Mode disabled');
        break;

      case 'dyslexia':
        state.dyslexiaMode = !state.dyslexiaMode;
        document.documentElement.classList.toggle(`${CONFIG.PREFIX}-dyslexia-mode`);
        if (recordActionFlag) recordAction({ type: 'toggle_mode', mode: 'dyslexia' });
        showNotification(state.dyslexiaMode ? 'Dyslexia Mode enabled' : 'Dyslexia Mode disabled');
        break;

      case 'largeUI':
        state.largeUIMode = !state.largeUIMode;
        document.documentElement.classList.toggle(`${CONFIG.PREFIX}-large-ui-mode`);
        if (recordActionFlag) recordAction({ type: 'toggle_mode', mode: 'largeUI' });
        showNotification(state.largeUIMode ? 'Large UI enabled' : 'Large UI disabled');
        break;

      case 'distractionCleaner':
        state.distractionCleaner = !state.distractionCleaner;
        if (state.distractionCleaner) {
          applyDistractionCleaner();
        } else {
          restoreDistractionCleaner();
        }
        document.documentElement.classList.toggle(`${CONFIG.PREFIX}-distraction-mode`);
        if (recordActionFlag) recordAction({ type: 'toggle_mode', mode: 'distractionCleaner' });
        showNotification(state.distractionCleaner ? 'Distraction Cleaner enabled' : 'Distraction Cleaner disabled');
        break;
    }

    saveSettings();
    updatePanelUI();
  }

  // ============================================================================
  // DISTRACTION CLEANER
  // ============================================================================

  const DISTRACTION_SELECTORS = [
    // Ads
    '[class*="ad-"], [id*="ad-"], .advertisement, .advert',
    // Pop-ups / modals
    '[class*="modal"], [class*="popup"], [class*="overlay"]',
    // Newsletter
    '.newsletter, .email-signup, .subscribe',
    // Social buttons
    '.social, [class*="share"]',
    // Tracking pixels
    '[src*="analytics"], [src*="tracking"]'
  ];

  function applyDistractionCleaner() {
    state.hiddenElements = [];
    DISTRACTION_SELECTORS.forEach(selector => {
      try {
        document.querySelectorAll(selector).forEach(el => {
          if (el && el.offsetHeight > 0) {
            el.classList.add(`${CONFIG.PREFIX}-hidden`);
            state.hiddenElements.push(el);
          }
        });
      } catch (e) {
        // Invalid selector
      }
    });
  }

  function restoreDistractionCleaner() {
    state.hiddenElements.forEach(el => {
      if (el && el.parentNode) {
        el.classList.remove(`${CONFIG.PREFIX}-hidden`);
      }
    });
    state.hiddenElements = [];
  }

  // ============================================================================
  // CURSOR CUSTOMIZATION
  // ============================================================================

  function applyCursorStyles() {
    const htmlEl = document.documentElement;

    if (state.cursorSize === 'normal') {
      // Remove cursor overlay
      const overlay = document.getElementById(`${CONFIG.PREFIX}-cursor-overlay`);
      if (overlay) overlay.classList.remove('active');
      htmlEl.style.cursor = 'auto';
    } else {
      // Use custom cursor overlay
      let overlay = document.getElementById(`${CONFIG.PREFIX}-cursor-overlay`);
      if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = `${CONFIG.PREFIX}-cursor-overlay`;
        overlay.className = `${CONFIG.PREFIX}-cursor-overlay active`;
        document.body.appendChild(overlay);
        trackMouseForCursor(overlay);
      }

      overlay.classList.add('active');
      const sizeData = CONFIG.CURSOR_SIZES[state.cursorSize];
      overlay.style.setProperty('--cursor-size', sizeData.size);
      overlay.style.setProperty('--cursor-colour', CONFIG.CURSOR_COLOURS[state.cursorColour]);
      htmlEl.style.cursor = 'none';
    }
  }

  function trackMouseForCursor(overlay) {
    document.addEventListener('mousemove', (e) => {
      const size = parseFloat(overlay.style.getPropertyValue('--cursor-size') || '32px');
      overlay.style.left = (e.clientX - size / 2) + 'px';
      overlay.style.top = (e.clientY - size / 2) + 'px';
    });
  }

  function setCursorSize(size) {
    const prev = state.cursorSize;
    state.cursorSize = size;
    applyCursorStyles();
    recordAction({ type: 'cursor_change', previous: { size: prev, colour: state.cursorColour } });
    saveSettings();
    updatePanelUI();
  }

  function setCursorColour(colour) {
    const prev = state.cursorColour;
    state.cursorColour = colour;
    applyCursorStyles();
    recordAction({ type: 'cursor_change', previous: { size: state.cursorSize, colour: prev } });
    saveSettings();
    updatePanelUI();
  }

  function restoreCursor(previous) {
    state.cursorSize = previous.size;
    state.cursorColour = previous.colour;
    applyCursorStyles();
  }

  // ============================================================================
  // NOTIFICATIONS
  // ============================================================================

  function showNotification(message) {
    const toast = document.createElement('div');
    toast.className = `${CONFIG.PREFIX}-toast`;
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => {
      toast.style.animation = 'fadeInUp 0.2s ease reverse';
      setTimeout(() => toast.remove(), 200);
    }, 2000);
  }

  // ============================================================================
  // UI RENDERING
  // ============================================================================

  function getOrbSVG() {
    return `
      <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path d="M13 2a1 1 0 11-2 0 1 1 0 012 0Z"/>
        <path d="M18.378 5.622a1 1 0 11-1.414-1.414 1 1 0 011.414 1.414Z"/>
        <path d="M21 11a1 1 0 11 0-2 1 1 0 010 2Z"/>
        <path d="M18.378 18.378a1 1 0 11-1.414-1.414 1 1 0 011.414 1.414Z"/>
        <path d="M13 21a1 1 0 11-2 0 1 1 0 012 0Z"/>
        <path d="M5.622 18.378a1 1 0 11-1.414-1.414 1 1 0 011.414 1.414Z"/>
        <path d="M3 13a1 1 0 11 0-2 1 1 0 010 2Z"/>
        <path d="M5.622 5.622a1 1 0 11-1.414-1.414 1 1 0 011.414 1.414Z"/>
        <circle cx="12" cy="12" r="3" fill="currentColor"/>
      </svg>
    `;
  }

  function createPanel() {
    const panel = document.createElement('div');
    panel.id = `${CONFIG.PREFIX}-panel`;
    panel.className = `${CONFIG.PREFIX}-panel`;

    panel.innerHTML = `
      <div class="${CONFIG.PREFIX}-panel-header">
        <div class="${CONFIG.PREFIX}-panel-title">Accessibility</div>
        <button class="${CONFIG.PREFIX}-panel-close" aria-label="Close">
          ×
        </button>
      </div>

      <div class="${CONFIG.PREFIX}-panel-body">
        
        <!-- Modes Section -->
        <div class="${CONFIG.PREFIX}-section">
          <div class="${CONFIG.PREFIX}-label">Modes</div>
          <div class="${CONFIG.PREFIX}-mode-grid">
            <button class="${CONFIG.PREFIX}-mode-btn ${state.focusMode ? 'active' : ''}" data-mode="focus" aria-label="Toggle Focus Mode">
              Focus
            </button>
            <button class="${CONFIG.PREFIX}-mode-btn ${state.dyslexiaMode ? 'active' : ''}" data-mode="dyslexia" aria-label="Toggle Dyslexia Mode">
              Dyslexia
            </button>
            <button class="${CONFIG.PREFIX}-mode-btn ${state.largeUIMode ? 'active' : ''}" data-mode="largeUI" aria-label="Toggle Large UI">
              Large UI
            </button>
            <button class="${CONFIG.PREFIX}-mode-btn ${state.distractionCleaner ? 'active' : ''}" data-mode="distractionCleaner" aria-label="Toggle Distraction Cleaner">
              Clean
            </button>
          </div>
        </div>

        <!-- Cursor Size -->
        <div class="${CONFIG.PREFIX}-section">
          <div class="${CONFIG.PREFIX}-label">Cursor Size</div>
          <div class="${CONFIG.PREFIX}-select">
            <button class="${CONFIG.PREFIX}-select-btn ${state.cursorSize === 'normal' ? 'active' : ''}" data-cursor-size="normal">Normal</button>
            <button class="${CONFIG.PREFIX}-select-btn ${state.cursorSize === 'enhanced' ? 'active' : ''}" data-cursor-size="enhanced">Enhanced</button>
            <button class="${CONFIG.PREFIX}-select-btn ${state.cursorSize === 'large' ? 'active' : ''}" data-cursor-size="large">Large</button>
          </div>
        </div>

        <!-- Cursor Colour -->
        <div class="${CONFIG.PREFIX}-section">
          <div class="${CONFIG.PREFIX}-label">Cursor Colour</div>
          <div class="${CONFIG.PREFIX}-select">
            <button class="${CONFIG.PREFIX}-select-btn ${state.cursorColour === 'blue' ? 'active' : ''}" data-cursor-colour="blue">Blue</button>
            <button class="${CONFIG.PREFIX}-select-btn ${state.cursorColour === 'teal' ? 'active' : ''}" data-cursor-colour="teal">Teal</button>
            <button class="${CONFIG.PREFIX}-select-btn ${state.cursorColour === 'purple' ? 'active' : ''}" data-cursor-colour="purple">Purple</button>
          </div>
        </div>

        <!-- Actions -->
        <div class="${CONFIG.PREFIX}-section">
          <div class="${CONFIG.PREFIX}-action-group">
            <button class="${CONFIG.PREFIX}-action-btn" data-action="undo">Undo</button>
            <button class="${CONFIG.PREFIX}-action-btn" data-action="reset">Reset</button>
          </div>
        </div>

      </div>
    `;

    document.body.appendChild(panel);
    attachPanelListeners(panel);
  }

  function attachPanelListeners(panel) {
    // Close button
    panel.querySelector(`.${CONFIG.PREFIX}-panel-close`).addEventListener('click', hidePanel);

    // Mode buttons
    panel.querySelectorAll(`[data-mode]`).forEach(btn => {
      btn.addEventListener('click', () => {
        toggleMode(btn.dataset.mode);
      });
    });

    // Cursor size
    panel.querySelectorAll(`[data-cursor-size]`).forEach(btn => {
      btn.addEventListener('click', () => {
        setCursorSize(btn.dataset.cursorSize);
      });
    });

    // Cursor colour
    panel.querySelectorAll(`[data-cursor-colour]`).forEach(btn => {
      btn.addEventListener('click', () => {
        setCursorColour(btn.dataset.cursorColour);
      });
    });

    // Actions
    panel.querySelector(`[data-action="undo"]`).addEventListener('click', () => {
      undo();
      updatePanelUI();
    });

    panel.querySelector(`[data-action="reset"]`).addEventListener('click', () => {
      reset();
      updatePanelUI();
      showNotification('Page reset');
    });
  }

  function updatePanelUI() {
    const panel = document.getElementById(`${CONFIG.PREFIX}-panel`);
    if (!panel) return;

    // Update mode buttons
    panel.querySelector(`[data-mode="focus"]`).classList.toggle('active', state.focusMode);
    panel.querySelector(`[data-mode="dyslexia"]`).classList.toggle('active', state.dyslexiaMode);
    panel.querySelector(`[data-mode="largeUI"]`).classList.toggle('active', state.largeUIMode);
    panel.querySelector(`[data-mode="distractionCleaner"]`).classList.toggle('active', state.distractionCleaner);

    // Update cursor size buttons
    panel.querySelectorAll(`[data-cursor-size]`).forEach(btn => {
      btn.classList.toggle('active', btn.dataset.cursorSize === state.cursorSize);
    });

    // Update cursor colour buttons
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

  // ============================================================================
  // ORB BUTTON
  // ============================================================================

  function createOrb() {
    const orb = document.createElement('button');
    orb.id = `${CONFIG.PREFIX}-orb`;
    orb.className = `${CONFIG.PREFIX}-orb`;
    orb.innerHTML = getOrbSVG();
    orb.setAttribute('aria-label', 'Accessibility Controls');
    orb.setAttribute('aria-expanded', 'false');

    orb.addEventListener('click', togglePanel);

    // Close panel on ESC
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') hidePanel();
    });

    // Close panel on outside click
    document.addEventListener('click', (e) => {
      if (!e.target.closest(`#${CONFIG.PREFIX}-orb`) && !e.target.closest(`#${CONFIG.PREFIX}-panel`)) {
        hidePanel();
      }
    });

    document.body.appendChild(orb);
  }

  // ============================================================================
  // INITIALIZATION
  // ============================================================================

  async function init() {
    // Prevent double injection
    if (window.__A11Y_INJECTED__) return;
    window.__A11Y_INJECTED__ = true;

    // Load settings
    await loadSettings();

    // Inject styles
    injectStyleSheet();

    // Create UI
    createOrb();

    // Apply saved settings
    if (state.focusMode) document.documentElement.classList.add(`${CONFIG.PREFIX}-focus-mode`);
    if (state.dyslexiaMode) document.documentElement.classList.add(`${CONFIG.PREFIX}-dyslexia-mode`);
    if (state.largeUIMode) document.documentElement.classList.add(`${CONFIG.PREFIX}-large-ui-mode`);
    if (state.distractionCleaner) {
      applyDistractionCleaner();
      document.documentElement.classList.add(`${CONFIG.PREFIX}-distraction-mode`);
    }

    // Apply cursor settings
    applyCursorStyles();

    console.log('Accessibility layer initialized');
  }

  // Start when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
