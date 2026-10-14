import { useState, useRef, useEffect } from "react";

// Example questions for the built-in documents
const EXAMPLES = [
  "Can Gemini process PDF files?",
  "What file types can I pass besides PDF?",
];

const MAX_FILES = 5;
const MAX_CHARS = 30000;

// The file list is remembered in the browser so a refresh doesn't lose it
function loadFiles() {
  try {
    return JSON.parse(localStorage.getItem("files")) || [];
  } catch {
    return [];
  }
}

export default function App() {
  const [question, setQuestion] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [files, setFiles] = useState(loadFiles); // [{ id, name, chunks }]
  const [uploadStatus, setUploadStatus] = useState("");
  const fileInput = useRef(null);

  useEffect(() => {
    try {
      localStorage.setItem("files", JSON.stringify(files));
    } catch {
      // storage unavailable: the list just won't survive a refresh
    }
  }, [files]);

  async function handleAsk(q = question) {
    if (!q.trim()) return;
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q, uploadIds: files.map((f) => f.id) }),
      });
      const data = await res.json();
      if (res.status === 410 && data.missing) {
        // the server no longer has these files, so drop them from the list
        setFiles((prev) => prev.filter((f) => !data.missing.includes(f.id)));
      }
      if (!res.ok) throw new Error(data.error || "Request failed");
      setResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function pickExample(q) {
    setQuestion(q);
    handleAsk(q);
  }

  async function handleFiles(e) {
    const picked = Array.from(e.target.files || []);
    e.target.value = ""; // lets you pick the same file again later
    if (!picked.length) return;

    const room = MAX_FILES - files.length;
    if (room <= 0) {
      setError(`You can have up to ${MAX_FILES} files. Delete one first.`);
      return;
    }

    const batch = picked.slice(0, room);
    const problems = [];
    if (picked.length > room) problems.push(`Only ${room} more file(s) fit, so the rest were skipped.`);

    setError("");
    setResult(null);

    for (let i = 0; i < batch.length; i++) {
      const file = batch[i];
      setUploadStatus(`Processing ${file.name} (${i + 1} of ${batch.length})...`);

      if (!file.name.toLowerCase().endsWith(".txt")) {
        problems.push(`${file.name} is not a .txt file.`);
        continue;
      }
      try {
        const text = await file.text();
        if (text.length > MAX_CHARS) {
          throw new Error(`too long (maximum ${MAX_CHARS.toLocaleString()} characters).`);
        }
        const res = await fetch("/api/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: file.name, text }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Upload failed");
        setFiles((prev) => [...prev, data]);
      } catch (err) {
        problems.push(`${file.name}: ${err.message}`);
      }
    }

    setUploadStatus("");
    if (problems.length) setError(problems.join(" "));
  }

  async function removeFile(id) {
    setFiles((prev) => prev.filter((f) => f.id !== id));
    setResult(null);
    try {
      await fetch(`/api/upload/${id}`, { method: "DELETE" });
    } catch {
      // if this fails, the server drops the file on its own after an hour
    }
  }

  const busy = loading || Boolean(uploadStatus);

  return (
    <main className="page">
      <h1>Ask my documents</h1>
      <p className="lede">
        Ask a question and get an answer written only from the documents in
        this app, with the passages it used listed below. You can also upload
        your own .txt files.
      </p>

      <div className="ask">
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAsk()}
          placeholder={files.length ? "Ask about your files" : "Type your question"}
          aria-label="Your question"
        />
        <button onClick={() => handleAsk()} disabled={busy}>
          {loading ? "Thinking" : "Ask"}
        </button>
      </div>

      <section className="files" aria-label="Your files">
        <div className="files-head">
          <h2>Your files</h2>
          <input ref={fileInput} type="file" accept=".txt,text/plain" multiple onChange={handleFiles} hidden />
          <button onClick={() => fileInput.current.click()} disabled={busy || files.length >= MAX_FILES}>
            Upload .txt files
          </button>
        </div>

        {files.length === 0 ? (
          <p className="files-note">
            No files yet, so answers come from the built-in documents.
          </p>
        ) : (
          <ul>
            {files.map((f) => (
              <li key={f.id}>
                <span className="file-name">{f.name}</span>
                <span className="file-meta">{f.chunks} passages</span>
                <button onClick={() => removeFile(f.id)} aria-label={`Delete ${f.name}`}>
                  Delete
                </button>
              </li>
            ))}
          </ul>
        )}

        {uploadStatus && <p className="files-note thinking">{uploadStatus}</p>}
        <p className="files-note">
          Up to {MAX_FILES} files, {MAX_CHARS.toLocaleString()} characters each. Files are removed from the server after an hour.
        </p>
      </section>

      {!result && !loading && files.length === 0 && (
        <div className="examples">
          {EXAMPLES.map((q) => (
            <button key={q} onClick={() => pickExample(q)}>{q}</button>
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