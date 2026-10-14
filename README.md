# Rag-app

# Ask My Documents (RAG app)

A small retrieval-augmented generation (RAG) app. Ask a question and get an
answer written only from a set of documents, with the passages it used shown
as sources. You can also upload your own .txt files.


## How it works

1. **Ingest:** Documents are split into chunks of about 500 characters at
   paragraph breaks. Each chunk is turned into an embedding (a list of numbers
   that represents its meaning) with the Gemini embedding model.
2. **Retrieve:** The question is embedded the same way, and the 3 chunks with
   the highest cosine similarity are selected.
3. **Generate:** The chunks and the question go to a Gemini chat model with an
   instruction to answer only from the text, cite sources, and say when the
   answer isn't there.

Embeddings are stored in a JSON file and compared in memory. No vector
database is used, to keep the system small enough to understand end to end.

## Features

- Answers with numbered source passages and similarity scores
- Upload up to 5 .txt files, see them in a list, and delete them
- Retries on temporary API errors and clear messages for quota limits
- Limits on file and question size to protect the API quota

## Tech stack

React (Vite), Node.js, Express, Google Gemini API (`@google/genai`)

## Run locally

```bash
git clone [your repo URL]
cd rag-app
npm install
cd client && npm install && cd ..
```

Create a `.env` file with your key from Google AI Studio:

```
GEMINI_API_KEY=your-key-here
```

Put .txt files in `docs/`, then build the index and start the app:

```bash
node --env-file=.env ingest.js
node --env-file=.env server.js
```

In a second terminal:

```bash
cd client && npm run dev
```

Open http://localhost:5173.

## Limitations and what I'd improve

- **Simple chunking:** fixed-size chunks can split an idea in half. I'd test
  different sizes and overlap.
- **In-memory storage:** uploaded files disappear after an hour or on server
  restart. A database such as Postgres with pgvector would make them persistent.
- **No evaluation yet:** I haven't measured answer quality. Next I plan to
  build a test set of questions and compare prompts and models.
- **Free-tier limits:** the Gemini free tier has a small daily request limit,
  so the demo may show a quota message.
- **Plain text only:** no PDF or other formats yet.
- **Privacy:** uploaded text is sent to Google's API, so don't upload
  sensitive documents.
