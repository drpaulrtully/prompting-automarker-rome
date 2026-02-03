import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import crypto from "crypto";

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use(express.static("public"));

const ACCESS_CODE = process.env.ACCESS_CODE || "FETHINK-ETHICS1";
const COOKIE_SECRET = process.env.COOKIE_SECRET || crypto.randomBytes(32).toString("hex");
const SESSION_MINUTES = parseInt(process.env.SESSION_MINUTES || "120", 10);

const COURSE_BACK_URL = process.env.COURSE_BACK_URL || "";
const NEXT_LESSON_URL = process.env.NEXT_LESSON_URL || "";

app.use(cookieParser(COOKIE_SECRET));

/* ---------------- Session cookie helpers ---------------- */
const COOKIE_NAME = "fethink_ethics_session";

function setSessionCookie(res) {
  const now = Math.floor(Date.now() / 1000);
  const exp = now + SESSION_MINUTES * 60;

  const payload = { exp };

  res.cookie(COOKIE_NAME, JSON.stringify(payload), {
    httpOnly: true,
    secure: true,     // Render uses HTTPS
    sameSite: "lax",
    maxAge: SESSION_MINUTES * 60 * 1000,
    signed: true
  });
}

function isSessionValid(req) {
  const raw = req.signedCookies?.[COOKIE_NAME];
  if (!raw) return false;

  let payload;
  try {
    payload = JSON.parse(raw);
  } catch {
    return false;
  }

  const now = Math.floor(Date.now() / 1000);
  return typeof payload?.exp === "number" && now < payload.exp;
}

function requireSession(req, res, next) {
  if (!isSessionValid(req)) {
    return res.status(401).json({ ok: false, error: "unauthorized" });
  }
  next();
}

/* ---------------- Helpers ---------------- */
function clampStr(s, max = 6000) {
  return String(s || "").slice(0, max);
}

function wordCount(text) {
  const t = String(text || "").trim();
  if (!t) return 0;
  return t.split(/\s+/).filter(Boolean).length;
}

function hasAny(text, needles) {
  const t = String(text || "").toLowerCase();
  return needles.some(n => t.includes(n));
}

/* ---------------- Task content ---------------- */
const QUESTION_TEXT =
`Scenario - you are travelling to the city of Rome in June and you will be staying at a hotel in the city centre. You are there for 1 week and you want AI to produce a 7-day itinerary for your visit.

A weak prompt would be:
What will I see when I visit Rome?

Your task is to rephrase this into a stronger prompt using the 4-stage structure covered earlier:

Role: Tell AI who you are, or what role you want it to adopt.
Task: What do you want AI to do?
Context: Who is AI creating the content for?
Format: How do you want the AI to present the information (structure, tone) - what specific information (constraints) are you requiring?

Aim for 50–200 words.
`;

const TEMPLATE_TEXT =
`Role:
Task:
Context:
Format:
`;

const MODEL_ANSWER =
`1. Key ethical or legal failures

One major failure was the use of facial recognition without clear public consent or transparency. Residents were not properly informed about how their data would be collected or used. A second failure was the lack of sufficient testing for bias and accuracy before deployment, which increased the risk of misidentification.

2. Why these failures mattered

These failures mattered because facial recognition can directly affect people’s rights and wellbeing. Individuals could be wrongly identified, questioned, or monitored, causing stress and harm. The lack of transparency also damaged public trust, as people felt watched rather than protected. When AI systems are introduced without openness or safeguards, they risk reinforcing unfairness and discrimination, particularly for certain groups.

3. What should have been done differently

First, the council should have completed a Data Protection Impact Assessment (DPIA) and clearly explained the system to the public, including how data would be stored and protected. Second, the system should have been independently tested for bias and accuracy before use, with clear limits on where and when it could operate. These steps would have supported fairer, more responsible use of AI.`;

/* ---------------- Framework text for the Learn More tabs ----------------
   Short, learner-friendly, and consistent with your plan:
   Only displayed if the learner clicks Learn more.
----------------------------------------------------------------------- */
const FRAMEWORK = {
  gdpr: {
    expectation: "UK GDPR Article 5 – Lawfulness, fairness and transparency (data protection principles).",
    case: "SmartTown’s use of biometric data without clear public transparency or lawful basis shows what can go wrong when personal data is processed without clear safeguards."
  },
  unesco: {
    expectation: "UNESCO Recommendation on the Ethics of Artificial Intelligence (adopted 2021) – human rights, dignity, transparency and fairness across the AI lifecycle.",
    case: "The case illustrates how facial recognition can undermine rights and dignity when it is not transparent, not accountable, or produces biased outcomes."
  },
  ofsted: {
    expectation: "Ofsted – expectations for responsible use of technology/AI: ethical, safe, transparent practice and management of risks (e.g., bias, fairness, data protection).",
    case: "SmartTown lacked transparency and safeguards, highlighting why organisations must evaluate risks and ensure AI is used responsibly and fairly."
  },
  jisc: {
    expectation: "Jisc – principles for responsible AI use in education: fair, safe, accountable and transparent deployment.",
    case: "The case shows why risk assessment, fairness checks, and clear governance matter before deploying AI that affects people."
  }
};

/* ---------------- Rubric detection themes ---------------- */
const FAILURE_THEMES = [
  { key: "consent/transparency", hits: ["consent", "transparent", "transparency", "informed", "notice", "public informed"] },
  { key: "gdpr/lawful basis", hits: ["gdpr", "lawful", "lawful basis", "data protection", "dpa", "privacy"] },
  { key: "bias/fairness", hits: ["bias", "biased", "fair", "fairness", "discrimin", "equal"] },
  { key: "accuracy/misidentification", hits: ["accur", "misidentif", "false positive", "false negative", "wrongly"] },
  { key: "security/storage", hits: ["secure", "security", "stored", "storage", "breach", "access control", "encryption"] },
  { key: "dpia/governance", hits: ["dpia", "impact assessment", "governance", "oversight", "audit"] }
];

const REC_THEMES = [
  ["dpia", "impact assessment"],
  ["consent", "transparen", "public notice"],
  ["bias", "fairness testing", "independent testing"],
  ["accuracy testing", "pilot", "validate"],
  ["data minim", "retention", "delete"],
  ["security", "access control", "encryption"],
  ["limits", "where", "when", "policy", "governance"]
];

/* ---------------- Status helpers ---------------- */
function statusFromLevel(level) {
  // level: 2=secure, 1=developing, 0=missing
  if (level >= 2) return "✓ Secure";
  if (level === 1) return "◐ Developing";
  return "✗ Missing";
}

function tagStatus(level) {
  // returns ok/mid/bad for UI
  if (level >= 2) return "ok";
  if (level === 1) return "mid";
  return "bad";
}

/* ---------------- Deterministic marker ----------------
   - <50 words: ONLY "Please add..." message; NO strengths/tags/grid/framework/model
   - >=50 words: score + strengths + tags + grid + improvement notes + Learn more panel content + model answer
----------------------------------------------------------------------- */
function markPromptingResponse(answerText) {
  const wc = wordCount(answerText);

  // HARD GATE: under 50 words — no rubric, no model answer, no extras
  if (wc < 50) {
    return {
      gated: true,
      wordCount: wc,
      message:
        "Please add to your answer.\n" +
        "This response is too short to demonstrate the full prompt structure.\n" +
        "Aim for at least 50 words and include: role, task, context, and format.",
      score: null,
      feedback: null,
      strengths: null,
      tags: null,
      grid: null,
      framework: null,
      modelAnswer: null
    };
  }

  const text = String(answerText || "");
  const t = text.toLowerCase();

  // Detect the four stages (we accept either explicit labels OR clear content cues)
  const hasRole =
    /\brole\b\s*:/.test(t) ||
    hasAny(t, ["you are a", "act as", "as a", "assume the role", "take the role", "you’re a", "you are an"]);

  const hasTask =
    /\btask\b\s*:/.test(t) ||
    hasAny(t, ["give me", "create", "produce", "generate", "write", "plan", "build", "summarise", "summarize", "list", "draft"]);

  const hasContext =
    /\bcontext\b\s*:/.test(t) ||
    hasAny(t, ["i am", "i’m", "we are", "for someone", "for colleagues", "for a visitor", "first time", "staying", "in june", "audience", "for"]);

  const hasFormat =
    /\bformat\b\s*:/.test(t) ||
    hasAny(t, ["bullet", "bullets", "table", "headings", "tone", "professional", "friendly", "constraints", "include", "must", "ensure", "distance", "fees", "costs", "time", "morning", "afternoon"]);

  const presentCount = [hasRole, hasTask, hasContext, hasFormat].filter(Boolean).length;

  // Score (/10) — keep simple and stable
  let score = 0;
  if (presentCount === 4) score = 10;
  else if (presentCount >= 2) score = 7;
  else score = 3;

  // Strengths (2–3 bullets)
  const strengths = [];
  if (hasRole) strengths.push("You set a clear role for the AI, which improves relevance.");
  if (hasTask) strengths.push("You stated what you want the AI to do, which makes the request actionable.");
  if (hasContext) strengths.push("You included context about the situation/audience, which helps the AI tailor the response.");
  if (hasFormat) strengths.push("You specified format/constraints, which improves structure and usefulness.");

  const strengthsTop = strengths.slice(0, 3);

  // Missing components → improvement notes
  const missing = [];
  if (!hasRole) missing.push("Add a **role** (who should the AI act as?).");
  if (!hasTask) missing.push("Add a clear **task** (what should the AI produce/do?).");
  if (!hasContext) missing.push("Add **context** (who is it for, where/when, key details).");
  if (!hasFormat) missing.push("Add **format/constraints** (bullets, tone, required info, limits).");

  // Rubric message
  let rubricMsg = "";
  if (presentCount === 4) rubricMsg = "Excellent – you’ve followed the prompt formula.";
  else if (presentCount >= 2) rubricMsg = "Good – try adding audience or tone to strengthen further.";
  else rubricMsg = "Needs improvement – use the formula: role, task, context, format.";

  // Feedback text (kept in the same UI box)
  const feedback =
    (rubricMsg ? rubricMsg + "\n\n" : "") +
    (missing.length === 0
      ? "Strong prompt — it includes role, task, context and format."
      : "To strengthen it:\n- " + missing.join("\n- "));

  // Tags (keep 5, FEthink-style)
  const tags = [
    { name: "Role", status: tagStatus(hasRole ? 2 : 0) },
    { name: "Task", status: tagStatus(hasTask ? 2 : 0) },
    { name: "Context", status: tagStatus(hasContext ? 2 : 0) },
    { name: "Format", status: tagStatus(hasFormat ? 2 : 0) },
    { name: "Clarity", status: tagStatus(presentCount >= 3 ? 2 : (presentCount === 2 ? 1 : 0)) }
  ];

  // Grid (5 rows; IDs remain the same for UI simplicity)
  const grid = {
    ethical: statusFromLevel(hasRole ? 2 : 0),
    impact: statusFromLevel(hasTask ? 2 : 0),
    legal: statusFromLevel(hasContext ? 2 : 0),
    recs: statusFromLevel(hasFormat ? 2 : 0),
    structure: statusFromLevel(presentCount === 4 ? 2 : (presentCount >= 2 ? 1 : 0))
  };

  return {
    gated: false,
    wordCount: wc,
    score,
    strengths: strengthsTop,
    tags,
    grid,
    framework: LEARN_MORE_TEXT,
    feedback,
    modelAnswer: MODEL_ANSWER
  };
}

/* ---------------- Routes ---------------- */
app.get("/api/config", (_req, res) => {
  res.json({
    ok: true,
    courseBackUrl: COURSE_BACK_URL,
    nextLessonUrl: NEXT_LESSON_URL,
    questionText: QUESTION_TEXT,
    templateText: TEMPLATE_TEXT,
    targetWords: "50–200",
    minWordsGate: 50
  });
});

app.post("/api/unlock", (req, res) => {
  const code = String(req.body?.code || "").trim();
  if (!code) return res.status(400).json({ ok: false, error: "missing_code" });

  // Constant-time compare
  const a = Buffer.from(code);
  const b = Buffer.from(ACCESS_CODE);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return res.status(401).json({ ok: false, error: "incorrect_code" });
  }

  setSessionCookie(res);
  res.json({ ok: true });
});

app.post("/api/mark", requireSession, (req, res) => {
  const answerText = clampStr(req.body?.answerText, 6000);
  const result = markPromptingResponse(answerText);
  res.json({ ok: true, result });
});

app.post("/api/logout", (_req, res) => {
  res.clearCookie(COOKIE_NAME);
  res.json({ ok: true });
});

app.get("/health", (_req, res) => res.status(200).send("ok"));

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Prompting automarker running on http://localhost:${port}`));
