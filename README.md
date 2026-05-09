# NotebookLM Clone - Powered by Gemini API

A full RAG-powered application allowing users to upload a document and have natural language conversations about its contents. This project closely mimics Google's NotebookLM and is built entirely from scratch.

## 🚀 Features

- **Full RAG Pipeline**: Ingestion → Chunking → Embedding → Storage → Retrieval → Generation.
- **Support for PDF & TXT**: Upload documents with zero prior knowledge.
- **Vector Database**: Uses a local, in-memory vector database (`MemoryVectorStore`) for seamless setup.
- **Gemini Powered**: Uses Google's `text-embedding-004` for embedding and `gemini-2.5-flash` for answering.
- **Grounded Answers**: The LLM context window is strictly injected with the retrieved chunks, ensuring minimal hallucination.
- **Modern UI/UX**: Includes a glassmorphic UI built with pure CSS and Vanilla JS.

## 🛠️ Technology Stack

- **Backend**: Node.js, Express.js
- **Frontend**: HTML5, CSS3 (Vanilla), Vanilla JS
- **AI/RAG framework**: LangChain for JS/Node
- **Document Parsing**: `pdf-parse`, Multer (memory buffering)

## 📦 Setup & Installation

1. **Clone the repository:**
   ```bash
   git clone <YOUR_GITHUB_REPO_LINK>
   cd googleLM-CLONE
   ```

2. **Install Dependencies:**
   ```bash
   npm install
   ```

3. **Configure Environment Variables:**
   - Create a `.env` file in the root directory (or use the existing one).
   - Add your Google Gemini API Key:
   ```env
   GOOGLE_API_KEY=your_gemini_api_key_here
   PORT=3000
   ```

4. **Start the Application:**
   ```bash
   node index.js
   ```

5. **Access the App:**
   Open your browser and navigate to `http://localhost:3000`.

## ⚙️ Architecture & Chunking Strategy

### 1. Ingestion
The app uses `multer` memory storage to buffer the file securely without writing to disk. PDFs are processed via `pdf-parse` to extract pure text.

### 2. Chunking
Implemented **Recursive Character Text Splitting** (`RecursiveCharacterTextSplitter`):
- **Chunk Size**: `1000 characters`
- **Chunk Overlap**: `200 characters`
- **Why?**: This strategy intelligently tries to split at paragraphs, then sentences, preserving semantic meaning across boundaries while ensuring contexts aren't cut mid-sentence.

### 3. Embeddings & Storage
Chunks are sent to Google's `text-embedding-004` model. The resulting vector embeddings are stored inside a fast, in-process `MemoryVectorStore` mapping to a unique document ID.

### 4. Retrieval & Generation
When a user asks a query, the text is embedded, and a semantic similarity search fetches the top 4 most relevant chunks. The chunks are merged into a strict system prompt and fed into `gemini-2.5-flash` with a low temperature (`0.2`) to force grounded, accurate responses.

## 🔗 Deployment

- **GitHub Repository**: `[Link to your GitHub Repo]`
- **Live Project**: `[Link to your Live deployment]`

*(Ensure you deploy this Node application to platforms like Render, Vercel, or Heroku to get the live project link).*
