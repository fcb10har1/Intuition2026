/**
 * AI Client using Transformers.js (in-browser model)
 * Runs entirely locally - no server, no API key needed
 */

const aiState = {
  status: "initializing", // initializing | ready | error
  modelLoading: false,
  model: null,
  error: null
};

// Load Transformers.js library
const loadTransformersLib = async () => {
  if (window.transformers) return;
  
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/@xenova/transformers@2.6.0";
    script.onload = () => {
      console.log("[AI] Transformers.js loaded");
      resolve();
    };
    script.onerror = () => {
      console.warn("[AI] Failed to load Transformers.js");
      reject(new Error("Transformers.js CDN failed"));
    };
    document.head.appendChild(script);
  });
};

const initializeModel = async () => {
  if (aiState.modelLoading || aiState.model) return;
  
  aiState.modelLoading = true;
  
  try {
    await loadTransformersLib();
    
    const { pipeline } = window.transformers;
    
    console.log("[AI] Initializing text generation model...");
    aiState.model = await pipeline(
      "text-generation",
      "Xenova/distilgpt2", // Small, fast model (~100MB)
      { device: "webgpu" } // Use GPU if available, falls back to CPU
    );
    
    aiState.status = "ready";
    aiState.modelLoading = false;
    console.log("[AI] Model ready ✓");
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
  
  // Build a concise prompt for the model
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
  
  const behaviors = [
    interact.scrollReversals > 2 ? "thrashing/confused" : "",
    interact.idlePeriods > 0 ? "stuck/paused" : "",
    interact.overloadScore > 30 ? "cognitive overload" : ""
  ].filter(Boolean).join(", ");

  const prompt = `Accessibility recommendations.
Sensitivities: ${sensitivity || "none"}.
Preferences: ${preferences || "flexible"}.
Current behavior: ${behaviors || "normal"}.
Recommend: focus-mode, reduce-distractions, reading-ease, step-by-step, time-control, intensity (mild/med/strong).`;

  return prompt;
}

async function callInBrowserModel(questionnaire, interactions) {
  // Ensure model is loaded
  if (!aiState.model) {
    const success = await initializeModel();
    if (!success) return null;
  }

  try {
    const prompt = await generateRecommendationPrompt(questionnaire, interactions);
    
    console.log("[AI] Generating recommendations...");
    const result = await aiState.model(prompt, { max_new_tokens: 80 });
    const text = result[0]?.generated_text || "";
    
    // Parse simple JSON-like recommendations from text
    const recommendations = parseRecommendations(text);
    console.log("[AI] Model response:", recommendations);
    
    aiState.status = "ready";
    return recommendations;
  } catch (error) {
    console.warn("[AI] Model generation failed:", error.message);
    aiState.status = "error";
    aiState.error = error.message;
    return null;
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
      scrollReversals: interactions?.scrollReversals || 0,
      idlePeriods: interactions?.idlePeriods || 0,
      overloadScore: interactions?.overloadScore || 0
    }
  };

  const recommendations = await callInBrowserModel(
    context.questionnaire,
    context.interactions
  );

  if (recommendations) {
    return { ...recommendations, source: "ai" };
  } else {
    const defaults = getDefaultRecommendations(questionnaire);
    return { ...defaults, source: "defaults" };
  }
}

function getDefaultRecommendations(questionnaire) {
  const q = questionnaire || {};
  
  let enabled = false;
  let level = "mild";
  let readingEase = false;
  let stepByStep = false;
  let timeControl = false;
  let reduceDistractions = false;

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

  return {
    focus_mode: enabled,
    reduce_distractions: reduceDistractions,
    reading_ease: readingEase,
    step_by_step: stepByStep,
    time_control: timeControl,
    focus_level: level
  };
}

function getAIStatus() {
  return aiState.status;
}

// Expose globally
window.__aiClient = {
  getAIRecommendations,
  getDefaultRecommendations,
  getAIStatus,
  initializeModel
};
