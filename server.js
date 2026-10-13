import express from "express";
import fs from "node:fs";
import { ask } from "./rag.js";

const app = express();
app.use(express.json());

app.post("/api/ask", async (req, res) => {
  const question = req.body?.question?.trim();
  if (!question) return res.status(400).json({ error: "Please enter a question." });
  if (question.length > 500) return res.status(400).json({ error: "Question is too long." });

  try {
    res.json(await ask(question));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Something went wrong. Try again in a minute." });
  }
});

// Serve the built React app (used when deployed)
if (fs.existsSync("client/dist")) {
  app.use(express.static("client/dist"));
}

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Server running on http://localhost:${port}`));