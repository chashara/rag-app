import { useState } from "react";

// Change these to questions your own documents can answer
const EXAMPLES = [
  "Can Gemini process PDF files?",
  "What file types can I pass besides PDF?",
];

export default function App() {
  const [question, setQuestion] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleAsk(q = question) {
    if (!q.trim()) return;
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Request failed");
      setResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function useExample(q) {
    setQuestion(q);
    handleAsk(q);
  }

  return (
    <main className="page">
      <h1>Ask my documents</h1>
      <p className="lede">
        Ask a question and get an answer written only from the documents loaded
        in this app, with the passages it used listed below.
      </p>

      <div className="ask">
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAsk()}
          placeholder="Type your question"
          aria-label="Your question"
        />
        <button onClick={() => handleAsk()} disabled={loading}>
          {loading ? "Thinking" : "Ask"}
        </button>
      </div>

      {!result && !loading && (
        <div className="examples">
          {EXAMPLES.map((q) => (
            <button key={q} onClick={() => useExample(q)}>{q}</button>
          ))}
        </div>
      )}

      {error && <p className="error">{error}</p>}
      {loading && <p className="thinking">Searching the documents and writing an answer...</p>}

      {result && (
        <>
          <section className="answer">
            <p>{result.answer}</p>
          </section>

          <section className="sources">
            <h2>Passages used</h2>
            {result.sources.map((s, i) => (
              <div className="source" key={i}>
                <span className="marker">[{i + 1}]</span>
                <div className="source-head">
                  <span>{s.source}</span>
                  <span className="match">
                    similarity {s.score.toFixed(2)}
                    <span className="bar"><span style={{ width: `${Math.round(s.score * 100)}%` }} /></span>
                  </span>
                </div>
                <p className="source-text">{s.text}</p>
              </div>
            ))}
          </section>
        </>
      )}
    </main>
  );
}