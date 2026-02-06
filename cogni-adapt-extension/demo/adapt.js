/**
 * demo/adapt.js
 * Standalone demo (no chrome.* APIs)
 * Toggles the same DOM flags used by the extension
 */

const ASSIST_CSS = {
  focusMode: "../src/content/adapt/css/focus_mode.css",
  reduceDistractions: "../src/content/adapt/css/reduce_distractions.css",
  readingEase: "../src/content/adapt/css/reading_ease.css",
  stepByStep: "../src/content/adapt/css/step_by_step.css",
  timeControl: "../src/content/adapt/css/time_control.css",
  focusGuide: "../src/content/adapt/css/focus_guide.css",
  errorSupport: "../src/content/adapt/css/error_support.css",
  darkMode: "../src/content/adapt/css/dark_mode.css"
};

const BASE_CSS = [
  "../src/content/adapt/css/base.css",
  "../src/content/adapt/css/orb.css",
  "../src/content/adapt/css/focus_overlay.css",
  "../src/content/adapt/css/cursor.css"
];

let state = {
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

function cssIdFor(path) {
  return `demo-css:${path.replace(/[^\w-]/g, "_")}`;
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

function apply() {
  setHtmlFlag("enabled", state.enabled);
  document.documentElement.style.setProperty("--cog-intensity", String(state.intensity));

  setHtmlFlag("focus-mode", state.assists.focusMode);
  setHtmlFlag("reduce-distractions", state.assists.reduceDistractions);
  setHtmlFlag("reading-ease", state.assists.readingEase);
  setHtmlFlag("step-by-step", state.assists.stepByStep);
  setHtmlFlag("time-control", state.assists.timeControl);
  setHtmlFlag("focus-guide", state.assists.focusGuide);
  setHtmlFlag("error-support", state.assists.errorSupport);
  setHtmlFlag("dark-mode", state.assists.darkMode);

  // CSS
  if (state.enabled) BASE_CSS.forEach((p) => ensureLink(cssIdFor(p), p));
  else BASE_CSS.forEach((p) => removeLink(cssIdFor(p)));

  for (const [assist, path] of Object.entries(ASSIST_CSS)) {
    const on = state.enabled && !!state.assists[assist];
    const id = cssIdFor(path);
    if (on) ensureLink(id, path);
    else removeLink(id);
  }
}

apply();

// Optional: expose controls for demo page
window.demoA11y = {
  setEnabled(v) {
    state.enabled = !!v;
    apply();
  },
  setIntensity(v01) {
    state.intensity = Math.max(0, Math.min(1, Number(v01)));
    apply();
  },
  toggle(assistKey) {
    if (!(assistKey in state.assists)) return;
    state.assists[assistKey] = !state.assists[assistKey];
    apply();
  },
  getState() {
    return JSON.parse(JSON.stringify(state));
  }
};
