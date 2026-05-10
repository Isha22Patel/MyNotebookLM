# NotebookLM Clone

A RAG-powered AI application that allows users to upload PDF or TXT documents and ask natural language questions about their contents.

Inspired by Google's NotebookLM, this project is built completely from scratch using Node.js, Express, LangChain, and Google Gemini models.

---

# 🚀 Features

- Full RAG Pipeline (Ingestion → Chunking → Embedding → Retrieval → Generation)
- Upload and chat with PDF & TXT documents
- Semantic search using vector embeddings
- Grounded AI responses with minimal hallucination
- In-memory vector storage for fast retrieval
- Modern UI built with Vanilla HTML, CSS, and JavaScript

---

# 🛠️ Tech Stack

- **Backend:** Node.js, Express.js
- **Frontend:** HTML5, CSS3, Vanilla JS
- **AI Framework:** LangChain JS
- **Embeddings:** `gemini-embedding-2`
- **LLM:** `gemini-2.5-flash`
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

## 2. Chunking

Implemented **Recursive Character Text Splitting** using:

```js
RecursiveCharacterTextSplitter
```

### Configuration

- **Chunk Size:** `1000 characters`
- **Chunk Overlap:** `200 characters`

### Why?

This strategy intelligently splits text by paragraphs, sentences, and words while preserving semantic meaning and avoiding context loss.

---

## 3. Embeddings & Storage

Chunks are converted into embeddings using:

```txt
gemini-embedding-2
```

via:

```js
GoogleGenerativeAIEmbeddings
```

The embeddings are stored inside:

```js
MemoryVectorStore
```

Each uploaded document gets a unique `docId`.

---

## 4. Retrieval & Generation

When a user asks a question:

1. The query is embedded
2. Top relevant chunks are retrieved
3. Retrieved chunks are injected into the prompt
4. Response is generated using:

```txt
gemini-2.5-flash
```

The model is forced to answer ONLY from the provided document context to minimize hallucinations.

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
