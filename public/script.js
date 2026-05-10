document.addEventListener('DOMContentLoaded', () => {
    // Modal Elements
    const uploadModal = document.getElementById('upload-modal');
    const openUploadBtn = document.getElementById('open-upload-modal-btn');
    const welcomeUploadBtn = document.getElementById('welcome-upload-btn');
    const closeModalBtn = document.getElementById('close-modal-btn');
    const modalBackdrop = document.getElementById('modal-backdrop');
    
    // Upload Elements
    const uploadArea = document.getElementById('upload-area');
    const fileUpload = document.getElementById('file-upload');
    const uploadStatus = document.getElementById('upload-status');
    const uploadStatusText = document.getElementById('upload-status-text');
    
    // Sidebar Elements
    const activeDocInfo = document.getElementById('active-doc-info');
    const noDocInfo = document.getElementById('no-doc-info');
    const docName = document.getElementById('doc-name');
    const docStatusText = document.getElementById('doc-status-text');
    const docStatusIndicator = document.getElementById('doc-status-indicator');
    const newChatBtn = document.getElementById('new-chat-btn');
    
    // Chat Elements
    const chatForm = document.getElementById('chat-form');
    const chatInput = document.getElementById('chat-input');
    const sendBtn = document.getElementById('send-btn');
    const messagesContainer = document.getElementById('messages-container');
    const welcomeScreen = document.getElementById('welcome-screen');

    let currentDocId = null;
    let currentDocFileName = null;

    // --- Modal Handling ---
    const openModal = () => uploadModal.classList.remove('hidden');
    const closeModal = () => {
        uploadModal.classList.add('hidden');
        resetUploadUI();
    };

    openUploadBtn.addEventListener('click', openModal);
    welcomeUploadBtn.addEventListener('click', openModal);
    closeModalBtn.addEventListener('click', closeModal);
    modalBackdrop.addEventListener('click', closeModal);

    // --- Upload Handling ---
    uploadArea.addEventListener('click', () => fileUpload.click());

    uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadArea.classList.add('dragover');
    });

    uploadArea.addEventListener('dragleave', () => {
        uploadArea.classList.remove('dragover');
    });

    uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadArea.classList.remove('dragover');
        if (e.dataTransfer.files.length > 0) {
            handleFileUpload(e.dataTransfer.files[0]);
        }
    });

    fileUpload.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            handleFileUpload(e.target.files[0]);
        }
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

        // Show uploading state
        uploadArea.classList.add('hidden');
        uploadStatus.classList.remove('hidden');
        uploadStatusText.textContent = `Uploading and indexing ${file.name}...`;

        try {
            const response = await fetch('/upload', {
                method: 'POST',
                body: formData
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Upload failed');
            }

            // Success
            currentDocId = data.docId;
            currentDocFileName = file.name;
            
            // Update Sidebar UI
            docName.textContent = file.name;
            docName.title = file.name;
            docStatusText.textContent = 'Ready to analyze';
            docStatusIndicator.classList.add('active');
            noDocInfo.classList.add('hidden');
            activeDocInfo.classList.remove('hidden');
            
            // Update Chat UI
            welcomeScreen.classList.add('hidden');
            chatInput.disabled = false;
            sendBtn.disabled = false;
            chatInput.placeholder = `Ask a question about ${file.name}...`;
            chatInput.focus();

            addSystemMessage(`Document **${file.name}** has been successfully processed and indexed. You can now ask me questions about it.`);
            
            // Close modal
            setTimeout(() => {
                closeModal();
            }, 500);

        } catch (error) {
            alert(error.message);
            resetUploadUI();
        }
    }

    // --- New Chat ---
    newChatBtn.addEventListener('click', () => {
        if (!currentDocId) return;
        
        // Keep document, clear chat
        const messages = messagesContainer.querySelectorAll('.message');
        messages.forEach(msg => msg.remove());
        
        welcomeScreen.classList.add('hidden');
        addSystemMessage(`Started a new session for **${currentDocFileName}**. What would you like to know?`);
        chatInput.focus();
    });

    // --- Chat Handling ---
    chatForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const question = chatInput.value.trim();
        if (!question || !currentDocId) return;

        // Add User Message
        addUserMessage(question);
        chatInput.value = '';
        
        // Disable input while generating
        chatInput.disabled = true;
        sendBtn.disabled = true;

        // Show typing indicator
        const typingId = addTypingIndicator();

        try {
            const response = await fetch('/ask', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ question, docId: currentDocId })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to get answer');
            }

            // Remove typing indicator
            document.getElementById(typingId).remove();

            // Add AI response
            addSystemMessage(data.answer, data.contextChunks);

        } catch (error) {
            document.getElementById(typingId).remove();
            addSystemMessage(`**Error:** ${error.message}`);
        } finally {
            chatInput.disabled = false;
            sendBtn.disabled = false;
            chatInput.focus();
        }
    });

    function addUserMessage(text) {
        const id = 'msg-' + Date.now();
        const msgHTML = `
            <div class="message user-message" id="${id}">
                <div class="message-avatar">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                </div>
                <div class="message-content">
                    <p>${escapeHTML(text)}</p>
                </div>
            </div>
        `;
        messagesContainer.insertAdjacentHTML('beforeend', msgHTML);
        scrollToBottom();
        return id;
    }

    function addSystemMessage(markdownText, chunks = null) {
        const id = 'msg-' + Date.now();
        
        let htmlContent = marked.parse(markdownText);

        let citationsHTML = '';
        if (chunks && chunks.length > 0) {
            const chunksList = chunks.map((c, i) => `
                <div class="citation-chunk">
                    <strong>MEM-NODE ${i + 1}</strong>
                    <p style="margin: 4px 0 0 0; font-size: 11px; opacity: 0.7;">${escapeHTML(c.pageContent.substring(0, 180))}...</p>
                </div>
            `).join('');

            citationsHTML = `
                <details class="citations">
                    <summary>Retrieved Synthesis Context</summary>
                    <div class="citations-list">
                        ${chunksList}
                    </div>
                </details>
            `;
        }

        const msgHTML = `
            <div class="message system-message" id="${id}">
                <div class="message-avatar">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 2a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2h-1v4h1a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2v2a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2v-2a2 2 0 0 1-2-2v-2a2 2 0 0 1 2-2h1V8H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h6z"></path></svg>
                </div>
                <div class="message-content">
                    ${htmlContent}
                    ${citationsHTML}
                </div>
            </div>
        `;
        
        messagesContainer.insertAdjacentHTML('beforeend', msgHTML);
        scrollToBottom();
        return id;
    }

    function addTypingIndicator() {
        const id = 'msg-' + Date.now();
        const msgHTML = `
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
            </div>
        `;
        messagesContainer.insertAdjacentHTML('beforeend', msgHTML);
        scrollToBottom();
        return id;
    }

    function scrollToBottom() {
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    function escapeHTML(str) {
        return str.replace(/[&<>'"]/g, 
            tag => ({
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                "'": '&#39;',
                '"': '&quot;'
            }[tag] || tag)
        );
    }
});
