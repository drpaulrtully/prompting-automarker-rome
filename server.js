import express from "express";
import fetch from "node-fetch";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

/* ===============================
   TASK TEXT (UPDATED SPACING)
   =============================== */

const QUESTION_TEXT = `
Scenario – you are travelling to the city of Rome in June and you will be staying at a hotel in the city centre. You are there for 1 week and you want AI to produce a 7-day itinerary for your visit.


A weak prompt would be:

What will I see when I visit Rome?


Your task is to rephrase this into a stronger prompt using the 4-stage structure covered earlier:


Role: Tell AI who you are, or what role you want it to adopt.
Task: What do you want AI to do?
Context: Who is AI creating the content for?
Format: How do you want the AI to present the information (structure, tone) – what specific information (constraints) are you requiring?


Aim for 50–200 words.
`;

const TEMPLATE_TEXT = `
Role:
Task:
Context:
Format:
`;

/* ===============================
   CONFIG ENDPOINT
   =============================== */

app.get("/api/config", (req, res) => {
  res.json({
    questionText: QUESTION_TEXT,
    templateText: TEMPLATE_TEXT,
    minWords: 50,
    maxWords: 200,
    backUrl: process.env.BACK_URL,
    nextLessonUrl: process.env.NEXT_LESSON_URL
  });
});

/* ===============================
   ACCESS CODE CHECK
   =============================== */

app.post("/api/check-code", (req, res) => {
  const { code } = req.body;

  if (code === process.env.ACCESS_CODE) {
    res.json({ success: true });
  } else {
    res.status(401).json({ success: false });
  }
});

/* ===============================
   MARKING ENDPOINT
   =============================== */

app.post("/api/mark", async (req, res) => {
  const { responseText, wordCount } = req.body;

  if (wordCount < 50) {
    return res.json({
      status: "too_short",
      message: "Please add more detail to your response before submitting."
    });
  }

  try {
    const prompt = `
You are an assessment assistant.

Evaluate the learner's response using the following criteria:
- Role
- Task
- Context
- Format

Return:
- A score out of 10
- 2–3 strengths
- Feedback tags
- A strengths / gaps grid
- A brief summary message aligned to:
  • All present → “Excellent – you’ve followed the prompt formula.”
  • 2–3 present → “Good – try adding audience or tone to strengthen further.”
  • 0–1 present → “Needs improvement – use the formula: role, task, context, format.”

Learner response:
${responseText}
`;

    const openaiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3
      })
    });

    const data = await openaiResponse.json();
    const output = data.choices[0].message.content;

    res.json({
      status: "marked",
      feedback: output
    });
  } catch (err) {
    res.status(500).json({ error: "Error marking response" });
  }
});

/* ===============================
   START SERVER
   =============================== */

app.listen(PORT, () => {
  console.log(`FEthink automarker running on port ${PORT}`);
});
