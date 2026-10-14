import express from "express";
import fs from "node:fs";
import crypto from "node:crypto";
import { ask, chunkText, embedChunks } from "./rag.js";

const app = express();
app.use(express.json({ limit: "200kb" }));

const MAX_CHARS = 30000;       // max size of one uploaded file
const MAX_FILES_PER_ASK = 5;   // max files searched in one question
const MAX_UPLOADS = 50;        // max files kept in memory at once
const TTL_MS = 60 * 60 * 1000; // uploads are deleted after 1 hour

const uploads = new Map(); // id -> { name, records, created }

setInterval(() => {
  const now = Date.now();
  for (const [id, u] of uploads) if (now - u.created > TTL_MS) uploads.delete(id);
}, 5 * 60 * 1000).unref();

function errorResponse(err, res, fallback) {
  console.error(err);
  if (err.status === 429) {
    return res.status(429).json({ error: "The daily free quota has been reached. Please try again tomorrow." });
  }
  res.status(500).json({ error: fallback });
}

// Upload one file
app.post("/api/upload", async (req, res) => {
  const name = String(req.body?.name || "uploaded.txt").slice(0, 100);
  const text = String(req.body?.text || "").trim();
  if (!text) return res.status(400).json({ error: "The file is empty." });
  if (text.length > MAX_CHARS) {
    return res.status(400).json({ error: `File is too long. The maximum is ${MAX_CHARS.toLocaleString()} characters.` });
  }

  try {
    const chunks = chunkText(text);
    const records = await embedChunks(chunks, name);
    if (uploads.size >= MAX_UPLOADS) uploads.delete(uploads.keys().next().value); // drop the oldest
    const id = crypto.randomUUID();
    uploads.set(id, { name, records, created: Date.now() });
    res.json({ id, name, chunks: chunks.length });
  } catch (err) {
    errorResponse(err, res, "Could not process the file. Try again in a minute.");
  }
});

// Delete one file
app.delete("/api/upload/:id", (req, res) => {
  uploads.delete(req.params.id);
  res.json({ ok: true });
});

// Ask a question (about the given files, or the built-in documents if none)
app.post("/api/ask", async (req, res) => {
  const question = req.body?.question?.trim();
  if (!question) return res.status(400).json({ error: "Please enter a question." });
  if (question.length > 500) return res.status(400).json({ error: "Question is too long." });

  const ids = Array.isArray(req.body.uploadIds)
    ? req.body.uploadIds.filter((id) => typeof id === "string").slice(0, MAX_FILES_PER_ASK)
    : [];

  let records; // undefined = use the built-in documents
  if (ids.length) {
    const missing = ids.filter((id) => !uploads.has(id));
    if (missing.length) {
      return res.status(410).json({
        error: "Some uploaded files have expired and were removed from your list. Upload them again if you still need them.",
        missing,
      });
    }
    records = ids.flatMap((id) => uploads.get(id).records);
  }

  try {
    res.json(await ask(question, records));
  } catch (err) {
    errorResponse(err, res, "Something went wrong. Try again in a minute.");
  }
});

// Serve the built React app (used when deployed)
if (fs.existsSync("client/dist")) {
  app.use(express.static("client/dist"));
}

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Server running on http://localhost:${port}`));