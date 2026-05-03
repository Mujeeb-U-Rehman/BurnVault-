/**
 * WebSocket Client for BurnVault
 * Handles real-time encrypted communication
 */

class WebSocketClient {
    constructor() {
        this.socket = null;
        this.connected = false;
        this.messageHandlers = {};
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 3000;
    }

    /**
     * Connect to WebSocket server
     */
    connect() {
        return new Promise((resolve, reject) => {
            try {
                const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
                const token = localStorage.getItem('access_token');
                const socketURL = `${protocol}//${window.location.host}/ws/messages/?token=${token}`;

                this.socket = new WebSocket(socketURL);

                this.socket.onopen = () => {
                    console.log('WebSocket connected');
                    this.connected = true;
                    this.reconnectAttempts = 0;
                    this.emit('connected');
                    resolve();
                };

                this.socket.onmessage = (event) => {
                    try {
                        const data = JSON.parse(event.data);
                        this.handleMessage(data);
                    } catch (error) {
                        console.error('WebSocket message parsing error:', error);
                    }
                };

                this.socket.onerror = (error) => {
                    console.error('WebSocket error:', error);
                    this.emit('error', error);
                    reject(error);
                };

                this.socket.onclose = () => {
                    console.log('WebSocket disconnected');
                    this.connected = false;
                    this.emit('disconnected');
                    this.attemptReconnect();
                };
            } catch (error) {
                reject(error);
            }
        });
    }

    /**
     * Attempt to reconnect
     */
    attemptReconnect() {
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            console.log(`Reconnecting... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
            setTimeout(() => this.connect().catch(console.error), this.reconnectDelay);
        } else {
            console.error('Max reconnection attempts reached');
            this.emit('reconnect_failed');
        }
    }

    /**
     * Send encrypted message
     */
    sendMessage(recipientId, encryptedContent, encryptedKey, iv) {
        if (!this.connected) {
            throw new Error('WebSocket not connected');
        }

        this.send({
            type: 'encrypt_message',
            recipient_id: recipientId,
            encrypted_content: encryptedContent,
            encrypted_key: encryptedKey,
            iv: iv,
            timestamp: new Date().toISOString()
        });
    }

    /**
     * Send encrypted file metadata
     */
    sendFileMetadata(recipientId, fileName, fileSize, encryptedKey, iv) {
        if (!this.connected) {
            throw new Error('WebSocket not connected');
        }

        this.send({
            type: 'encrypt_file',
            recipient_id: recipientId,
            file_name: fileName,
            file_size: fileSize,
            encrypted_key: encryptedKey,
            iv: iv,
            timestamp: new Date().toISOString()
        });
    }

    /**
     * Send key exchange request
     */
    sendKeyExchange(recipientId, publicKey, encryptedSharedSecret) {
        if (!this.connected) {
            throw new Error('WebSocket not connected');
        }

        this.send({
            type: 'key_exchange',
            recipient_id: recipientId,
            public_key: JSON.stringify(publicKey),
            encrypted_shared_secret: encryptedSharedSecret
        });
    }

    /**
     * Send raw message
     */
    send(data) {
        if (!this.connected) {
            console.warn('WebSocket not connected');
            return;
        }

        try {
            this.socket.send(JSON.stringify(data));
        } catch (error) {
            console.error('WebSocket send error:', error);
            throw error;
        }
    }

    /**
     * Handle incoming message
     */
    handleMessage(data) {
        const messageType = data.type;

        console.log('WebSocket message received:', messageType);

        if (messageType === 'message_received') {
            this.emit('message_received', data);
        } else if (messageType === 'file_received') {
            this.emit('file_received', data);
        } else if (messageType === 'key_exchange_received') {
            this.emit('key_exchange_received', data);
        } else if (messageType === 'message_sent') {
            this.emit('message_sent', data);
        } else if (messageType === 'file_metadata_sent') {
            this.emit('file_sent', data);
        } else if (messageType === 'key_exchange_sent') {
            this.emit('key_exchange_sent', data);
        } else if (messageType === 'error') {
            this.emit('ws_error', data);
        }
    }

    /**
     * Register event handler
     */
    on(eventType, handler) {
        if (!this.messageHandlers[eventType]) {
            this.messageHandlers[eventType] = [];
        }
        this.messageHandlers[eventType].push(handler);
    }

    /**
     * Emit event
     */
    emit(eventType, data = null) {
        if (this.messageHandlers[eventType]) {
            this.messageHandlers[eventType].forEach(handler => {
                try {
                    handler(data);
                } catch (error) {
                    console.error(`Event handler error (${eventType}):`, error);
                }
            });
        }
    }

    /**
     * Disconnect
     */
    disconnect() {
        if (this.socket) {
            this.socket.close();
        }
    }

    /**
     * Check if connected
     */
    isConnected() {
        return this.connected;
    }
}

// Create global instance
const wsClient = new WebSocketClient();
