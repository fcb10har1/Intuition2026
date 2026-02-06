const FORM_ID = "questionnaire";
const STATUS_ID = "status";

const QUESTION_KEYS = [
  "q1",
  "q2",
  "q3",
  "q4",
  "q5",
  "q6",
  "q7",
  "q8",
  "q9",
  "q10"
];

function getFormValues() {
  const values = {};
  for (const key of QUESTION_KEYS) {
    const el = document.getElementById(key);
    values[key] = el ? el.value : "";
  }
  return values;
}

function setFormValues(values) {
  if (!values) return;
  for (const key of QUESTION_KEYS) {
    const el = document.getElementById(key);
    if (el && values[key]) el.value = values[key];
  }
}

function setStatus(text) {
  const status = document.getElementById(STATUS_ID);
  if (status) status.textContent = text;
}

async function loadExisting() {
  const data = await chrome.storage.sync.get(["onboardingResponses"]);
  setFormValues(data.onboardingResponses);
}

async function saveResponses(markCompleted) {
  const responses = getFormValues();
  await chrome.storage.sync.set({
    onboardingResponses: responses,
    onboardingCompleted: !!markCompleted,
    onboardingCompletedAt: new Date().toISOString()
  });
}

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById(FORM_ID);

  void loadExisting();

  form?.addEventListener("submit", async (e) => {
    e.preventDefault();
    await saveResponses(true);
    try {
      await chrome.runtime.sendMessage({ action: "onboardingSaved" });
    } catch {
      // No-op if background is unavailable
    }
    setStatus("Saved. Closing this tab...");
    window.close();
  });
});