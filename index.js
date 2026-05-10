require("dotenv").config();
const express = require("express");
const multer = require("multer");
const pdfParse = require("pdf-parse");
const { RecursiveCharacterTextSplitter } = require("@langchain/textsplitters");
const { GoogleGenerativeAIEmbeddings, ChatGoogleGenerativeAI } = require("@langchain/google-genai");
const { MemoryVectorStore } = require("@langchain/classic/vectorstores/memory");
const { Document } = require("@langchain/core/documents");
const { PromptTemplate } = require("@langchain/core/prompts");
const path = require("path");

const app = express();
const port = process.env.PORT || 3000;

// Setup Multer with memory storage
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// Global or simulated session-based vector stores
// For a production app, use Pinecone/Qdrant/etc. We use MemoryVectorStore for simplicity
const vectorStores = {}; 

app.post("/upload", upload.single("file"), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: "No file uploaded" });
        }

        const fileBuffer = req.file.buffer;
        const originalName = req.file.originalname;
        const mimeType = req.file.mimetype;
        
        let textContent = "";

        if (mimeType === "application/pdf") {
            // Write buffer to a temp file for robust parsing using Langchain's PDFLoader
            const fs = require('fs');
            const { PDFLoader } = require("@langchain/community/document_loaders/fs/pdf");
            
            const tempFilePath = path.join(__dirname, `temp-${Date.now()}.pdf`);
            fs.writeFileSync(tempFilePath, fileBuffer);
            
            try {
                const loader = new PDFLoader(tempFilePath, {
                    splitPages: false
                });
                const loadedDocs = await loader.load();
                textContent = loadedDocs.map(doc => doc.pageContent).join("\n");
            } finally {
                // Always clean up the temp file
                if (fs.existsSync(tempFilePath)) {
                    fs.unlinkSync(tempFilePath);
                }
            }
        } else if (mimeType === "text/plain") {
            textContent = fileBuffer.toString("utf8");
        } else {
            return res.status(400).json({ error: "Unsupported file type. Please upload a PDF or text file." });
        }

        // 1. Chunking
        // We use RecursiveCharacterTextSplitter, which tries to split on paragraphs, then sentences, then words.
        const textSplitter = new RecursiveCharacterTextSplitter({
            chunkSize: 1000,
            chunkOverlap: 200,
        });

        const docs = await textSplitter.createDocuments([textContent]);

        // 2. Embeddings
        const embeddings = new GoogleGenerativeAIEmbeddings({
            model: "gemini-embedding-2", // Used the correct parameter 'model' and valid model name
        });

        // 3. Vector Database Indexing
        // We initialize a MemoryVectorStore with our chunks and embeddings.
        const vectorStore = await MemoryVectorStore.fromDocuments(docs, embeddings);

        // Save it with a unique ID for this session/document
        const docId = Date.now().toString();
        vectorStores[docId] = vectorStore;

        res.json({ message: "File successfully processed and indexed.", docId: docId });

    } catch (error) {
        console.error("Upload error:", error);
        res.status(500).json({ error: "Failed to process the document: " + error.message });
    }
});

app.post("/ask", async (req, res) => {
    try {
        const { question, docId } = req.body;

        if (!question || !docId) {
            return res.status(400).json({ error: "Missing question or document ID." });
        }

        const vectorStore = vectorStores[docId];
        if (!vectorStore) {
            return res.status(404).json({ error: "Document not found or session expired." });
        }

        // 4. Retrieval
        const retriever = vectorStore.asRetriever({
            k: 4 // retrieve top 4 most relevant chunks
        });

        const relevantDocs = await retriever.invoke(question);
        
        const context = relevantDocs.map(doc => doc.pageContent).join("\n\n");

        // 5. Generation
        const llm = new ChatGoogleGenerativeAI({
            model: "gemini-2.5-flash", // Correct parameter 'model'
            temperature: 0.2, // low temperature for grounded answers
        });

        const systemPrompt = `You are a helpful AI assistant tasked with answering questions based ONLY on the provided document context.
        
Context:
{context}

Question:
{question}

Instructions:
1. Answer the question using ONLY the provided context.
2. If the answer is not contained in the context, say "I cannot answer this based on the provided document." DO NOT use external knowledge.
3. Keep the answer clear, concise, and well-structured.`;

        const prompt = PromptTemplate.fromTemplate(systemPrompt);
        
        const formattedPrompt = await prompt.format({
            context: context,
            question: question
        });

        const response = await llm.invoke(formattedPrompt);

        res.json({ answer: response.content, contextChunks: relevantDocs });

    } catch (error) {
        console.error("Ask error:", error);
        res.status(500).json({ error: "Failed to answer the question: " + error.message });
    }
});

app.listen(port, () => {
    console.log(`Server is successfully running!`);
    console.log(`🚀 Open this link in your browser: http://localhost:${port}`);
});