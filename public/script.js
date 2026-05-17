document.addEventListener('DOMContentLoaded', () => {
    // ── Element refs ────────────────────────────────────────────────────────
    const uploadModal       = document.getElementById('upload-modal');
    const openUploadBtn     = document.getElementById('open-upload-modal-btn');
    const welcomeUploadBtn  = document.getElementById('welcome-upload-btn');
    const closeModalBtn     = document.getElementById('close-modal-btn');
    const modalBackdrop     = document.getElementById('modal-backdrop');

    const uploadArea        = document.getElementById('upload-area');
    const fileUpload        = document.getElementById('file-upload');
    const uploadStatus      = document.getElementById('upload-status');
    const uploadStatusText  = document.getElementById('upload-status-text');

    const activeDocInfo     = document.getElementById('active-doc-info');
    const noDocInfo         = document.getElementById('no-doc-info');
    const docName           = document.getElementById('doc-name');
    const docStatusText     = document.getElementById('doc-status-text');
    const docStatusIndicator= document.getElementById('doc-status-indicator');
    const chatForm          = document.getElementById('chat-form');
    const chatInput         = document.getElementById('chat-input');
    const sendBtn           = document.getElementById('send-btn');
    const messagesContainer = document.getElementById('messages-container');
    const welcomeScreen     = document.getElementById('welcome-screen');

    const stageList         = document.getElementById('stage-list');

    let currentDocId       = null;
    let currentDocFileName = null;
    let currentMode        = 'fast'; // 'fast' | 'thorough'

    // ── Modal ────────────────────────────────────────────────────────────────
    const openModal  = () => uploadModal.classList.remove('hidden');
    const closeModal = () => { uploadModal.classList.add('hidden'); resetUploadUI(); };

    openUploadBtn.addEventListener('click', openModal);
    welcomeUploadBtn.addEventListener('click', openModal);
    closeModalBtn.addEventListener('click', closeModal);
    modalBackdrop.addEventListener('click', closeModal);

    // ── Upload ───────────────────────────────────────────────────────────────
    uploadArea.addEventListener('click', () => fileUpload.click());
    uploadArea.addEventListener('dragover', e => { e.preventDefault(); uploadArea.classList.add('dragover'); });
    uploadArea.addEventListener('dragleave', () => uploadArea.classList.remove('dragover'));
    uploadArea.addEventListener('drop', e => {
        e.preventDefault();
        uploadArea.classList.remove('dragover');
        if (e.dataTransfer.files.length > 0) handleFileUpload(e.dataTransfer.files[0]);
    });
    fileUpload.addEventListener('change', e => {
        if (e.target.files.length > 0) handleFileUpload(e.target.files[0]);
    });

    function resetUploadUI() {
        uploadArea.classList.remove('hidden');
        uploadStatus.classList.add('hidden');
        fileUpload.value = '';
    }

    async function handleFileUpload(file) {
        if (!file.name.endsWith('.pdf') && !file.name.endsWith('.txt')) {
            alert('Please upload a PDF or TXT file.');
            return;
        }
        const formData = new FormData();
        formData.append('file', file);

        uploadArea.classList.add('hidden');
        uploadStatus.classList.remove('hidden');
        uploadStatusText.textContent = `Indexing ${file.name}…`;

        try {
            const response = await fetch('/upload', { method: 'POST', body: formData });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Upload failed');

            currentDocId       = data.docId;
            currentDocFileName = file.name;

            docName.textContent = file.name;
            docName.title       = file.name;
            docStatusText.textContent = 'Indexed & Ready';
            docStatusIndicator.classList.add('active');
            noDocInfo.classList.add('hidden');
            activeDocInfo.classList.remove('hidden');

            welcomeScreen.classList.add('hidden');
            chatInput.disabled       = false;
            sendBtn.disabled         = false;
            chatInput.placeholder    = `Ask anything about ${file.name}…`;
            chatInput.focus();

            addSystemMessage(`Document **${file.name}** indexed! The Lightning Fast RAG pipeline is ready. Try asking a question — even with typos!`, null, null);

            setTimeout(closeModal, 500);
        } catch (error) {
            alert(error.message);
            resetUploadUI();
        }
    }


    // ── Chat Submit ──────────────────────────────────────────────────────────
    chatForm.addEventListener('submit', async e => {
        e.preventDefault();
        const question = chatInput.value.trim();
        if (!question || !currentDocId) return;

        addUserMessage(question);
        chatInput.value  = '';
        chatInput.disabled = true;
        sendBtn.disabled   = true;

        const typingId = addTypingIndicator();

        try {
            const response = await fetch('/ask', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ question, docId: currentDocId, mode: currentMode }),
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Failed to get answer');

            document.getElementById(typingId).remove();
            addSystemMessage(data.answer, data.contextChunks, data.pipeline);
        } catch (error) {
            document.getElementById(typingId).remove();
            addSystemMessage(`**Error:** ${error.message}`, null, null);
        } finally {
            chatInput.disabled = false;
            sendBtn.disabled   = false;
            chatInput.focus();
        }
    });

    // ── Message Renderers ────────────────────────────────────────────────────
    function addUserMessage(text) {
        const id = 'msg-' + Date.now();
        messagesContainer.insertAdjacentHTML('beforeend', `
            <div class="message user-message" id="${id}">
                <div class="message-avatar">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                </div>
                <div class="message-content"><p>${escapeHTML(text)}</p></div>
            </div>`);
        scrollToBottom();
        return id;
    }

    function addSystemMessage(markdownText, chunks, pipeline) {
        const id = 'msg-' + Date.now();
        const htmlContent = marked.parse(markdownText);

        // ── Pipeline Trace ──────────────────────────────────────────────
        let pipelineHTML = '';
        if (pipeline) {
            const didRewrite = pipeline.rewrittenQuery &&
                pipeline.rewrittenQuery.toLowerCase() !== pipeline.originalQuery.toLowerCase();

            const subQList = pipeline.subQueries && pipeline.subQueries.length > 1
                ? pipeline.subQueries.map(q => `<li>${escapeHTML(q)}</li>`).join('')
                : '';

            pipelineHTML = `
            <details class="pipeline-trace">
                <summary>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
                    Pipeline Trace · ⚡ Fast RAG
                </summary>
                <div class="trace-grid">
                    <div class="trace-row">
                        <span class="trace-label">① Query Rewrite</span>
                        <span class="trace-value ${didRewrite ? 'highlight' : ''}">
                            ${didRewrite
                                ? `<s class="trace-original">${escapeHTML(pipeline.originalQuery)}</s> → <strong>${escapeHTML(pipeline.rewrittenQuery)}</strong>`
                                : escapeHTML(pipeline.rewrittenQuery) + ' <span class="trace-tag ok">no change</span>'}
                        </span>
                    </div>
                    <div class="trace-row">
                        <span class="trace-label">② Retrieval</span>
                        <span class="trace-value"><span class="trace-count">${pipeline.chunksRetrieved}</span> chunks</span>
                    </div>
                    <div class="trace-row">
                        <span class="trace-label">③ In Context</span>
                        <span class="trace-value"><span class="trace-count">${pipeline.chunksInContext}</span> chunks</span>
                    </div>
                </div>
            </details>`;
        }

        // ── Citations ────────────────────────────────────────────────────
        let citationsHTML = '';
        if (chunks && chunks.length > 0) {
            const chunkItems = chunks.map((c, i) => {
                const score = c.score != null ? c.score : null;
                const scoreClass = score >= 7 ? 'score-high' : score >= 4 ? 'score-mid' : 'score-low';
                return `
                <div class="citation-chunk">
                    <div class="citation-header">
                        <strong>MEM-NODE ${i + 1}</strong>
                        ${score != null ? `<span class="score-badge ${scoreClass}">${score.toFixed(1)}/10</span>` : ''}
                    </div>
                    <p class="citation-text">${escapeHTML(c.pageContent.substring(0, 200))}…</p>
                </div>`;
            }).join('');
            citationsHTML = `
            <details class="citations">
                <summary>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
                    Source Chunks · ${chunks.length} used
                </summary>
                <div class="citations-list">${chunkItems}</div>
            </details>`;
        }

        messagesContainer.insertAdjacentHTML('beforeend', `
            <div class="message system-message" id="${id}">
                <div class="message-avatar">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 2a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2h-1v4h1a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2v2a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2v-2a2 2 0 0 1-2-2v-2a2 2 0 0 1 2-2h1V8H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h6z"></path></svg>
                </div>
                <div class="message-content">
                    ${htmlContent}
                    ${pipelineHTML}
                    ${citationsHTML}
                </div>
            </div>`);
        scrollToBottom();
        return id;
    }

    function addTypingIndicator() {
        const id = 'msg-' + Date.now();
        messagesContainer.insertAdjacentHTML('beforeend', `
            <div class="message system-message" id="${id}">
                <div class="message-avatar">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2h-1v4h1a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2v2a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2v-2a2 2 0 0 1-2-2v-2a2 2 0 0 1 2-2h1V8H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h6z"></path></svg>
                </div>
                <div class="message-content">
                    <div class="typing-indicator">
                        <div class="typing-dot"></div>
                        <div class="typing-dot"></div>
                        <div class="typing-dot"></div>
                    </div>
                </div>
            </div>`);
        scrollToBottom();
        return id;
    }

    function scrollToBottom() {
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    function escapeHTML(str) {
        return String(str).replace(/[&<>'"`]/g,
            t => ({ '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;','`':'&#96;' }[t] || t));
    }
});
