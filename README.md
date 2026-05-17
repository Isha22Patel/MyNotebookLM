# NotebookLM Clone

A RAG-powered AI application that allows users to upload PDF or TXT documents and ask natural language questions about their contents.

Inspired by Google's NotebookLM, this project is built completely from scratch using Node.js, Express, LangChain, and Google Gemini models.

---

# 🚀 Features

- Advanced 3-Stage RAG Pipeline (Query Rewriting → Fast Retrieval → Final Generation)
- Automated Typo Correction and Query Intent Optimization
- Upload and chat with PDF & TXT documents
- Semantic search using vector embeddings
- Dynamic Token Trimming to prevent context bloat
- Grounded AI responses with minimal hallucination
- In-memory vector storage for fast retrieval
- Modern UI with premium dark mode and glassmorphism

---

# 🛠️ Tech Stack

- **Backend:** Node.js, Express.js
- **Frontend:** HTML5, CSS3, Vanilla JS
- **AI Framework:** LangChain JS
- **Embeddings:** `gemini-embedding-2`
- **LLM:** `gemini-flash-latest`
- **Vector Store:** `MemoryVectorStore`
- **Document Parsing:** Multer, PDFLoader, pdf-parse

---

# 📦 Setup & Installation

## 1. Clone Repository

```bash
git clone <YOUR_GITHUB_REPO_LINK>
cd googleLM-CLONE
```

## 2. Install Dependencies

```bash
npm install
```

## 3. Configure Environment Variables

Create a `.env` file:

```env
GOOGLE_API_KEY=your_google_api_key_here
PORT=3000
```

## 4. Start the Application

```bash
node index.js
```

## 5. Open in Browser

```txt
http://localhost:3000
```

---

# ⚙️ Architecture & Chunking Strategy

## 1. Ingestion

The app uses `multer` memory storage to securely buffer uploaded files without permanently storing them on disk.

- TXT files are directly converted into text
- PDFs are processed using LangChain's `PDFLoader`
- Temporary files are automatically cleaned after processing

---

## 2. Chunking Strategy

Implemented **Recursive Character Text Splitting** using:

```js
RecursiveCharacterTextSplitter
```

### Configuration

- **Chunk Size:** `1000 characters`
- **Chunk Overlap:** `200 characters`

### Why this strategy?

This chunking strategy intelligently splits text by paragraphs, sentences, and words while preserving semantic meaning and avoiding context loss. An overlap of 200 characters ensures that concepts spanning across chunk boundaries are not lost, providing better context for the LLM during generation.

---

## 3. Embeddings & Storage

Chunks are converted into embeddings using:

```txt
gemini-embedding-2
```

via `GoogleGenerativeAIEmbeddings`. The embeddings are stored inside an in-memory `MemoryVectorStore`. Each uploaded document gets a unique `docId`.

---

## 4. Advanced RAG Pipeline (3-Stage)

When a user asks a question, it goes through an optimized 3-stage pipeline:

### Stage 1: Query Rewriting
- The user's query is passed to an LLM (`gemini-flash-latest`) to fix spelling mistakes, correct grammatical errors, and rephrase for optimal semantic search retrieval.

### Stage 2: Fast Vector Retrieval
- The rewritten query is embedded and used to retrieve the top 6 most relevant chunks (`k: 6`).
- **Token Trimming:** The retrieved chunks are dynamically trimmed so that the total context size stays under 6000 characters, preventing context window bloat and reducing latency.

### Stage 3: Final Generation
- The trimmed context and rewritten query are injected into the final prompt.
- The model (`gemini-flash-latest`) generates a response, strictly using ONLY the provided document context to minimize hallucinations.
- The response also includes a note if the original query was modified due to typos.

---

# 🔌 API Endpoints

## Upload Document

### POST `/upload`

Uploads and indexes a PDF or TXT file.

### Response

```json
{
  "message": "File successfully processed and indexed.",
  "docId": "123456789"
}
```

---

## Ask Question

### POST `/ask`

### Request Body

```json
{
  "question": "What is the document about?",
  "docId": "123456789"
}
```

### Response

```json
{
  "answer": "Generated answer here"
}
```

---

# 🔗 Deployment

## GitHub Repository

```txt
[Link to your GitHub Repo]
```

## Live Project

```txt
[Link to your Live Deployment]
```

### Recommended Platforms

- Render
- Railway
- Vercel
- AWS

---
