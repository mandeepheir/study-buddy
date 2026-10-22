
import express from "express";
import { GoogleGenAI } from "@google/genai";

const app = express();
const PORT = 3000;
const MODEL = "gemini-3.5-flash-lite";

const ai = new GoogleGenAI({});

app.use(express.json({ limit: "1mb" }));

// Home route
app.get("/", (req, res) => {
  res.json({
    message: "Study Buddy API is running!",
    endpoints: {
      chat: "POST /api/chat",
      quiz: "POST /api/quiz",
    },
  });
});

// AI chat endpoint
app.post("/api/chat", async (req, res) => {
  try {
    const { message } = req.body ?? {};

    if (typeof message !== "string" || !message.trim()) {
      return res.status(400).json({
        error: "Please provide a valid message.",
      });
    }

    const response = await ai.models.generateContent({
      model: MODEL,
      contents: message.trim(),
    });

    return res.json({ reply: response.text });
  } catch (error) {
    console.error("Chat error:", error.message);
    return res.status(500).json({
      error: "Unable to generate a response. Please try again.",
    });
  }
});

// Quiz generation endpoint
app.post("/api/quiz", async (req, res) => {
  try {
    const { notes, count = 5 } = req.body ?? {};

    if (typeof notes !== "string" || notes.trim().length < 80) {
      return res.status(400).json({
        error: "Please provide at least 80 characters of study notes.",
      });
    }

    const parsedCount = Number(count);
    const questionCount = Number.isFinite(parsedCount)
      ? Math.min(10, Math.max(1, Math.floor(parsedCount)))
      : 5;

    const prompt = `
Create exactly ${questionCount} multiple-choice questions using ONLY
the study notes below.

Return only a valid JSON array, without Markdown code fences.
Each question must contain:
- "q": question text
- "options": exactly four answer options
- "answer": correct option index, an integer from 0 to 3
- "explanation": explanation of the correct answer

Do not invent facts beyond the notes.
Vary the correct answer position.

STUDY NOTES:
${notes.trim().slice(0, 12000)}
`;

    const response = await ai.models.generateContent({
      model: MODEL,
      contents: prompt,
    });

    if (!response.text) {
      throw new Error("The AI returned an empty response.");
    }

    const cleanedText = response.text
      .replace(/```json/gi, "")
      .replace(/```/g, "")
      .trim();

    const questions = JSON.parse(cleanedText);

    const valid =
      Array.isArray(questions) &&
      questions.length === questionCount &&
      questions.every(
        (q) =>
          q &&
          typeof q.q === "string" &&
          q.q.trim() &&
          Array.isArray(q.options) &&
          q.options.length === 4 &&
          q.options.every(
            (option) => typeof option === "string" && option.trim()
          ) &&
          Number.isInteger(q.answer) &&
          q.answer >= 0 &&
          q.answer <= 3 &&
          typeof q.explanation === "string" &&
          q.explanation.trim()
      );

    if (!valid) {
      throw new Error("The AI returned invalid quiz data.");
    }

    return res.json(questions);
  } catch (error) {
    console.error("Quiz generation error:", error.message);
    return res.status(500).json({
      error: "Could not generate the quiz. Please try again.",
    });
  }
});

// Unknown endpoints
app.use((req, res) => {
  res.status(404).json({
    error: `Endpoint not found: ${req.method} ${req.path}`,
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Study Buddy server running at http://localhost:${PORT}`);
  console.log("Available routes: GET /, POST /api/chat, POST /api/quiz");
});
