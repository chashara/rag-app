import { GoogleGenAI } from "@google/genai";
import fs from "node:fs";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const defaultRecords = JSON.parse(fs.readFileSync("embeddings.json", "utf-8"));

function cosineSimilarity(a, b) {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

// Retry when Google is busy (503). A 429 is a quota limit, so retrying won't help.
async function withRetry(fn, tries = 3) {
  for (let i = 0; i < tries; i++) {
    try {
      return await fn();
    } catch (err) {
      const retryable = err.status === 503;
      if (!retryable || i === tries - 1) throw err;
      await new Promise((r) => setTimeout(r, 1500 * (i + 1)));
    }
  }
}

// Split text into chunks of roughly 500 characters, breaking at paragraphs
export function chunkText(text, size = 500) {
  const pieces = [];
  for (const p of text.split(/\n\s*\n/).filter((p) => p.trim())) {
    if (p.length <= size * 2) pieces.push(p);
    else for (let i = 0; i < p.length; i += size) pieces.push(p.slice(i, i + size)); // very long paragraph
  }
  const chunks = [];
  let current = "";
  for (const p of pieces) {
    if (current && (current + p).length > size) {
      chunks.push(current.trim());
      current = "";
    }
    current += p + "\n\n";
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks;
}

// Turn chunks into records with embeddings (20 per request)
export async function embedChunks(chunks, source) {
  const records = [];
  for (let i = 0; i < chunks.length; i += 20) {
    const batch = chunks.slice(i, i + 20);
    const res = await withRetry(() =>
      ai.models.embedContent({ model: "gemini-embedding-001", contents: batch })
    );
    res.embeddings.forEach((e, j) => {
      records.push({ source, text: batch[j], embedding: e.values });
    });
  }
  return records;
}

export async function ask(question, records = defaultRecords) {
  const res = await withRetry(() =>
    ai.models.embedContent({ model: "gemini-embedding-001", contents: question })
  );
  const questionEmbedding = res.embeddings[0].values;

  const topChunks = records
    .map((r) => ({ ...r, score: cosineSimilarity(questionEmbedding, r.embedding) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

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
    ai.models.generateContent({ model: "gemini-3.8-flash", contents: prompt })
  );

  return {
    answer: answer.text,
    sources: topChunks.map((c) => ({ source: c.source, text: c.text, score: c.score })),
  };
}