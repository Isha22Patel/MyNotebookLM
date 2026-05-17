require("dotenv").config();
const express = require("express");
const multer = require("multer");
const { RecursiveCharacterTextSplitter } = require("@langchain/textsplitters");
const { GoogleGenerativeAIEmbeddings, ChatGoogleGenerativeAI } = require("@langchain/google-genai");
const { MemoryVectorStore } = require("@langchain/classic/vectorstores/memory");
const { Document } = require("@langchain/core/documents");
const { PromptTemplate } = require("@langchain/core/prompts");
const path = require("path");

const app = express();
const port = process.env.PORT || 3000;

const storage = multer.memoryStorage();
const upload = multer({ storage });

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// In-memory vector stores keyed by docId
const vectorStores = {};

app.post("/upload", upload.single("file"), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: "No file uploaded" });

        const fileBuffer = req.file.buffer;
        const mimeType = req.file.mimetype;
        let textContent = "";

        if (mimeType === "application/pdf") {
            const fs = require("fs");
            const { PDFLoader } = require("@langchain/community/document_loaders/fs/pdf");
            const tempFilePath = path.join(__dirname, `temp-${Date.now()}.pdf`);
            fs.writeFileSync(tempFilePath, fileBuffer);
            try {
                const loader = new PDFLoader(tempFilePath, { splitPages: false });
                const loadedDocs = await loader.load();
                textContent = loadedDocs.map(d => d.pageContent).join("\n");
            } finally {
                if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
            }
        } else if (mimeType === "text/plain") {
            textContent = fileBuffer.toString("utf8");
        } else {
            return res.status(400).json({ error: "Unsupported file type. Please upload a PDF or TXT file." });
        }

        // Chunking — 1000 chars with 200 overlap
        const splitter = new RecursiveCharacterTextSplitter({ chunkSize: 1000, chunkOverlap: 200 });
        const docs = await splitter.createDocuments([textContent]);

        // Embed and index
        const embeddings = new GoogleGenerativeAIEmbeddings({ model: "gemini-embedding-2" });
        const vectorStore = await MemoryVectorStore.fromDocuments(docs, embeddings);

        const docId = Date.now().toString();
        vectorStores[docId] = vectorStore;

        res.json({ message: "File successfully processed and indexed.", docId });
    } catch (error) {
        console.error("Upload error:", error);
        res.status(500).json({ error: "Failed to process the document: " + error.message });
    }
});

// gemini-flash-latest
const UTILITY_MODEL = "gemini-flash-latest";
const ANSWER_MODEL = "gemini-flash-latest";

function withTimeout(promise, ms, fallback) {
    return Promise.race([
        promise,
        new Promise(resolve => setTimeout(() => resolve(fallback), ms)),
    ]);
}

async function callLLM(prompt, temperature = 0.1, timeoutMs = 15000) {
    const llm = new ChatGoogleGenerativeAI({ model: UTILITY_MODEL, temperature, maxRetries: 0 });
    const result = await withTimeout(
        llm.invoke(prompt).then(r => String(r.content).trim()),
        timeoutMs,
        null  // null = timed out
    );
    return result;
}


// ────────────────────────────────────────────────────────────────────────────
// STAGE 1 — Query Rewriting (typo correction + intent clarification)
// ────────────────────────────────────────────────────────────────────────────
async function rewriteQuery(originalQuery) {
    const prompt = `You are a search query optimization assistant. Your job is to:
1. Fix any spelling mistakes or typos
2. Correct grammatical errors
3. Rephrase the query for optimal semantic search retrieval

Return ONLY the corrected, rewritten query as plain text. No explanation, no quotes, nothing else.

Original query: ${originalQuery}

Rewritten query:`;
    try {
        const result = await callLLM(prompt, 0.05, 10000);
        return (result && result.length > 0) ? result : originalQuery;
    } catch {
        return originalQuery;
    }
}

// ────────────────────────────────────────────────────────────────────────────
// ASK ROUTE — Streamlined Fast Pipeline
// ────────────────────────────────────────────────────────────────────────────
app.post("/ask", async (req, res) => {
    try {
        const { question, docId, mode = "thorough" } = req.body;

        if (!question || !docId) {
            return res.status(400).json({ error: "Missing question or document ID." });
        }

        const vectorStore = vectorStores[docId];
        if (!vectorStore) {
            return res.status(404).json({ error: "Document not found or session expired." });
        }

        const isThorough = mode === "thorough";

        const pipeline = {
            mode: "fast",
            originalQuery: question,
            rewrittenQuery: question,
            chunksRetrieved: 0,
            chunksInContext: 0,
        };

        // ── Stage 1: Query Rewriting ─────────────────────────────
        console.log(`[RAG] Stage 1: Rewriting query...`);
        pipeline.rewrittenQuery = await rewriteQuery(question);
        console.log(`[RAG]   Original: "${question}" → Rewritten: "${pipeline.rewrittenQuery}"`);

        // ── Stage 2: Fast Vector Retrieval ─────────────────────────────────────
        console.log(`[RAG] Stage 2: Vector retrieval using rewritten query...`);
        const retriever = vectorStore.asRetriever({ k: 6 });
        const rawChunks = await retriever.invoke(pipeline.rewrittenQuery);
        pipeline.chunksRetrieved = rawChunks.length;
        console.log(`[RAG]   Retrieved ${rawChunks.length} chunks`);

        // Token Trimming to avoid limits
        let total = 0;
        const finalChunks = [];
        for (const chunk of rawChunks) {
            if (total + chunk.pageContent.length > 6000) break;
            finalChunks.push(chunk);
            total += chunk.pageContent.length;
        }
        pipeline.chunksInContext = finalChunks.length;

        const context = finalChunks.map(c => c.pageContent).join("\n\n---\n\n");

        // ── Stage 3: Final Generation ─────────────────────────────────────────
        console.log(`[RAG] Stage 3: Generating answer with ${finalChunks.length} context chunks...`);
        const llm = new ChatGoogleGenerativeAI({ model: ANSWER_MODEL, temperature: 0.2, maxRetries: 0 });


        const didRewrite = pipeline.rewrittenQuery.toLowerCase() !== question.toLowerCase();
        const rewriteNote = didRewrite
            ? `Note: The original query had typos/ambiguity. I interpreted it as: "${pipeline.rewrittenQuery}"`
            : "";

        const systemPrompt = `You are a precise document intelligence assistant. Answer the question using ONLY the provided context passages.

Context passages (ranked by relevance):
{context}

Original question: {originalQuestion}
${didRewrite ? `Interpreted question: {rewrittenQuestion}` : ""}

Instructions:
1. Answer based ONLY on the provided context passages.
2. If the answer is not found in the context, say exactly: "I cannot find this information in the provided document."
3. Structure your answer clearly. Use bullet points or numbered lists where appropriate.
4. Be specific and cite concrete details from the context.
${didRewrite ? "5. Briefly mention at the start that you corrected the query interpretation." : ""}`;

        const prompt = PromptTemplate.fromTemplate(systemPrompt);
        const formattedPrompt = await prompt.format({
            context,
            originalQuestion: question,
            rewrittenQuestion: pipeline.rewrittenQuery,
        });

        const response = await llm.invoke(formattedPrompt);
        console.log(`[RAG] ✅ Answer generated successfully`);

        res.json({
            answer: response.content,
            pipeline,
            contextChunks: finalChunks.map(c => ({
                pageContent: c.pageContent,
                score: c.score,
            })),
        });

    } catch (error) {
        console.error("Ask error:", error);
        res.status(500).json({ error: "Failed to answer the question: " + error.message });
    }
});

app.listen(port, () => {
    console.log(`\n✅ Advanced RAG Server running!`);
    console.log(`🚀 Open: http://localhost:${port}\n`);
});