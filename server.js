import express from "express";
import crypto from "node:crypto";
import { GoogleGenAI } from "@google/genai";
import { chunkText, rankChunks, pickEvenly, buildContext } from "./retrieval.js";
import { rateLimit } from "./Limiter.js";
import { friendlyError } from "./Errors.js";

const app = express();
const PORT = process.env.PORT || 3000;
const MODEL = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";
const ACCESS_CODE = process.env.ACCESS_CODE || ""; // optional: protects the API when deployed

const MAX_NOTES = 500000;  // characters of notes accepted
const SMALL_NOTES = 8000;  // notes this short are sent whole
const CHAT_CHUNKS = 5;     // sections sent per chat question
const QUIZ_CHUNKS = 8;     // sections sent per quiz / flashcard deck on long notes

const ai = new GoogleGenAI({}); // reads GEMINI_API_KEY from the environment

if (process.env.TRUST_PROXY) app.set("trust proxy", 1); // set this when deployed behind a host proxy
app.disable("x-powered-by");
app.use(express.json({ limit: "5mb" }));
app.use(express.static("public"));

app.get("/api/health", (req, res) => res.json({ ok: true, model: MODEL }));

function safeEqual(a, b) {
  const A = Buffer.from(String(a)), B = Buffer.from(String(b));
  return A.length === B.length && crypto.timingSafeEqual(A, B);
}
function requireCode(req, res, next) {
  if (!ACCESS_CODE || safeEqual(req.get("x-access-code") || "", ACCESS_CODE)) return next();
  res.status(401).json({ error: "Access code required." });
}
app.use("/api", requireCode, rateLimit({ windowMs: 60000, max: Number(process.env.RATE_LIMIT_PER_MIN) || 20 }));

// ---------- Helpers ----------
function selectNotes(notes, topic) {
  const text = notes.trim().slice(0, MAX_NOTES);
  const chunks = chunkText(text);
  let ids;
  if (text.length <= SMALL_NOTES) ids = chunks.map((_, i) => i);        // short: use everything
  else if (topic) ids = rankChunks(chunks, topic, QUIZ_CHUNKS);          // long + topic: best matches
  else ids = pickEvenly(chunks, QUIZ_CHUNKS);                            // long: spread across the document
  return buildContext(chunks, ids);
}

async function generateJSON(prompt) {
  const response = await ai.models.generateContent({
    model: MODEL,
    contents: prompt,
    config: { responseMimeType: "application/json" },
  });
  if (!response.text) {
    throw Object.assign(new Error("empty"), { userMessage: "The AI returned an empty answer. Please try again." });
  }
  try {
    return JSON.parse(response.text.replace(/```json|```/gi, "").trim());
  } catch (e) {
    throw Object.assign(new Error("bad json"), { userMessage: "The AI returned something I could not read. Please try again." });
  }
}

const clamp = (n, lo, hi, dflt) => {
  const v = Number(n);
  return Number.isFinite(v) ? Math.min(hi, Math.max(lo, Math.floor(v))) : dflt;
};
const fail = (res, error, label) => {
  const f = friendlyError(error);
  console.error(`${label}:`, error && error.message);
  return res.status(f.status).json({ error: f.message });
};

// ---------- Quiz ----------
app.post("/api/quiz", async (req, res) => {
  try {
    const { notes, count = 5, topic = "" } = req.body ?? {};
    if (typeof notes !== "string" || notes.trim().length < 80) {
      return res.status(400).json({ error: "Please provide at least 80 characters of study notes." });
    }
    const n = clamp(count, 1, 10, 5);
    const topicText = String(topic).trim().slice(0, 200);

    const prompt = `
Create exactly ${n} multiple-choice questions using ONLY the study notes below.
Test understanding, not just word-matching.${topicText ? `\nFocus on this topic: ${topicText}` : ""}

Return only a valid JSON array. Each item must contain:
- "q": the question text
- "options": exactly four answer options (strings)
- "answer": index of the correct option, an integer from 0 to 3
- "explanation": one or two sentences explaining the correct answer

Do not invent facts beyond the notes. Vary the correct answer position.

STUDY NOTES:
${selectNotes(notes, topicText)}
`;
    const parsed = await generateJSON(prompt);
    const questions = (Array.isArray(parsed) ? parsed : []).filter(
      (q) =>
        q &&
        typeof q.q === "string" && q.q.trim() &&
        Array.isArray(q.options) && q.options.length === 4 &&
        q.options.every((o) => typeof o === "string" && o.trim()) &&
        Number.isInteger(q.answer) && q.answer >= 0 && q.answer <= 3 &&
        typeof q.explanation === "string" && q.explanation.trim()
    );
    if (!questions.length) {
      throw Object.assign(new Error("no valid questions"), { userMessage: "I could not build a quiz from that. Try adding more detail to your notes." });
    }
    return res.json(questions);
  } catch (error) {
    return fail(res, error, "Quiz error");
  }
});

// ---------- Flashcards ----------
app.post("/api/flashcards", async (req, res) => {
  try {
    const { notes, count = 10, topic = "" } = req.body ?? {};
    if (typeof notes !== "string" || notes.trim().length < 80) {
      return res.status(400).json({ error: "Please provide at least 80 characters of study notes." });
    }
    const n = clamp(count, 3, 20, 10);
    const topicText = String(topic).trim().slice(0, 200);

    const prompt = `
Create exactly ${n} flashcards using ONLY the study notes below.
Cover the most important terms, definitions, facts and processes.${topicText ? `\nFocus on this topic: ${topicText}` : ""}

Return only a valid JSON array. Each item must contain:
- "front": a short question or term (under 15 words)
- "back": a clear answer in one or two sentences

Do not invent facts beyond the notes.

STUDY NOTES:
${selectNotes(notes, topicText)}
`;
    const parsed = await generateJSON(prompt);
    const cards = (Array.isArray(parsed) ? parsed : []).filter(
      (c) => c && typeof c.front === "string" && c.front.trim() && typeof c.back === "string" && c.back.trim()
    );
    if (!cards.length) {
      throw Object.assign(new Error("no valid cards"), { userMessage: "I could not build flashcards from that. Try adding more detail to your notes." });
    }
    return res.json(cards);
  } catch (error) {
    return fail(res, error, "Flashcards error");
  }
});

// ---------- Chat (retrieval + streaming) ----------
app.post("/api/chat", async (req, res) => {
  const { notes = "", history } = req.body ?? {};

  const msgs = (Array.isArray(history) ? history : [])
    .filter((m) => m && typeof m.content === "string" && m.content.trim())
    .map((m) => ({ role: m.role === "assistant" ? "model" : "user", content: m.content.trim().slice(0, 2000) }))
    .slice(-20);
  while (msgs.length && msgs[0].role === "model") msgs.shift();

  if (!msgs.length || msgs[msgs.length - 1].role !== "user") {
    return res.status(400).json({ error: "Please send a question." });
  }
  const text = String(notes).trim().slice(0, MAX_NOTES);
  if (text.length < 20) return res.status(400).json({ error: "Please add your notes first." });

  const chunks = chunkText(text);
  const query = msgs.filter((m) => m.role === "user").slice(-2).map((m) => m.content).join(" "); // follow-ups still match
  const ids = text.length <= SMALL_NOTES ? chunks.map((_, i) => i) : rankChunks(chunks, query, CHAT_CHUNKS);

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.flushHeaders();

  let closed = false;
  res.on("close", () => { closed = true; }); // the browser left or pressed Stop

  res.write(`data: ${JSON.stringify({ sources: ids.map((i) => i + 1), total: chunks.length })}\n\n`);

  try {
    const stream = await ai.models.generateContentStream({
      model: MODEL,
      contents: msgs.map((m) => ({ role: m.role, parts: [{ text: m.content }] })),
      config: {
        systemInstruction:
          "You are a friendly study tutor. The sections below are excerpts from the student's notes. " +
          "Answer using ONLY these excerpts. If they don't contain the answer, say so and suggest what to look up. " +
          "Be concise and use simple examples when helpful.\n\nNOTES:\n" +
          buildContext(chunks, ids),
      },
    });
    for await (const chunk of stream) {
      if (closed) break; // stop generating when the browser disconnects
      if (chunk.text) res.write(`data: ${JSON.stringify(chunk.text)}\n\n`);
    }
  } catch (error) {
    console.error("Chat error:", error && error.message);
    if (!closed) res.write(`data: ${JSON.stringify("\n[" + friendlyError(error).message + "]")}\n\n`);
  }

  if (!closed) { res.write("data: [DONE]\n\n"); res.end(); }
});

// ---------- Fallbacks ----------
app.use((req, res) => res.status(404).json({ error: `Endpoint not found: ${req.method} ${req.path}` }));

app.use((err, req, res, next) => {
  if (err && err.type === "entity.too.large") return res.status(413).json({ error: "Those notes are too large. Try a shorter document." });
  if (err instanceof SyntaxError) return res.status(400).json({ error: "Bad request." });
  console.error("Server error:", err && err.message);
  res.status(500).json({ error: "Server error. Please try again." });
});

app.listen(PORT, () => {
  console.log(`Study Buddy running at http://localhost:${PORT}`);
  console.log(`Using model: ${MODEL}${ACCESS_CODE ? " (access code required)" : ""}`);
});
