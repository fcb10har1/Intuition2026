/**
 * AI Client using Transformers.js (in-browser model)
 * Runs entirely locally - no server, no API key needed
 * Collects real-time data and fine-tunes model over time
 */

const aiState = {
  status: "initializing", // initializing | ready | error
  modelLoading: false,
  model: null,
  error: null,
  trainingMode: true // Enable training data collection
};

// Load Transformers.js library (bundled locally)
const loadTransformersLib = async () => {
  if (window.transformers) return;
  
  try {
    // Use the bundled transformers.js from node_modules
    const { pipeline } = await import('/@xenova/transformers');
    window.transformers = { pipeline };
    return true;
  } catch (e) {
    // Fallback: Load from package
    console.log("[AI] Loading Transformers.js...");
    return new Promise((resolve, reject) => {
      // Try loading the minified bundle
      const script = document.createElement("script");
      script.src = chrome.runtime.getURL("lib/transformers.min.js");
      script.onload = () => {
        console.log("[AI] Transformers.js loaded from local bundle");
        resolve(true);
      };
      script.onerror = () => {
        console.warn("[AI] Could not load local Transformers.js bundle");
        resolve(false); // Fallback to defaults
      };
      document.head.appendChild(script);
    });
  }
};

const initializeModel = async () => {
  if (aiState.modelLoading || aiState.model) return;
  
  aiState.modelLoading = true;
  
  try {
    const libLoaded = await loadTransformersLib();
    
    if (!libLoaded || !window.transformers) {
      throw new Error("Transformers.js not available");
    }
    
    const { pipeline } = window.transformers;
    
    console.log("[AI] Initializing text generation model...");
    aiState.model = await pipeline(
      "text-generation",
      "Xenova/distilgpt2",
      { device: "webgpu" } // GPU if available, falls back to CPU
    );
    
    aiState.status = "ready";
    aiState.modelLoading = false;
    console.log("[AI] Model ready ✓");
    
    // Check if training is needed
    if (window.__modelTrainer && window.__modelTrainer.shouldTrain()) {
      console.log("[AI] Training data available - consider fine-tuning");
    }
    
    return true;
  } catch (error) {
    aiState.status = "error";
    aiState.error = error.message;
    aiState.modelLoading = false;
    console.warn("[AI] Model initialization failed:", error.message);
    return false;
  }
};

// Initialize model when script loads (background)
initializeModel().catch(e => {
  console.warn("[AI] Background init failed (will retry on demand):", e.message);
});

async function generateRecommendationPrompt(questionnaire, interactions) {
  const q = questionnaire || {};
  const interact = interactions || {};
  
  // Build a rich prompt with detailed interaction patterns
  const sensitivity = [
    q.q1 === "yes" ? "visual clutter" : "",
    q.q7 === "yes" ? "animations" : "",
    q.q3 === "often" ? "loses place" : "",
    q.q4 === "yes" ? "dense text" : ""
  ].filter(Boolean).join(", ");
  
  const preferences = [
    q.q2 === "yes" ? "step-by-step" : "",
    q.q5 === "yes" ? "better spacing" : "",
    q.q9 === "yes" ? "progress reminders" : ""
  ].filter(Boolean).join(", ");
  
  // Analyze real-time interaction patterns
  const behaviors = [];
  
  if (interact.scrollReversals > 2) behaviors.push("thrashing");
  if (interact.idlePeriods > 0) behaviors.push("long pauses");
  if (interact.overloadScore > 30) behaviors.push("cognitive overload");
  if (interact.rageClickCount > 0) behaviors.push("frustration (rage clicks)");
  if (interact.backspaceCount > interact.keyboardEvents * 0.15) behaviors.push("typing errors");
  if (interact.scrollJitterCount > 4) behaviors.push("scroll hesitation");
  if (interact.focusShifts > 10) behaviors.push("tab navigation");
  
  // Device accessibility hints
  const deviceHints = [];
  if (interact.usesKeyboardOnly) deviceHints.push("keyboard-only");
  if (interact.usesScreenReader) deviceHints.push("screen-reader");
  if (interact.prefersReducedMotion) deviceHints.push("no-animations");
  if (interact.systemFontScale > 1.2) deviceHints.push("large-text");
  if (interact.zoomLevel > 1.5) deviceHints.push("high-zoom");

  const prompt = `Accessibility optimization for cognitive load.
User profile - Sensitivities: ${sensitivity || "none"}.
Preferences: ${preferences || "flexible"}.
Real-time behavior: ${behaviors.length > 0 ? behaviors.join(", ") : "normal usage"}.
Device setup: ${deviceHints.length > 0 ? deviceHints.join(", ") : "standard"}.
Recommendation: enable focus-mode or reduce-distractions, add reading-ease or step-by-step guidance, set intensity mild/med/strong.`;

  return prompt;
}

async function callInBrowserModel(questionnaire, interactions) {
  // Ensure model is loaded
  if (!aiState.model) {
    const success = await initializeModel();
    if (!success) {
      // Fall back to smart defaults
      return getSmartDefaultsFromInteractions(questionnaire, interactions);
    }
  }

  try {
    const prompt = await generateRecommendationPrompt(questionnaire, interactions);
    
    console.log("[AI] Generating recommendations with neural network...");
    const result = await aiState.model(prompt, { max_new_tokens: 80 });
    const text = result[0]?.generated_text || "";
    
    // Parse recommendations from model output
    const recommendations = parseRecommendations(text);
    console.log("[AI] Model response:", recommendations);
    
    // Collect training data if enabled
    if (aiState.trainingMode && window.__modelTrainer) {
      window.__modelTrainer.addTrainingExample(prompt, recommendations, {
        source: "neural_network",
        timestamp: Date.now()
      });
    }
    
    aiState.status = "ready";
    return recommendations;
  } catch (error) {
    console.warn("[AI] Model generation failed:", error.message);
    console.log("[AI] Falling back to smart defaults...");
    
    // Fall back to smart defaults on error
    return getSmartDefaultsFromInteractions(questionnaire, interactions);
  }
}

function parseRecommendations(text) {
  // Simple heuristic parsing since distilgpt2 doesn't output structured JSON
  const recs = {
    focus_mode: text.includes("focus") || text.includes("declutter"),
    reduce_distractions: text.includes("distract") || text.includes("clutter"),
    reading_ease: text.includes("read") || text.includes("spacing"),
    step_by_step: text.includes("step") || text.includes("guide"),
    time_control: text.includes("time") || text.includes("progress"),
    focus_level: text.includes("strong") ? "strong" : text.includes("med") ? "med" : "mild"
  };
  return recs;
}

async function getAIRecommendations(questionnaire, interactions) {
  const context = {
    timestamp: new Date().toISOString(),
    url: window.location.href,
    questionnaire: questionnaire || {},
    interactions: {
      // Basic metrics
      scrollReversals: interactions?.scrollReversals || 0,
      idlePeriods: interactions?.idlePeriods || 0,
      overloadScore: interactions?.overloadScore || 0,
      
      // Detailed patterns
      clickCount: interactions?.clickCount || 0,
      backspaceCount: interactions?.backspaceCount || 0,
      keyboardEvents: interactions?.keyboardEvents || 0,
      mouseEvents: interactions?.mouseEvents || 0,
      rageClickCount: interactions?.rageClickTimes?.length || 0,
      scrollJitterCount: interactions?.scrollJitterEvents?.length || 0,
      focusShifts: interactions?.focusShifts || 0,
      
      // Device hints
      usesKeyboardOnly: interactions?.usesKeyboardOnly || false,
      usesScreenReader: interactions?.usesScreenReader || false,
      prefersReducedMotion: interactions?.prefersReducedMotion || false,
      systemFontScale: interactions?.systemFontScale || 1.0,
      zoomLevel: interactions?.zoomLevel || 1.0
    }
  };

  const recommendations = await callInBrowserModel(
    context.questionnaire,
    context.interactions
  );

  if (recommendations) {
    return { ...recommendations, source: "ai" };
  } else {
    const defaults = getSmartDefaultsFromInteractions(questionnaire, context.interactions);
    return { ...defaults, source: "defaults" };
  }
}

function getSmartDefaultsFromInteractions(questionnaire, interactions) {
  const q = questionnaire || {};
  const interact = interactions || {};
  
  let enabled = false;
  let level = "mild";
  let readingEase = false;
  let stepByStep = false;
  let timeControl = false;
  let reduceDistractions = false;

  // Questionnaire-based defaults
  if (q.q1 === "yes" || q.q1 === "sometimes") {
    enabled = true;
    reduceDistractions = true;
  }

  if (q.q2 === "yes") {
    stepByStep = true;
  }

  if (q.q3 === "often") {
    enabled = true;
    level = "med";
  }

  if (q.q4 === "yes" || q.q4 === "sometimes") {
    readingEase = true;
    if (q.q4 === "yes") level = "med";
  }

  if (q.q5 === "yes") {
    readingEase = true;
    level = level === "mild" ? "med" : level;
  }

  if (q.q7 === "yes" || q.q7 === "sometimes") {
    enabled = true;
    reduceDistractions = true;
  }

  if (q.q9 === "yes") {
    timeControl = true;
  }

  if (q.q10 === "yes" || q.q10 === "sometimes") {
    stepByStep = true;
    level = level === "mild" ? "med" : level;
  }

  // Real-time interaction adjustments
  // If user shows signs of frustration/confusion, increase intensity
  if (interact.overloadScore > 30 || interact.rageClickCount > 0) {
    enabled = true;
    level = level === "mild" ? "med" : "strong";
    reduceDistractions = true;
  }
  
  // If user is making typing errors, add reading ease
  if (interact.backspaceCount > interact.keyboardEvents * 0.15) {
    readingEase = true;
  }
  
  // If user scrolls erratically, enable focus mode
  if (interact.scrollJitterCount > 4) {
    enabled = true;
    reduceDistractions = true;
  }
  
  // If user uses keyboard-only, enable step-by-step
  if (interact.usesKeyboardOnly) {
    stepByStep = true;
  }
  
  // If user prefers reduced motion, remove animations
  if (interact.prefersReducedMotion) {
    reduceDistractions = true;
  }
  
  // If user has large text or zoom, add reading ease
  if (interact.systemFontScale > 1.2 || interact.zoomLevel > 1.5) {
    readingEase = true;
  }

  return {
    focus_mode: enabled,
    reduce_distractions: reduceDistractions,
    reading_ease: readingEase,
    step_by_step: stepByStep,
    time_control: timeControl,
    focus_level: level
  };
}

function getDefaultRecommendations(questionnaire) {
  // Legacy function - now calls smart version with empty interactions
  return getSmartDefaultsFromInteractions(questionnaire, {});
}

function getAIStatus() {
  return {
    status: aiState.status,
    error: aiState.error,
    modelLoaded: !!aiState.model,
    trainingMode: aiState.trainingMode,
    trainingStats: window.__modelTrainer ? window.__modelTrainer.getStats() : null
  };
}

// Expose globally
window.__aiClient = {
  getAIRecommendations,
  getDefaultRecommendations,
  getAIStatus,
  initializeModel
};
