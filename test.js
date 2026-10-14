import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// 1. Embedding: turn text into a list of numbers
const emb = await ai.models.embedContent({
  model: "gemini-embedding-001",
  contents: "The partitive case is used for unfinished actions.",
});
console.log("Embedding length:", emb.embeddings[0].values.length);

// 2. Chat: ask the model something
const res = await ai.models.generateContent({
  model: "gemini-3.5-flash-lite",
  contents: "Say hello in one short sentence.",
});
console.log("Answer:", res.text);