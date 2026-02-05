/**
 * Behavior Model - Learns user preferences over time
 * 
 * Tracks:
 * - Which assists user applies/rejects
 * - How long they keep each assist enabled
 * - Which domain/site they're on
 * - When they make changes
 * 
 * Predicts:
 * - What assists to auto-enable on similar sites
 * - User's preference profile (likelihood scores)
 * - Confidence levels (how sure are we?)
 */

export interface AssistEvent {
  assist: string; // "focus_mode", "reading_ease", etc.
  action: "applied" | "rejected" | "toggled_off";
  domain: string; // e.g., "canvas.instructure.com"
  duration?: number; // milliseconds user kept it enabled
  timestamp: number;
  context?: {
    intensity?: "mild" | "med" | "strong";
    pageTitle?: string;
    userAnswerToQ?: number; // which questionnaire Q
  };
}

export interface AssistPreference {
  assist: string;
  likelihood: number; // 0 to 1 (confidence)
  timesApplied: number;
  timesRejected: number;
  totalTimeEnabled: number; // in ms
  lastUsed: number; // timestamp
  favoriteIntensity?: "mild" | "med" | "strong";
}

export interface DomainProfile {
  domain: string;
  assists: Record<string, AssistPreference>;
  lastSeen: number;
  visitCount: number;
  userType?: string; // "student", "teacher", "general"
}

export interface UserBehaviorProfile {
  globalPreferences: Record<string, AssistPreference>;
  domainProfiles: Record<string, DomainProfile>;
  learningLevel: number; // 0-1, how confident are we in predictions
  lastUpdated: number;
}

const STORAGE_KEY = "userBehaviorProfile";

/**
 * BehaviorModel: Learn and predict user preferences
 */
export class BehaviorModel {
  private profile: UserBehaviorProfile;
  private eventLog: AssistEvent[] = [];
  private changeListeners: Array<() => void> = [];

  constructor(profile?: UserBehaviorProfile) {
    this.profile = profile || this.initializeProfile();
  }

  private initializeProfile(): UserBehaviorProfile {
    return {
      globalPreferences: {},
      domainProfiles: {},
      learningLevel: 0,
      lastUpdated: Date.now(),
    };
  }

  /**
   * LEARN: Record when user applies or rejects an assist
   */
  recordEvent(event: AssistEvent): void {
    this.eventLog.push(event);

    const domain = event.domain || "global";

    // Update global preferences
    this.updateGlobalPreference(event.assist, event.action, event.duration ?? 0);

    // Update domain-specific preferences
    this.updateDomainPreference(domain, event.assist, event.action, event.duration ?? 0);

    // Update learning level (increase confidence with more data)
    this.increaseConfidence();

    this.profile.lastUpdated = Date.now();
    this.notifyListeners();
  }

  /**
   * PREDICT: What assists should we recommend for this domain?
   */
  predictAssistsForDomain(domain: string): Record<string, number> {
    // Get domain-specific profile if exists
    const domainProfile = this.profile.domainProfiles[domain];
    
    if (domainProfile && domainProfile.visitCount >= 2) {
      // We have good data for this domain - use specific preferences
      const predictions: Record<string, number> = {};
      for (const [assist, pref] of Object.entries(domainProfile.assists)) {
        predictions[assist] = pref.likelihood;
      }
      return predictions;
    }

    // Fall back to global preferences if new domain
    return this.getGlobalPreferences();
  }

  /**
   * PREDICT: What intensity level does user prefer?
   */
  predictIntensity(domain: string): "mild" | "med" | "strong" {
    const domainProfile = this.profile.domainProfiles[domain];
    if (domainProfile) {
      // Check focal assists for intensity preference
      for (const assist of ["focus_mode", "reduce_distractions"]) {
        const pref = domainProfile.assists[assist];
        if (pref?.favoriteIntensity) {
          return pref.favoriteIntensity;
        }
      }
    }

    // Global fallback
    const globalFocus = this.profile.globalPreferences["focus_mode"];
    return globalFocus?.favoriteIntensity || "med";
  }

  /**
   * PREDICT: Which assists are most likely to help this user?
   * Returns scores 0-1 for each assist
   */
  getGlobalPreferences(): Record<string, number> {
    const predictions: Record<string, number> = {};
    
    for (const [assist, pref] of Object.entries(this.profile.globalPreferences)) {
      predictions[assist] = pref.likelihood;
    }

    // Ensure common assists are included
    const commonAssists = [
      "focus_mode",
      "reduce_distractions",
      "reading_ease",
      "step_by_step",
      "time_control",
      "error_support",
    ];

    for (const assist of commonAssists) {
      if (!predictions[assist]) {
        predictions[assist] = 0; // Not yet learned
      }
    }

    return predictions;
  }

  /**
   * AUTO-DECIDE: Should we auto-enable this assist?
   * Returns true if confidence > 0.6 and positive signal
   */
  shouldAutoEnable(assist: string, domain: string): boolean {
    const predictions = this.predictAssistsForDomain(domain);
    const likelihood = predictions[assist] ?? 0;

    // Auto-enable if:
    // 1. User has applied it before (likelihood > 0.6)
    // 2. Learning level is decent (>= 0.4)
    return likelihood > 0.6 && this.profile.learningLevel >= 0.4;
  }

  /**
   * CONFIDENCE: How certain are we about user preferences?
   * 0 = just started learning, 1 = very confident
   */
  getConfidence(): number {
    return this.profile.learningLevel;
  }

  /**
   * DEBUG: Get human-readable summary
   */
  getSummary(): string {
    const global = this.profile.globalPreferences;
    const lines = [
      `Learning Level: ${(this.profile.learningLevel * 100).toFixed(0)}%`,
      `Tracked Events: ${this.eventLog.length}`,
      `Domains: ${Object.keys(this.profile.domainProfiles).length}`,
      "",
      "Global Preferences:",
    ];

    for (const [assist, pref] of Object.entries(global)) {
      lines.push(
        `  ${assist}: ${(pref.likelihood * 100).toFixed(0)}% ` +
        `(applied ${pref.timesApplied}x, rejected ${pref.timesRejected}x)`
      );
    }

    return lines.join("\n");
  }

  // ===== PRIVATE HELPERS =====

  private updateGlobalPreference(
    assist: string,
    action: "applied" | "rejected" | "toggled_off",
    duration: number
  ): void {
    if (!this.profile.globalPreferences[assist]) {
      this.profile.globalPreferences[assist] = {
        assist,
        likelihood: 0,
        timesApplied: 0,
        timesRejected: 0,
        totalTimeEnabled: 0,
        lastUsed: Date.now(),
      };
    }

    const pref = this.profile.globalPreferences[assist];
    pref.lastUsed = Date.now();

    if (action === "applied") {
      pref.timesApplied++;
      pref.totalTimeEnabled += duration;
    } else if (action === "rejected") {
      pref.timesRejected++;
    } else if (action === "toggled_off") {
      pref.totalTimeEnabled += duration;
    }

    // Recalculate likelihood score
    pref.likelihood = this.calculateLikelihood(pref);
  }

  private updateDomainPreference(
    domain: string,
    assist: string,
    action: "applied" | "rejected" | "toggled_off",
    duration: number
  ): void {
    if (!this.profile.domainProfiles[domain]) {
      this.profile.domainProfiles[domain] = {
        domain,
        assists: {},
        lastSeen: Date.now(),
        visitCount: 0,
      };
    }

    const domainProfile = this.profile.domainProfiles[domain];
    domainProfile.lastSeen = Date.now();
    domainProfile.visitCount++;

    if (!domainProfile.assists[assist]) {
      domainProfile.assists[assist] = {
        assist,
        likelihood: 0,
        timesApplied: 0,
        timesRejected: 0,
        totalTimeEnabled: 0,
        lastUsed: Date.now(),
      };
    }

    const pref = domainProfile.assists[assist];
    pref.lastUsed = Date.now();

    if (action === "applied") {
      pref.timesApplied++;
      pref.totalTimeEnabled += duration;
    } else if (action === "rejected") {
      pref.timesRejected++;
    } else if (action === "toggled_off") {
      pref.totalTimeEnabled += duration;
    }

    pref.likelihood = this.calculateLikelihood(pref);
  }

  /**
   * Calculate likelihood score (0-1) based on usage history
   * Formula: (applied - rejected) / (applied + rejected)
   * Weighted by time spent: assists kept longer = higher score
   */
  private calculateLikelihood(pref: AssistPreference): number {
    const totalInteractions = pref.timesApplied + pref.timesRejected;

    if (totalInteractions === 0) {
      return 0;
    }

    // Base score: more applications than rejections = positive
    const baseScore = (pref.timesApplied - pref.timesRejected) / totalInteractions;

    // Boost if user kept it enabled for a long time (> 5 minutes)
    const timeBoost = Math.min(1, pref.totalTimeEnabled / (5 * 60 * 1000)) * 0.3;

    // Combine: base + boost, clamped to 0-1
    return Math.max(0, Math.min(1, baseScore + timeBoost));
  }

  private increaseConfidence(): void {
    // Each event increases confidence slightly
    // Max out at 1.0
    const increment = 0.02; // ~50 events to reach 1.0
    this.profile.learningLevel = Math.min(1, this.profile.learningLevel + increment);
  }

  private notifyListeners(): void {
    for (const listener of this.changeListeners) {
      listener();
    }
  }

  // ===== STORAGE INTEGRATION =====

  /**
   * Load profile from chrome.storage
   */
  static async load(): Promise<BehaviorModel> {
    try {
      const data = await chrome.storage.local.get(STORAGE_KEY);
      const profile = data[STORAGE_KEY] as UserBehaviorProfile | undefined;
      return new BehaviorModel(profile);
    } catch (e) {
      console.warn("[BehaviorModel] Failed to load profile, starting fresh:", e);
      return new BehaviorModel();
    }
  }

  /**
   * Save profile to chrome.storage
   */
  async save(): Promise<void> {
    try {
      await chrome.storage.local.set({ [STORAGE_KEY]: this.profile });
    } catch (e) {
      console.warn("[BehaviorModel] Failed to save profile:", e);
    }
  }

  /**
   * Listen for changes
   */
  onChange(listener: () => void): () => void {
    this.changeListeners.push(listener);
    // Return unsubscribe function
    return () => {
      const idx = this.changeListeners.indexOf(listener);
      if (idx >= 0) this.changeListeners.splice(idx, 1);
    };
  }

  /**
   * Export profile for debugging
   */
  export(): UserBehaviorProfile {
    return JSON.parse(JSON.stringify(this.profile));
  }

  /**
   * Clear all data
   */
  async reset(): Promise<void> {
    this.profile = this.initializeProfile();
    this.eventLog = [];
    await chrome.storage.local.remove(STORAGE_KEY);
    this.notifyListeners();
  }
}

// ===== SINGLETON INSTANCE (for content script) =====
let instance: BehaviorModel | null = null;

export async function getBehaviorModel(): Promise<BehaviorModel> {
  if (!instance) {
    instance = await BehaviorModel.load();
  }
  return instance;
}

export async function resetBehaviorModel(): Promise<void> {
  if (instance) {
    await instance.reset();
    instance = null;
  }
}
