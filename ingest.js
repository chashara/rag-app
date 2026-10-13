import { GoogleGenAI } from "@google/genai";
import fs from "node:fs";
import path from "node:path";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Split text into chunks of roughly 500 characters, breaking at paragraphs
function chunkText(text, size = 500) {
  const paragraphs = text.split(/\n\s*\n/);
  const chunks = [];
  let current = "";
  for (const p of paragraphs) {
    if (current && (current + p).length > size) {
      chunks.push(current.trim());
      current = "";
    }
    current += p + "\n\n";
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks;
}

const records = [];

for (const file of fs.readdirSync("docs").filter((f) => f.endsWith(".txt"))) {
  const text = fs.readFileSync(path.join("docs", file), "utf-8");
  const chunks = chunkText(text);

  // Embed 20 chunks per request
  for (let i = 0; i < chunks.length; i += 20) {
    const batch = chunks.slice(i, i + 20);
    const res = await ai.models.embedContent({
      model: "gemini-embedding-001",
      contents: batch,
    });
    res.embeddings.forEach((e, j) => {
      records.push({ source: file, text: batch[j], embedding: e.values });
    });
  }
  console.log(`${file}: ${chunks.length} chunks`);
}

fs.writeFileSync("embeddings.json", JSON.stringify(records));
console.log(`Saved ${records.length} chunks to embeddings.json`);