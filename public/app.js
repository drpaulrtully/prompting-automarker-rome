/* =========================================================
   FEthink — AI Prompting Automarker (Level 1)
   - Access code gate -> signed httpOnly cookie session
   - Marking rules:
       <20 words: "Please add..." only; no score; no extras; no model answer
       >=20 words: score + strengths + tags + grid + improvement notes
       + optional Learn more framework tabs (collapsed by default)
       + model answer (collapsed) shown only when server returns it
   - Target length shown: 20-200 words
   ========================================================= */

const gateEl = document.getElementById("gate");
const codeInput = document.getElementById("codeInput");
const unlockBtn = document.getElementById("unlockBtn");
const gateMsg = document.getElementById("gateMsg");

const backToCourse = document.getElementById("backToCourse");
const nextLesson = document.getElementById("nextLesson");

const questionTextEl = document.getElementById("questionText");
const targetWordsEl = document.getElementById("targetWords");
const minGateEl = document.getElementById("minGate");

const insertTemplateBtn = document.getElementById("insertTemplateBtn");
const clearBtn = document.getElementById("clearBtn");
const answerTextEl = document.getElementById("answerText");

const submitBtn = document.getElementById("submitBtn");
const wordCountBox = document.getElementById("wordCountBox");

const scoreBig = document.getElementById("scoreBig");
const wordCountBig = document.getElementById("wordCountBig");
const feedbackBox = document.getElementById("feedbackBox");

// NEW: Strengths / Tags / Grid
const strengthsWrap = document.getElementById("strengthsWrap");
const strengthsList = document.getElementById("strengthsList");

const tagsWrap = document.getElementById("tagsWrap");
const tagsRow = document.getElementById("tagsRow");

const gridWrap = document.getElementById("gridWrap");
const gEthical = document.getElementById("gEthical");
const gImpact = document.getElementById("gImpact");
const gLegal = document.getElementById("gLegal");
const gRecs = document.getElementById("gRecs");
const gStructure = document.getElementById("gStructure");

// Learn more panel
const learnMoreWrap = document.getElementById("learnMoreWrap");
const learnMoreBtn = document.getElementById("learnMoreBtn");
const frameworkPanel = document.getElementById("frameworkPanel");
const learnMoreText = document.getElementById("learnMoreText"); // ✅ ADDED

// Model answer
const modelWrap = document.getElementById("modelWrap");
const modelAnswerEl = document.getElementById("modelAnswer");

/* ---------------- Local state ---------------- */
let TEMPLATE_TEXT = "";
let MIN_GATE = 20;

/* ---------------- Helpers ---------------- */
function wc(text) {
  const t = String(text || "").trim();
  if (!t) return 0;
  return t.split(/\s+/).filter(Boolean).length;
}

function showGate(message = "") {
  gateEl.style.display = "flex";
  gateMsg.textContent = message;
  codeInput.focus();
}

function hideGate() {
  gateEl.style.display = "none";
}

function resetExtras() {
  // Strengths
  strengthsWrap.style.display = "none";
  strengthsList.innerHTML = "";

  // Tags
  tagsWrap.style.display = "none";
  tagsRow.innerHTML = "";

  // Grid
  gridWrap.style.display = "none";
  gEthical.textContent = "—";
  gImpact.textContent = "—";
  gLegal.textContent = "—";
  gRecs.textContent = "—";
  gStructure.textContent = "—";

  // Learn more panel
  learnMoreWrap.style.display = "none";
  frameworkPanel.style.display = "none";
  frameworkPanel.setAttribute("aria-hidden", "true");
  learnMoreBtn.setAttribute("aria-expanded", "false");
  if (learnMoreText) learnMoreText.textContent = ""; // ✅ SAFE CLEAR

  // Model answer
  modelWrap.style.display = "none";
  modelAnswerEl.textContent = "";
}

function resetFeedback() {
  scoreBig.textContent = "—";
  wordCountBig.textContent = "—";
  feedbackBox.textContent = "";
  resetExtras();
}

/* ---------------- Config load ---------------- */
async function loadConfig() {
  try {
    const res = await fetch("/api/config", { credentials: "include" });
    const data = await res.json();
    if (!data?.ok) return;

    questionTextEl.textContent = data.questionText || "Task loaded.";
    targetWordsEl.textContent = data.targetWords || "20-200";
    MIN_GATE = data.minWordsGate ?? 20;
    minGateEl.textContent = String(MIN_GATE);

    TEMPLATE_TEXT = data.templateText || "";

    if (data.courseBackUrl) {
      backToCourse.href = data.courseBackUrl;
      backToCourse.style.display = "inline-block";
    }
    if (data.nextLessonUrl) {
      nextLesson.href = data.nextLessonUrl;
      nextLesson.style.display = "inline-block";
    }
  } catch {
    // silent
  }
}

/* ---------------- Gate unlock ---------------- */
async function unlock() {
  const code = codeInput.value.trim();
  if (!code) {
    gateMsg.textContent = "Please enter the access code from your lesson.";
    return;
  }

  unlockBtn.disabled = true;
  gateMsg.textContent = "Checking…";

  try {
    const res = await fetch("/api/unlock", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ code })
    });

    const data = await res.json();

    if (!res.ok || !data?.ok) {
      gateMsg.textContent = "That code didn’t work. Check it and try again.";
      return;
    }

    hideGate();
    await loadConfig();
  } catch {
    gateMsg.textContent = "Network issue. Please try again.";
  } finally {
    unlockBtn.disabled = false;
  }
}

unlockBtn.addEventListener("click", unlock);
codeInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") unlock();
});

/* ---------------- Word count live ---------------- */
function updateWordCount() {
  const n = wc(answerTextEl.value);
  wordCountBox.textContent = `Words: ${n}`;
}
answerTextEl.addEventListener("input", updateWordCount);
updateWordCount();

/* ---------------- Template + clear ---------------- */
insertTemplateBtn.addEventListener("click", () => {
  if (!TEMPLATE_TEXT) return;
  const existing = answerTextEl.value.trim();
  if (!existing) {
    answerTextEl.value = TEMPLATE_TEXT;
  } else {
    answerTextEl.value = `${TEMPLATE_TEXT}\n\n---\n\n${existing}`;
  }
  answerTextEl.focus();
  updateWordCount();
});

clearBtn.addEventListener("click", () => {
  answerTextEl.value = "";
  updateWordCount();
  resetFeedback();
});

/* ---------------- Learn more toggle + tabs ---------------- */
function setActiveTab() { /* tabs removed */ }

learnMoreBtn?.addEventListener("click", () => {
  const isOpen = frameworkPanel.style.display === "block";
  if (isOpen) {
    frameworkPanel.style.display = "none";
    frameworkPanel.setAttribute("aria-hidden", "true");
    learnMoreBtn.setAttribute("aria-expanded", "false");
  } else {
    frameworkPanel.style.display = "block";
    frameworkPanel.setAttribute("aria-hidden", "false");
    learnMoreBtn.setAttribute("aria-expanded", "true");
  }
});

/* ---------------- Render helpers ---------------- */
function renderStrengths(strengths) {
  if (!Array.isArray(strengths) || strengths.length === 0) {
    strengthsWrap.style.display = "none";
    strengthsList.innerHTML = "";
    return;
  }
  strengthsList.innerHTML = strengths.slice(0, 3).map(s => `<li>${escapeHtml(s)}</li>`).join("");
  strengthsWrap.style.display = "block";
}

function tagBadge(name, status) {
  // status: "ok" | "mid" | "bad"
  const symbol = status === "ok" ? "✔" : status === "mid" ? "◐" : "✗";
  const cls = status === "ok" ? "tag ok" : status === "mid" ? "tag mid" : "tag bad";
  return `<span class="${cls}"><span class="tagStatus">${symbol}</span>${escapeHtml(name)}</span>`;
}

function renderTags(tags) {
  // tags: supports [{name, status}] OR [{label, status}]
  if (!Array.isArray(tags) || tags.length === 0) {
    tagsWrap.style.display = "none";
    tagsRow.innerHTML = "";
    return;
  }
  tagsRow.innerHTML = tags.map(t => tagBadge(t.name || t.label || "", t.status)).join(""); // ✅ UPDATED
  tagsWrap.style.display = "block";
}

function renderGrid(grid) {
  // Supports BOTH:
  // 1) object grid: {ethical, impact, legal, recs, structure}
  // 2) array grid:  [{label, status, detail}, ...]
  if (!grid) {
    gridWrap.style.display = "none";
    return;
  }

  // Case 1: object-style grid
  if (!Array.isArray(grid)) {
    gEthical.textContent = grid.ethical || "—";
    gImpact.textContent = grid.impact || "—";
    gLegal.textContent = grid.legal || "—";
    gRecs.textContent = grid.recs || "—";
    gStructure.textContent = grid.structure || "—";
    gridWrap.style.display = "block";
    return;
  }

  // Case 2: array-style grid from server.js (Role/Task/Context/Format)
  const getStatus = (label) => {
    const row = grid.find(r => (r.label || "").toLowerCase() === label.toLowerCase());
    return row ? (row.status || "—") : "—";
  };

  gEthical.textContent = getStatus("Role");
  gImpact.textContent = getStatus("Task");
  gLegal.textContent = getStatus("Context");
  gRecs.textContent = getStatus("Format");
  gStructure.textContent = "—";
  gridWrap.style.display = "block";
}

function renderFramework(frameworkText) {
  // frameworkText: string (Learn More content)
  if (!frameworkText) {
    learnMoreWrap.style.display = "none";
    return;
  }

  if (learnMoreText) learnMoreText.textContent = frameworkText; // ✅ SAFE SET

  // show container (panel still collapsed until button clicked)
  learnMoreWrap.style.display = "block";
  frameworkPanel.style.display = "none";
  frameworkPanel.setAttribute("aria-hidden", "true");
  learnMoreBtn.setAttribute("aria-expanded", "false");
}

function escapeHtml(s) {
  return String(s || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

/* ---------------- Submit for marking ---------------- */
async function mark() {
  resetFeedback();

  const answerText = answerTextEl.value.trim();
  const words = wc(answerText);

  if (words === 0) {
    feedbackBox.textContent = "Write your answer first (aim for 20-100 words).";
    return;
  }

  submitBtn.disabled = true;
  feedbackBox.textContent = "Marking…";
  wordCountBig.textContent = String(words);

  try {
    const res = await fetch("/api/mark", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ answerText })
    });

    if (res.status === 401) {
      showGate("Session expired. Please re-enter the access code from your Payhip lesson.");
      submitBtn.disabled = false;
      return;
    }

    const data = await res.json();
    const result = data?.result;

    if (!data?.ok || !result) {
      feedbackBox.textContent = "Could not mark your answer. Please try again.";
      return;
    }

    wordCountBig.textContent = String(result.wordCount ?? words);

    if (result.gated) {
      // Under 20 words: only show the "Please add..." message, no extras, no model answer.
      scoreBig.textContent = "—";
      feedbackBox.textContent = result.message || "Please add to your answer.";
      resetExtras();
      return;
    }

    // >= 20 words
    scoreBig.textContent = `${result.score}/10`;

    // strengths + tags + grid + notes
    renderStrengths(result.strengths);
    renderTags(result.tags);
    renderGrid(result.grid);

    // ✅ UPDATED: show message if feedback is not provided by server
    feedbackBox.textContent = result.feedback || result.message || "";

    // ✅ UPDATED: accept either server key
    renderFramework(result.framework || result.learnMoreText);

    // Model answer only if server returns it (already respects >=20 words rule)
    if (result.modelAnswer) {
      modelAnswerEl.textContent = result.modelAnswer;
      modelWrap.style.display = "block";
    } else {
      modelWrap.style.display = "none";
    }

  } catch {
    feedbackBox.textContent = "Network issue. Please try again.";
  } finally {
    submitBtn.disabled = false;
  }
}

submitBtn.addEventListener("click", mark);

/* ---------------- Initial load ---------------- */
loadConfig().then(() => {
  showGate();
});
