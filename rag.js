import { GoogleGenAI } from "@google/genai";
import fs from "node:fs";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const records = JSON.parse(fs.readFileSync("embeddings.json", "utf-8"));

// How similar are two fingerprints? Higher = more similar (max 1)
function cosineSimilarity(a, b) {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}
// Retry when Google is busy (503) or rate limiting (429)
async function withRetry(fn, tries = 3) {
  for (let i = 0; i < tries; i++) {
    try {
      return await fn();
    } catch (err) {
      const retryable = err.status === 503 || err.status === 429;
      if (!retryable || i === tries - 1) throw err;
      await new Promise((r) => setTimeout(r, 1500 * (i + 1)));
    }
  }
}
export async function ask(question) {
  // 1. Make a fingerprint of the question
  const res = await ai.models.embedContent({
    model: "gemini-embedding-001",
    contents: question,
  });
  const questionEmbedding = res.embeddings[0].values;

  // 2. Find the 3 most similar chunks
  const topChunks = records
    .map((r) => ({ ...r, score: cosineSimilarity(questionEmbedding, r.embedding) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  // 3. Build a prompt that includes those chunks
  const context = topChunks
    .map((c, i) => `[${i + 1}] (${c.source})\n${c.text}`)
    .join("\n\n");

  const prompt = `Answer the question using ONLY the text below.
If the answer is not in the text, say "I don't know based on the documents."
Mention which source numbers you used, like [1] or [2].

TEXT:
${context}

QUESTION: ${question}`;

  const answer = await withRetry(() =>
  ai.models.generateContent({
    model: "gemini-3.8-flash",
    contents: prompt,
  })
);

  return {
    answer: answer.text,
    sources: topChunks.map((c) => ({ source: c.source, text: c.text, score: c.score })),
  };
}