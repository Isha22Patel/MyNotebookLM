document.addEventListener('DOMContentLoaded', () => {
    const uploadArea = document.getElementById('upload-area');
    const fileUpload = document.getElementById('file-upload');
    const uploadStatus = document.getElementById('upload-status');
    const activeDoc = document.getElementById('active-doc');
    const docName = document.getElementById('doc-name');
    const noDocsMsg = document.getElementById('no-docs');
    
    const chatForm = document.getElementById('chat-form');
    const chatInput = document.getElementById('chat-input');
    const sendBtn = document.getElementById('send-btn');
    const messagesContainer = document.getElementById('messages-container');

    let currentDocId = null;

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

    async function handleFileUpload(file) {
        if (!file.name.endsWith('.pdf') && !file.name.endsWith('.txt')) {
            alert('Please upload a PDF or TXT file.');
            return;
        }

        const formData = new FormData();
        formData.append('file', file);

        // Show uploading state
        uploadStatus.classList.remove('hidden');
        uploadArea.style.opacity = '0.5';
        uploadArea.style.pointerEvents = 'none';

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
            docName.textContent = file.name;
            
            // Update UI
            noDocsMsg.classList.add('hidden');
            activeDoc.classList.remove('hidden');
            chatInput.disabled = false;
            sendBtn.disabled = false;
            chatInput.placeholder = `Ask a question about ${file.name}...`;
            chatInput.focus();

            addSystemMessage(`Successfully indexed **${file.name}**! You can now ask me questions about it.`);

        } catch (error) {
            alert(error.message);
        } finally {
            // Restore upload state
            uploadStatus.classList.add('hidden');
            uploadArea.style.opacity = '1';
            uploadArea.style.pointerEvents = 'auto';
            fileUpload.value = ''; // reset
        }
    }

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
        const typingId = addSystemMessage('<div class="spinner"></div><span style="margin-left: 10px;">Analyzing document...</span>');

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
                <div class="message-content">
                    <p>${escapeHTML(text)}</p>
                </div>
                <div class="message-avatar">
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>
                </div>
            </div>
        `;
        messagesContainer.insertAdjacentHTML('beforeend', msgHTML);
        scrollToBottom();
        return id;
    }

    function addSystemMessage(markdownText, chunks = null) {
        const id = 'msg-' + Date.now();
        
        let htmlContent = '';
        if (markdownText.includes('<div class="spinner">')) {
            htmlContent = markdownText; // Allow raw HTML for spinner
        } else {
            htmlContent = marked.parse(markdownText);
        }

        let citationsHTML = '';
        if (chunks && chunks.length > 0) {
            const chunksList = chunks.map((c, i) => `
                <div class="citation-chunk">
                    <strong>Source ${i + 1}</strong>
                    <p style="margin: 4px 0 0 0; font-size: 12px; opacity: 0.8;">${escapeHTML(c.pageContent.substring(0, 150))}...</p>
                </div>
            `).join('');

            citationsHTML = `
                <details class="citations">
                    <summary>View Retrieved Sources</summary>
                    <div class="citations-list">
                        ${chunksList}
                    </div>
                </details>
            `;
        }

        const msgHTML = `
            <div class="message system-message" id="${id}">
                <div class="message-avatar">
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
                </div>
                <div class="message-content" style="width: 100%;">
                    ${htmlContent}
                    ${citationsHTML}
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
