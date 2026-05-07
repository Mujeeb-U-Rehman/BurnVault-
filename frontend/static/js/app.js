/**
 * BurnVault Main Application
 * Orchestrates UI, encryption, and communication
 */

class BurnVaultApp {
    constructor() {
        this.currentUser = null;
        this.currentUserProfile = null;
        this.userKeys = null;
        this.contacts = new Map();
        this.selectedRecipient = null;
        this.conversations = new Map();
        this._onceWarnings = new Set();
        this.initializeEventListeners();
        this.checkBackendHealth();
        this.checkAuthStatus();
    }

    warnOnce(key, title, message, type = 'warning') {
        if (this._onceWarnings.has(key)) return;
        this._onceWarnings.add(key);
        this.showNotification(title, message, type);
    }

    /**
     * Check backend availability and show a clear error if the UI is opened on the wrong origin/port.
     */
    async checkBackendHealth() {
        try {
            const resp = await fetch('/api/health/');
            if (!resp.ok) {
                throw new Error(`Backend returned ${resp.status}`);
            }
        } catch (e) {
            this.showNotification(
                'Backend Error',
                'Backend API is not reachable from this page. Open the app at http://localhost:8000/ (not the static server on 8001).',
                'error'
            );
        }
    }

    /**
     * Initialize event listeners
     */
    initializeEventListeners() {
        // Prevent right-click and context menu
        document.addEventListener('contextmenu', (e) => e.preventDefault());

        // Prevent data caching
        window.addEventListener('beforeunload', () => {
            this.clearSensitiveData();
        });

        // Handle WebSocket events
        wsClient.on('message_received', (data) => this.handleMessageReceived(data));
        wsClient.on('file_received', (data) => this.handleFileReceived(data));
        wsClient.on('key_exchange_received', (data) => this.handleKeyExchange(data));

        // WebSocket transport errors can be noisy (especially during reconnect);
        // show a single warning and keep the app usable.
        wsClient.on('error', (error) => {
            const msg = (error && error.message) ? error.message : 'WebSocket connection error';
            this.warnOnce(
                'ws_transport_error',
                'Realtime Disabled',
                `${msg}. Realtime updates may not work, but you can still use the app.`,
                'warning'
            );
        });

        // Server-side WS errors come in as structured messages
        wsClient.on('ws_error', (data) => {
            const msg = data?.message || 'WebSocket error';
            this.warnOnce('ws_server_error', 'Realtime Error', msg, 'warning');
        });
    }

    /**
     * Check if user is authenticated
     */
    async checkAuthStatus() {
        const token = localStorage.getItem('access_token');
        if (token) {
            await this.loadCurrentUser();
        }
    }

    /**
     * Load current user profile
     */
    async loadCurrentUser() {
        try {
            const profile = await apiClient.getUserProfile();
            this.currentUser = profile.user;
            this.currentUserProfile = profile;

            // --- Auto-login private key restore ---
            // When the user has a stored token but no local keys yet,
            // try to restore private key from the server-side backup.
            // (The login path does this too, but only when the user just typed their password.)
            const username = profile.user?.username || null;
            const existingLocal = this.getStoredKeys(username);
            if (!existingLocal || !existingLocal.privateKeyJWK) {
                // We need the password to decrypt the backup — only available if
                // _lastLoginPassword was set by handleLogin() in this same call chain.
                const loginPassword = this._lastLoginPassword || null;
                if (loginPassword) {
                    try {
                        const blob = profile.encrypted_private_key;
                        const publicKeyStr = profile.public_key;
                        if (blob && publicKeyStr) {
                            const privateKeyJWK = await cryptoLib.decryptJSONWithPassword(blob, loginPassword);
                            const publicKeyJWK = JSON.parse(publicKeyStr);
                            if (privateKeyJWK && publicKeyJWK) {
                                this.storeKeys({ publicKeyJWK, privateKeyJWK }, username);
                                console.log('Private key restored from profile backup.');
                            }
                        }
                    } catch (e) {
                        console.warn('Key restore from profile failed (continuing):', e);
                    }
                }
            }

            // Show app section as soon as auth is confirmed.
            // WebSocket is optional; a WS failure should not block login.
            this.showSection('app');
            document.getElementById('current-username').textContent = this.currentUser.username;

            // Connect WebSocket (best-effort)
            try {
                await wsClient.connect();
            } catch (wsError) {
                console.warn('WebSocket connect failed (continuing without realtime):', wsError);
                this.showNotification(
                    'Realtime Disabled',
                    'Logged in, but realtime updates are unavailable (WebSocket connection failed). You can still use the app normally.',
                    'warning'
                );
            }

            // Generate or load user's keys
            await this.initializeUserKeys();

            // Load initial data
            await this.loadMessages();
            await this.loadFiles();
            await this.loadContacts();
        } catch (error) {
            console.error('Failed to load user profile:', error);
            this.logout();
        }
    }

    /**
     * Initialize user cryptographic keys
     */
    async initializeUserKeys() {
        try {
            const username = this.currentUser?.username || null;
            const stored = this.getStoredKeys(username);

            // Prefer previously generated session keys (registration flow or restored from backup)
            if (stored && stored.publicKeyJWK && stored.privateKeyJWK) {
                const publicKey = await cryptoLib.importPublicKey(stored.publicKeyJWK);
                const privateKey = await cryptoLib.importPrivateKey(stored.privateKeyJWK);

                this.userKeys = {
                    publicKey,
                    publicKeyJWK: stored.publicKeyJWK,
                    privateKey,
                    privateKeyJWK: stored.privateKeyJWK
                };

                this.showNotification('Ready', 'Encryption initialized', 'success');
                return;
            }

            // If we don't have a private key locally, we MUST generate a new key pair.
            // (If the server had a backup, handleLogin or loadCurrentUser would have restored it by now).
            // A missing private key means old messages are unreadable, but we must issue new keys 
            // so the user can send/receive new messages.
            this.showNotification('Key Setup', 'Generating new encryption keys...', 'info');

            const keyPair = await cryptoLib.generateRSAKeyPair();
            const publicKeyJWK = await cryptoLib.exportPublicKey(keyPair.publicKey);
            const privateKeyJWK = await cryptoLib.exportPrivateKey(keyPair.privateKey);

            // Best-effort: back up private key encrypted with a password.
            // Only available if we are in the login/register flow.
            const loginPassword = this._lastLoginPassword || null;
            const encryptedPrivateKey = loginPassword
                ? await cryptoLib.encryptJSONWithPassword(privateKeyJWK, loginPassword)
                : '';

            this.storeKeys({ publicKeyJWK, privateKeyJWK }, username);
            
            try {
                // Publish new keys (public + encrypted private) to server
                const keysResp = await apiClient.updateMyKeys(
                    JSON.stringify(publicKeyJWK),
                    encryptedPrivateKey
                );
                // Keep profile in sync if response matches profile format
                if (keysResp && typeof keysResp.public_key === 'string') {
                    this.currentUserProfile = { ...this.currentUserProfile, public_key: keysResp.public_key };
                }
            } catch (e) {
                console.warn('Failed to publish new public key to server:', e);
            }

            this.userKeys = {
                publicKey: keyPair.publicKey,
                publicKeyJWK,
                privateKey: keyPair.privateKey,
                privateKeyJWK
            };

            this.showNotification('Ready', 'New encryption keys initialized', 'success');
        } catch (error) {
            console.error('Key initialization error:', error);
            this.showNotification('Error', 'Failed to initialize encryption', 'error');
        }
    }

    /**
     * Get stored keys
     */
    getStoredKeys(username = null) {
        try {
            const candidates = [];
            if (username) candidates.push(`user_keys:${username}`);
            candidates.push('user_keys');

            for (const key of candidates) {
                const stored = localStorage.getItem(key);
                if (!stored) continue;
                return JSON.parse(stored);
            }

            // Backward-compatible fallback from older builds
            const legacy = sessionStorage.getItem('user_keys');
            if (legacy) return JSON.parse(legacy);

            return null;
        } catch (error) {
            return null;
        }
    }

    /**
     * Store keys
     */
    storeKeys(keys, username = null) {
        try {
            const toStore = {
                publicKeyJWK: keys.publicKeyJWK || null,
                privateKeyJWK: keys.privateKeyJWK || null
            };

            const storageKey = username ? `user_keys:${username}` : 'user_keys';
            localStorage.setItem(storageKey, JSON.stringify(toStore));

            // Best-effort cleanup of legacy location
            try {
                sessionStorage.removeItem('user_keys');
            } catch (e) {}
        } catch (error) {
            console.error('Failed to store keys:', error);
        }
    }

    /**
     * Handle login
     */
    async handleLogin() {
        const username = document.getElementById('login-username').value.trim();
        const password = document.getElementById('login-password').value;
        const totpCode = document.getElementById('login-2fa').value.trim();

        if (!username || !password) {
            this.showNotification('Validation', 'Please enter username and password', 'warning');
            return;
        }

        this.setLoadingState(true);
        try {
            // Keep password in memory briefly for key backup provisioning.
            // NOTE: must be set BEFORE loadCurrentUser() is called so the
            // restore path in loadCurrentUser() can use it.
            this._lastLoginPassword = password;

            const response = await apiClient.login(username, password, totpCode);
            apiClient.setTokens(response.access, response.refresh);

            // Primary key-restore path: use /api/profile/me/keys/ which also
            // returns the encrypted_private_key blob.
            try {
                const keys = await apiClient.getMyKeys();
                const blob = keys?.encrypted_private_key;
                if (blob) {
                    const privateKeyJWK = await cryptoLib.decryptJSONWithPassword(blob, password);
                    const publicKeyJWK = keys?.public_key ? JSON.parse(keys.public_key) : null;
                    if (privateKeyJWK && publicKeyJWK) {
                        this.storeKeys({ publicKeyJWK, privateKeyJWK }, username);
                        console.log('Private key successfully restored from server backup.');
                    } else if (privateKeyJWK) {
                        this.storeKeys({ publicKeyJWK: null, privateKeyJWK }, username);
                    }
                }
            } catch (e) {
                console.warn('Key restore from /me/keys/ failed (continuing):', e);
            }

            // Clear form
            document.getElementById('login-username').value = '';
            document.getElementById('login-password').value = '';
            document.getElementById('login-2fa').value = '';

            // Load user (also attempts secondary key restore using _lastLoginPassword)
            await this.loadCurrentUser();
        } catch (error) {
            this.showNotification('Login Failed', error.message, 'error');
        } finally {
            // Clear in-memory password reference after loadCurrentUser completes
            this._lastLoginPassword = null;
            this.setLoadingState(false);
        }
    }

    /**
     * Handle registration
     */
    async handleRegister() {
        const username = document.getElementById('register-username').value.trim();
        const email = document.getElementById('register-email').value.trim();
        const password = document.getElementById('register-password').value;
        const confirm = document.getElementById('register-confirm').value;

        if (!username || !email || !password || !confirm) {
            this.showNotification('Validation', 'Please fill all fields', 'warning');
            return;
        }

        if (password !== confirm) {
            this.showNotification('Validation', 'Passwords do not match', 'warning');
            return;
        }

        if (password.length < 8) {
            this.showNotification('Validation', 'Password must be at least 8 characters', 'warning');
            return;
        }

        try {
            this.setLoadingState(true);

            // Generate temporary keys for registration
            const keyPair = await cryptoLib.generateRSAKeyPair();
            const publicKeyJWK = await cryptoLib.exportPublicKey(keyPair.publicKey);
            const privateKeyJWK = await cryptoLib.exportPrivateKey(keyPair.privateKey);

            // Encrypt private key with password for server-side backup/recovery
            const encryptedPrivateKey = await cryptoLib.encryptJSONWithPassword(privateKeyJWK, password);

            // Persist keys for this browser so the user can decrypt after login/reload
            this.storeKeys({ publicKeyJWK, privateKeyJWK }, username);

            const response = await apiClient.registerWithKeyBackup(
                username,
                email,
                password,
                JSON.stringify(publicKeyJWK),
                encryptedPrivateKey
            );

            this.showNotification('Success', 'Account created! Please log in.', 'success');

            // Clear forms
            document.getElementById('register-username').value = '';
            document.getElementById('register-email').value = '';
            document.getElementById('register-password').value = '';
            document.getElementById('register-confirm').value = '';

            // Switch to login form
            this.toggleAuthForms();
            this.setLoadingState(false);
        } catch (error) {
            this.showNotification('Registration Failed', error.message, 'error');
            this.setLoadingState(false);
        }
    }

    /**
     * Handle logout
     */
    logout() {
        apiClient.clearTokens();
        wsClient.disconnect();
        this.clearSensitiveData();
        this.showSection('auth');
        this.currentUser = null;
        this.userKeys = null;
    }

    /**
     * Search for users
     */
    async searchUsers() {
        const query = document.getElementById('recipient-search').value.trim();

        if (!query || query.length < 3) {
            document.getElementById('search-results').innerHTML = '';
            return;
        }

        try {
            const users = await apiClient.searchUsers(query);
            this.displaySearchResults(users);
        } catch (error) {
            console.error('User search error:', error);
        }
    }

    /**
     * Display search results
     */
    displaySearchResults(users) {
        const container = document.getElementById('search-results');
        container.innerHTML = '';

        users.forEach(user => {
            const item = document.createElement('div');
            item.className = 'search-result-item';
            item.innerHTML = `
                <div>${user.username}</div>
                <small>${user.email}</small>
            `;
            item.onclick = () => this.selectRecipient(user);
            container.appendChild(item);
        });
    }

    /**
     * Select recipient for message
     */
    selectRecipient(user) {
        this.selectedRecipient = user;
        document.getElementById('recipient-info').classList.remove('hidden');
        document.getElementById('recipient-name').textContent = user.username;
        document.getElementById('recipient-search').value = '';
        document.getElementById('search-results').innerHTML = '';
    }

    /**
     * Clear selected recipient
     */
    clearRecipient() {
        this.selectedRecipient = null;
        document.getElementById('recipient-info').classList.add('hidden');
        document.getElementById('recipient-name').textContent = '';
        document.getElementById('message-content').value = '';
        document.getElementById('message-file').value = '';
        document.getElementById('file-name-display').innerHTML = '';
    }

    /**
     * Send encrypted message and/or file
     */
    async sendMessage() {
        if (!this.selectedRecipient) {
            this.showNotification('Error', 'Please select a recipient', 'error');
            return;
        }

        const content = document.getElementById('message-content').value.trim();
        const fileInput = document.getElementById('message-file');
        const file = fileInput.files[0];

        if (!content && !file) {
            this.showNotification('Error', 'Please enter a message or attach a file', 'error');
            return;
        }

        try {
            this.setLoadingState(true);

            // Get recipient's public key
            const recipientProfile = await this.getRecipientProfile(this.selectedRecipient.id);
            const recipientPublicKey = await cryptoLib.importPublicKey(
                JSON.parse(recipientProfile.public_key)
            );

            let successMessage = 'Message sent securely';

            // Send text message if content exists
            if (content) {
                // Generate unique AES key for this message
                const messageKey = await cryptoLib.generateAESKey();

                // Encrypt message content
                const encrypted = await cryptoLib.encryptMessage(content, messageKey);

                // Encrypt the AES key
                const encryptedKey = await cryptoLib.encryptKeyWithPublicKey(
                    messageKey,
                    recipientPublicKey
                );

                // Send via API
                await apiClient.sendMessage(
                    this.selectedRecipient.id,
                    encrypted.encrypted,
                    encryptedKey,
                    encrypted.iv
                );

                // Also notify via WebSocket if connected
                if (wsClient.isConnected()) {
                    wsClient.sendMessage(
                        this.selectedRecipient.id,
                        encrypted.encrypted,
                        encryptedKey,
                        encrypted.iv
                    );
                }

                cryptoLib.clearSensitiveData(encrypted);
            }

            // Send file if file exists
            if (file) {
                // Generate unique AES key for this file
                const fileKey = await cryptoLib.generateAESKey();

                // Encrypt file
                const encryptedFileResult = await cryptoLib.encryptFile(file, fileKey);

                // Encrypt the AES key
                const encryptedFileKey = await cryptoLib.encryptKeyWithPublicKey(
                    fileKey,
                    recipientPublicKey
                );

                // Send via API
                await apiClient.sendFile(
                    this.selectedRecipient.id,
                    encryptedFileResult.encryptedBlob,
                    encryptedFileKey,
                    encryptedFileResult.iv,
                    file.name
                );

                successMessage = content ? 'Message and file sent securely' : 'File sent securely';
            }

            this.showNotification('Success', successMessage, 'success');
            this.clearRecipient();
            this.setLoadingState(false);
        } catch (error) {
            console.error('Send error:', error);
            this.showNotification('Error', `Failed to send: ${error.message}`, 'error');
            this.setLoadingState(false);
        }
    }

    /**
     * Get recipient profile
     */
    async getRecipientProfile(userId) {
        try {
            return await apiClient.request(`/api/profile/${userId}/`);
        } catch (error) {
            throw new Error('Failed to get recipient public key');
        }
    }

    /**
     * Handle received message
     */
    async handleMessageReceived(data) {
        try {
            if (!this.userKeys || !this.userKeys.privateKey) {
                this.warnOnce(
                    'missing_private_key_receive',
                    'Cannot Decrypt',
                    'A message arrived but this session has no private key, so it cannot be decrypted here. Log in again in the same browser session you registered from.',
                    'warning'
                );
                return;
            }

            const senderId = data.sender_id;
            const senderUsername = data.sender_username;
            const encryptedContent = data.encrypted_content;
            const encryptedKey = data.encrypted_key;
            const iv = data.iv;

            // Decrypt the AES key using private key
            const messageKey = await cryptoLib.decryptKeyWithPrivateKey(
                encryptedKey,
                this.userKeys.privateKey
            );

            // Decrypt message
            const content = await cryptoLib.decryptMessage(encryptedContent, iv, messageKey);

            // Display notification
            this.showNotification(
                `Message from ${senderUsername}`,
                content.substring(0, 50) + (content.length > 50 ? '...' : ''),
                'success'
            );

            // Add to conversation
            this.addMessageToConversation(senderId, senderUsername, content, true);

            // Auto-delete after reading (in real implementation)
            cryptoLib.clearSensitiveData(messageKey);
        } catch (error) {
            console.error('Error handling received message:', error);
            this.warnOnce('decrypt_failed_receive', 'Decrypt Failed', 'Failed to decrypt an incoming message.', 'error');
        }
    }

    /**
     * Handle received file
     */
    async handleFileReceived(data) {
        this.showNotification(
            `File from ${data.sender_username}`,
            `${data.file_name} (${this.formatFileSize(data.file_size)})`,
            'success'
        );
    }

    /**
     * Handle key exchange
     */
    async handleKeyExchange(data) {
        const senderId = data.sender_id;
        const senderUsername = data.sender_username;

        try {
            // Store contact info
            const sender = {
                id: senderId,
                username: senderUsername,
                publicKey: JSON.parse(data.public_key)
            };

            this.contacts.set(senderId, sender);

            // Decrypt and store shared secret for future communication
            // (In production, implement proper key management)

            this.showNotification('Contact Added', `${senderUsername} added to contacts`, 'success');
        } catch (error) {
            console.error('Error handling key exchange:', error);
        }
    }

    /**
     * Add message to conversation
     */
    addMessageToConversation(userId, username, content, isIncoming) {
        const key = userId;

        if (!this.conversations.has(key)) {
            this.conversations.set(key, []);
        }

        const conversation = this.conversations.get(key);
        conversation.push({
            userId,
            username,
            content,
            isIncoming,
            timestamp: new Date()
        });
    }

    /**
     * Load messages from server
     */
    async loadMessages() {
        try {
            const messages = await apiClient.getMessages();
            const messagesList = document.getElementById('messages-list');

            if (messages.length === 0) {
                messagesList.innerHTML = `
                    <div class="empty-state">
                        <p>No messages yet</p>
                        <small>Start a new conversation to send encrypted messages</small>
                    </div>
                `;
                return;
            }

            messagesList.innerHTML = '';

            messages.forEach(message => {
                const item = document.createElement('div');
                item.className = 'message-item';
                item.innerHTML = `
                    <div class="item-header">
                        <span class="item-from">${message.sender_username}</span>
                        <span class="item-time">${this.formatDate(message.created_at)}</span>
                    </div>
                    <div class="item-preview">${message.is_read ? '✓ Read' : '● New'}</div>
                `;
                item.onclick = () => this.openMessage(message);
                messagesList.appendChild(item);
            });
        } catch (error) {
            console.error('Error loading messages:', error);
        }
    }

    /**
     * Open/decrypt a stored message and auto-delete it.
     */
    async openMessage(message) {
        try {
            if (!this.userKeys || !this.userKeys.privateKey) {
                this.warnOnce(
                    'missing_private_key_open',
                    'Cannot Decrypt',
                    'Missing private key for this account in this browser. If you registered this account elsewhere or cleared site data, old messages cannot be decrypted here.',
                    'error'
                );
                return;
            }

            this.setLoadingState(true);

            const messageKey = await cryptoLib.decryptKeyWithPrivateKey(
                message.encrypted_key,
                this.userKeys.privateKey
            );

            const content = await cryptoLib.decryptMessage(
                message.encrypted_content,
                message.iv,
                messageKey
            );

            this.showNotification(`Message from ${message.sender_username}`, content, 'success');

            await apiClient.markMessageAsRead(message.id);
            await this.loadMessages();

            this.setLoadingState(false);
            cryptoLib.clearSensitiveData(messageKey);
        } catch (error) {
            console.error('Open message error:', error);
            this.showNotification('Error', 'Failed to decrypt message', 'error');
            this.setLoadingState(false);
        }
    }

    /**
     * Load files from server
     */
    async loadFiles() {
        try {
            const files = await apiClient.getFiles();
            const filesList = document.getElementById('files-list');

            if (files.length === 0) {
                filesList.innerHTML = `
                    <div class="empty-state">
                        <p>No files</p>
                        <small>File transfers appear here</small>
                    </div>
                `;
                return;
            }

            filesList.innerHTML = '';

            files.forEach(file => {
                const item = document.createElement('div');
                item.className = 'file-item';
                item.innerHTML = `
                    <div class="item-header">
                        <span class="item-from">📁 ${file.file_name}</span>
                        <span class="item-time">${this.formatFileSize(file.file_size)}</span>
                    </div>
                    <div class="item-preview">From: ${file.sender_username}</div>
                `;
                item.onclick = () => this.downloadFile(file.id, file.file_name);
                filesList.appendChild(item);
            });
        } catch (error) {
            console.error('Error loading files:', error);
        }
    }

    /**
     * Load contacts
     */
    async loadContacts() {
        try {
            const contacts = await apiClient.getContacts();
            const contactsList = document.getElementById('contacts-list');

            if (contacts.length === 0) {
                contactsList.innerHTML = `
                    <div class="empty-state">
                        <p>No contacts yet</p>
                        <small>Your contacts will appear here</small>
                    </div>
                `;
                return;
            }

            contactsList.innerHTML = '';

            contacts.forEach(contact => {
                const item = document.createElement('div');
                item.className = 'contact-item';
                item.innerHTML = `
                    <div class="item-header">
                        <span class="item-from">👤 ${contact.contact_user_username}</span>
                    </div>
                    <div class="item-preview">Encrypted connection active</div>
                `;
                contactsList.appendChild(item);
            });
        } catch (error) {
            console.error('Error loading contacts:', error);
        }
    }

    /**
     * Download file
     */
    async downloadFile(fileId, fileName) {
        try {
            this.setLoadingState(true);

            const fileData = await apiClient.downloadFile(fileId);

            // Decrypt file
            const encryptedFile = this.hexToArrayBuffer(fileData.encrypted_file);
            const fileKey = await cryptoLib.decryptKeyWithPrivateKey(
                fileData.encrypted_key,
                this.userKeys.privateKey
            );

            const decryptedBlob = await cryptoLib.decryptFile(
                encryptedFile,
                fileData.iv,
                fileKey
            );

            // Download decrypted file
            this.downloadBlob(decryptedBlob, fileName);

            this.showNotification('Success', 'File downloaded and decrypted', 'success');
            this.setLoadingState(false);
        } catch (error) {
            console.error('File download error:', error);
            this.showNotification('Error', 'Failed to download file', 'error');
            this.setLoadingState(false);
        }
    }

    /**
     * Download blob
     */
    downloadBlob(blob, fileName) {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
    }

    /**
     * Show notification
     */
    showNotification(title, message, type = 'info') {
        const container = document.getElementById('notification-container');

        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.innerHTML = `
            <div class="notification-title">${title}</div>
            <div class="notification-message">${message}</div>
        `;

        container.appendChild(notification);

        setTimeout(() => {
            notification.remove();
        }, 5000);
    }

    /**
     * Switch between sections
     */
    showSection(sectionName) {
        document.getElementById('auth-section').classList.toggle('hidden', sectionName !== 'auth');
        document.getElementById('app-section').classList.toggle('hidden', sectionName !== 'app');
    }

    /**
     * Switch between tabs
     * @param {string} tabName - Tab identifier
     * @param {Event} [evt] - Optional click event (used to activate the nav button)
     */
    switchTab(tabName, evt) {
        // Hide all tabs
        document.querySelectorAll('.tab-content').forEach(tab => {
            tab.classList.remove('active');
        });

        // Deactivate all nav items
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
        });

        // Show selected tab
        const tabElement = document.getElementById(`${tabName}-tab`);
        if (tabElement) {
            tabElement.classList.add('active');
        }

        // Activate the clicked nav item if the event is available
        const clickTarget = (evt && evt.currentTarget) || (evt && evt.target) || null;
        if (clickTarget) {
            clickTarget.classList.add('active');
        }
    }

    /**
     * Toggle auth forms
     */
    toggleAuthForms() {
        document.getElementById('login-form').classList.toggle('active');
        document.getElementById('register-form').classList.toggle('active');
    }

    /**
     * Set loading state
     */
    setLoadingState(isLoading) {
        const indicator = document.getElementById('loading-indicator');
        if (isLoading) {
            indicator.style.display = 'block';
        } else {
            indicator.style.display = 'none';
        }
    }

    /**
     * Format date
     */
    formatDate(dateString) {
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
        return date.toLocaleDateString();
    }

    /**
     * Format file size
     */
    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
    }

    /**
     * Clear sensitive data
     */
    clearSensitiveData() {
        // Clear form inputs
        document.querySelectorAll('input[type="password"]').forEach(input => {
            input.value = '';
        });

        // Clear message content
        const messageContent = document.getElementById('message-content');
        if (messageContent) {
            messageContent.value = '';
        }
    }

    /**
     * Convert hex to ArrayBuffer
     */
    hexToArrayBuffer(hex) {
        const bytes = new Uint8Array(hex.length / 2);
        for (let i = 0; i < hex.length; i += 2) {
            bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
        }
        return bytes.buffer;
    }

    /**
     * Convert ArrayBuffer to hex
     */
    arrayBufferToHex(buffer) {
        return Array.from(new Uint8Array(buffer))
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');
    }

    /**
     * Initiate 2FA Setup
     */
    async initiate2FASetup() {
        try {
            this.setLoadingState(true);
            const data = await apiClient.setup2FA();
            
            document.getElementById('2fa-qr-code').src = data.qr_code;
            document.getElementById('2fa-secret').textContent = data.secret;
            
            document.getElementById('2fa-setup-section').classList.remove('hidden');
            document.getElementById('setup-2fa-btn').classList.add('hidden');
            
            this.showNotification('2FA Setup', 'Scan the QR code with your authenticator app', 'info');
        } catch (error) {
            this.showNotification('2FA Setup Failed', error.message, 'error');
        } finally {
            this.setLoadingState(false);
        }
    }

    /**
     * Verify and Enable 2FA
     */
    async verify2FA() {
        const code = document.getElementById('2fa-verify-code').value.trim();
        if (!code) {
            this.showNotification('Validation', 'Please enter the 6-digit code', 'warning');
            return;
        }
        
        try {
            this.setLoadingState(true);
            await apiClient.verify2FA(code);
            
            this.showNotification('Success', 'Two-Factor Authentication is now enabled!', 'success');
            document.getElementById('2fa-setup-section').classList.add('hidden');
            document.getElementById('setup-2fa-btn').textContent = '2FA is Enabled';
            document.getElementById('setup-2fa-btn').disabled = true;
            document.getElementById('setup-2fa-btn').classList.remove('hidden');
        } catch (error) {
            this.showNotification('Verification Failed', error.message, 'error');
        } finally {
            this.setLoadingState(false);
        }
    }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.app = new BurnVaultApp();

    // Attach global functions for HTML onclick
    window.handleLogin = () => app.handleLogin();
    window.handleRegister = () => app.handleRegister();
    window.handleLogout = () => app.logout();
    window.toggleAuthForms = () => app.toggleAuthForms();
    // Pass the event so switchTab can highlight the clicked nav button
    window.switchTab = (tabName, evt) => app.switchTab(tabName, evt);
    window.sendMessage = () => app.sendMessage();
    window.clearRecipient = () => app.clearRecipient();
    window.initiate2FASetup = () => app.initiate2FASetup();
    window.verify2FA = () => app.verify2FA();

    // Search users with debounce
    let searchTimeout;
    document.getElementById('recipient-search')?.addEventListener('input', () => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => app.searchUsers(), 300);
    });

    // File input listener
    document.getElementById('message-file')?.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            document.getElementById('file-name-display').innerHTML = `✓ ${file.name}`;
        }
    });
});
