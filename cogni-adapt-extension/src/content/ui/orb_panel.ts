/**
 * src/content/ui/orb_panel.ts
 * Floating Accessibility Orb - Main UI Component
 * 
 * This file creates the floating orb and its panel UI
 */

export interface OrbModes {
  focus: boolean;
  dyslexia: boolean;
  elderly: boolean;
  distractionKiller: boolean;
}

export class AccessibilityOrb {
  private orbElement: HTMLButtonElement | null = null;
  private panelElement: HTMLDivElement | null = null;
  private isOpen = false;
  private modes: OrbModes = {
    focus: false,
    dyslexia: false,
    elderly: false,
    distractionKiller: false
  };

  constructor() {
    this.loadModes();
  }

  /**
   * Initialize the orb - call this when page loads
   */
  init() {
    this.injectOrbStyles();
    this.createOrb();
    this.attachEventListeners();
    console.log('✅ Accessibility Orb initialized');
  }

  /**
   * Inject CSS styles for the orb
   */
  private injectOrbStyles() {
    if (document.getElementById('cogni-orb-styles')) return;

    const link = document.createElement('link');
    link.id = 'cogni-orb-styles';
    link.rel = 'stylesheet';
    link.href = chrome.runtime.getURL('src/content/adapt/css/orb.css');
    document.head.appendChild(link);
  }

  /**
   * Create the floating orb button
   */
  private createOrb() {
    if (this.orbElement) return;

    this.orbElement = document.createElement('button');
    this.orbElement.className = 'cogni-orb';
    this.orbElement.innerHTML = '♿';
    this.orbElement.title = 'Open Accessibility Controls';
    this.orbElement.setAttribute('aria-label', 'Accessibility Controls');

    document.body.appendChild(this.orbElement);
  }

  /**
   * Create the panel that opens when orb is clicked
   */
  private createPanel() {
    if (this.panelElement) return;

    this.panelElement = document.createElement('div');
    this.panelElement.className = 'cogni-orb-panel';
    this.panelElement.innerHTML = `
      <div class="cogni-orb-panel-header">
        <span>Accessibility Controls</span>
        <button class="cogni-orb-close-btn" aria-label="Close">✕</button>
      </div>
      <div class="cogni-orb-content">
        
        <!-- Mode Selection Grid -->
        <div style="margin-bottom: 16px;">
          <label class="cogni-control-label">Quick Modes</label>
          <div class="cogni-mode-grid">
            <button class="cogni-mode-btn ${this.modes.focus ? 'active' : ''}" data-mode="focus">
              <span class="cogni-mode-icon">🎯</span>
              <span>Focus</span>
            </button>
            <button class="cogni-mode-btn ${this.modes.dyslexia ? 'active' : ''}" data-mode="dyslexia">
              <span class="cogni-mode-icon">📖</span>
              <span>Dyslexia</span>
            </button>
            <button class="cogni-mode-btn ${this.modes.elderly ? 'active' : ''}" data-mode="elderly">
              <span class="cogni-mode-icon">👁️</span>
              <span>Large UI</span>
            </button>
            <button class="cogni-mode-btn ${this.modes.distractionKiller ? 'active' : ''}" data-mode="distractionKiller">
              <span class="cogni-mode-icon">🚫</span>
              <span>No Ads</span>
            </button>
          </div>
        </div>

        <div class="cogni-divider"></div>

        <!-- Font Size Control -->
        <div class="cogni-control-item">
          <label class="cogni-control-label">Font Size</label>
          <div style="display: flex; align-items: center; gap: 10px;">
            <span style="font-size: 12px;">A</span>
            <input type="range" class="cogni-slider" id="fontSizeSlider" min="12" max="24" value="16">
            <span style="font-size: 18px;">A</span>
          </div>
        </div>

        <div class="cogni-divider"></div>

        <!-- Additional Controls -->
        <div class="cogni-control-item">
          <label class="cogni-toggle active" style="cursor: pointer">
            <input type="checkbox" checked style="display: none;">
            <span style="font-weight: 500; font-size: 13px; display: block; padding: 8px 0;">Dark Mode</span>
          </label>
        </div>

        <div class="cogni-divider"></div>

        <!-- Action Buttons -->
        <button class="cogni-btn cogni-btn-secondary">📋 View Dashboard</button>
        <button class="cogni-btn cogni-btn-secondary">❓ Help & Tips</button>
        <button class="cogni-btn cogni-btn-secondary">↩️ Undo Changes</button>
        <button class="cogni-btn cogni-btn-secondary">🔄 Reset Page</button>
      </div>
    `;

    document.body.appendChild(this.panelElement);
  }

  /**
   * Attach click listeners to orb and panel buttons
   */
  private attachEventListeners() {
    // Orb toggle
    this.orbElement?.addEventListener('click', () => this.togglePanel());

    // Close button
    document.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      if (target?.classList.contains('cogni-orb-close-btn')) {
        this.closePanel();
      }
    });

    // Mode buttons
    document.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement)?.closest('.cogni-mode-btn');
      if (btn) {
        const mode = btn.getAttribute('data-mode') as keyof OrbModes;
        this.toggleMode(mode);
      }
    });

    // Font size slider
    const fontSlider = this.panelElement?.querySelector('#fontSizeSlider') as HTMLInputElement;
    fontSlider?.addEventListener('change', (e) => {
      const size = (e.target as HTMLInputElement).value;
      this.setFontSize(parseInt(size));
    });
  }

  /**
   * Toggle the panel open/closed
   */
  private togglePanel() {
    if (this.isOpen) {
      this.closePanel();
    } else {
      this.openPanel();
    }
  }

  /**
   * Open the panel
   */
  private openPanel() {
    this.createPanel();
    this.isOpen = true;
    this.orbElement?.classList.add('active');
  }

  /**
   * Close the panel
   */
  private closePanel() {
    this.panelElement?.remove();
    this.panelElement = null;
    this.isOpen = false;
    this.orbElement?.classList.remove('active');
  }

  /**
   * Toggle an accessibility mode
   */
  private toggleMode(mode: keyof OrbModes) {
    this.modes[mode] = !this.modes[mode];
    this.saveModes();

    // Apply the mode
    this.applyMode(mode, this.modes[mode]);

    // Update UI
    this.updateModeButtons();

    // Show toast notification
    this.showToast(`${this.getModeLabel(mode)} ${this.modes[mode] ? 'enabled' : 'disabled'}`);
  }

  /**
   * Update mode button active states
   */
  private updateModeButtons() {
    document.querySelectorAll('.cogni-mode-btn').forEach((btn) => {
      const mode = btn.getAttribute('data-mode');
      if (this.modes[mode as keyof OrbModes]) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
  }

  /**
   * Apply a mode to the page
   */
  private applyMode(mode: keyof OrbModes, enabled: boolean) {
    const html = document.documentElement;

    switch (mode) {
      case 'focus':
        html.dataset.cogFocusMode = enabled ? 'on' : 'off';
        break;
      case 'dyslexia':
        html.dataset.cogDyslexiaMode = enabled ? 'on' : 'off';
        break;
      case 'elderly':
        html.dataset.cogElderlyMode = enabled ? 'on' : 'off';
        break;
      case 'distractionKiller':
        html.dataset.cogDistractionKiller = enabled ? 'on' : 'off';
        break;
    }
  }

  /**
   * Set font size
   */
  private setFontSize(size: number) {
    document.documentElement.style.fontSize = size + 'px';
    localStorage.setItem('cogni_font_size', size.toString());
    this.showToast(`Font size: ${size}px`);
  }

  /**
   * Show a toast notification
   */
  private showToast(message: string) {
    const toast = document.createElement('div');
    toast.className = 'cogni-toast';
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 300);
    }, 2000);
  }

  /**
   * Save modes to storage
   */
  private saveModes() {
    chrome.storage.sync.set({ cogniModes: this.modes });
  }

  /**
   * Load modes from storage
   */
  private loadModes() {
    chrome.storage.sync.get('cogniModes', (data) => {
      if (data.cogniModes) {
        this.modes = data.cogniModes as OrbModes;
      }
    });
  }

  /**
   * Get label for a mode
   */
  private getModeLabel(mode: keyof OrbModes): string {
    const labels = {
      focus: '🎯 Focus Mode',
      dyslexia: '📖 Dyslexia Mode',
      elderly: '👁️ Large UI Mode',
      distractionKiller: '🚫 Ad Blocker'
    };
    return labels[mode];
  }
}