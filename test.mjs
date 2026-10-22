
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({});

const response = await ai.models.generateContent({
  model: "gemini-3.5-flash-lite",
  contents: "Explain what an API is in one sentence.",
});

console.log(response.text);
