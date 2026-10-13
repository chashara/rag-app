import { ask } from "./rag.js";

const question = process.argv.slice(2).join(" ");
const { answer, sources } = await ask(question);

console.log("\nANSWER:\n" + answer);
console.log("\nSOURCES:");
sources.forEach((s, i) =>
  console.log(`[${i + 1}] ${s.source} (score ${s.score.toFixed(2)}): ${s.text.slice(0, 80)}...`)
);