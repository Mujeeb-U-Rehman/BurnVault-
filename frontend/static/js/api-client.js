/**
 * API Client for BurnVault
 * Handles HTTP requests to backend with JWT authentication
 */

class APIClient {
    constructor(baseURL = '') {
        this.baseURL = baseURL || window.location.origin;
        this.token = this.getToken();
        this.refreshToken = this.getRefreshToken();
    }

    /**
     * Set authorization tokens
     */
    setTokens(accessToken, refreshToken) {
        localStorage.setItem('access_token', accessToken);
        localStorage.setItem('refresh_token', refreshToken);
        this.token = accessToken;
        this.refreshToken = refreshToken;
    }

    /**
     * Get stored access token
     */
    getToken() {
        return localStorage.getItem('access_token');
    }

    /**
     * Get stored refresh token
     */
    getRefreshToken() {
        return localStorage.getItem('refresh_token');
    }

    /**
     * Clear tokens
     */
    clearTokens() {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        this.token = null;
        this.refreshToken = null;
    }

    /**
     * Make HTTP request
     */
    async request(endpoint, options = {}) {
        const url = `${this.baseURL}${endpoint}`;
        const headers = {
            'Content-Type': 'application/json',
            ...options.headers
        };

        if (this.token) {
            headers['Authorization'] = `Bearer ${this.token}`;
        }

        const parseErrorBody = async (resp) => {
            try {
                const data = await resp.json();
                return data?.detail || data?.error || JSON.stringify(data);
            } catch (e) {
                try {
                    const text = await resp.text();
                    return text ? text.slice(0, 300) : resp.statusText;
                } catch (e2) {
                    return resp.statusText;
                }
            }
        };

        const parseOkBody = async (resp) => {
            // Some endpoints might return 204/empty bodies
            const contentType = resp.headers.get('content-type') || '';
            if (resp.status === 204) return null;
            if (contentType.includes('application/json')) {
                return await resp.json();
            }
            // Fallback: return text for unexpected content types
            return await resp.text();
        };

        try {
            let response = await fetch(url, {
                ...options,
                headers
            });

            if (response.status === 401) {
                const isAuthEndpoint = endpoint === '/api/token/'
                    || endpoint === '/api/token/refresh/'
                    || endpoint === '/api/register/';

                // Only attempt refresh for non-auth endpoints when we actually have a refresh token.
                if (!isAuthEndpoint && this.refreshToken) {
                    const refreshed = await this.refreshAccessToken();
                    if (refreshed) {
                        headers['Authorization'] = `Bearer ${this.token}`;
                        response = await fetch(url, { ...options, headers });
                    }
                }

                // If still unauthorized, clear tokens and surface the real error to the caller.
                if (response.status === 401) {
                    this.clearTokens();
                }
            }

            if (!response.ok) {
                const message = await parseErrorBody(response);
                throw new Error(message || response.statusText);
            }

            return await parseOkBody(response);
        } catch (error) {
            console.error(`API request error: ${endpoint}`, error);
            throw error;
        }
    }

    /**
     * Refresh access token
     */
    async refreshAccessToken() {
        try {
            const response = await fetch(`${this.baseURL}/api/token/refresh/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ refresh: this.refreshToken })
            });

            if (response.ok) {
                const data = await response.json();
                this.setTokens(data.access, data.refresh || this.refreshToken);
                return true;
            }
            return false;
        } catch (error) {
            console.error('Token refresh error:', error);
            return false;
        }
    }

    /**
     * Register new user
     */
    async register(username, email, password, publicKey) {
        return this.request('/api/register/', {
            method: 'POST',
            body: JSON.stringify({
                username,
                email,
                password,
                public_key: publicKey
            })
        });
    }

    /**
     * Register with optional encrypted private key backup.
     */
    async registerWithKeyBackup(username, email, password, publicKey, encryptedPrivateKey) {
        return this.request('/api/register/', {
            method: 'POST',
            body: JSON.stringify({
                username,
                email,
                password,
                public_key: publicKey,
                encrypted_private_key: encryptedPrivateKey
            })
        });
    }

    /**
     * Login user
     */
    async login(username, password) {
        return this.request('/api/token/', {
            method: 'POST',
            body: JSON.stringify({
                username,
                password
            })
        });
    }

    /**
     * Get current user profile
     */
    async getUserProfile() {
        return this.request('/api/profile/me/');
    }

    /**
     * Update current user's public key
     */
    async updateMyPublicKey(publicKey) {
        return this.request('/api/profile/me/public_key/', {
            method: 'PUT',
            body: JSON.stringify({ public_key: publicKey })
        });
    }

    /**
     * Get current user's stored keys (public + encrypted private).
     */
    async getMyKeys() {
        return this.request('/api/profile/me/keys/');
    }

    /**
     * Update current user's stored keys (public + encrypted private).
     */
    async updateMyKeys(publicKey, encryptedPrivateKey) {
        return this.request('/api/profile/me/keys/', {
            method: 'PUT',
            body: JSON.stringify({
                public_key: publicKey,
                encrypted_private_key: encryptedPrivateKey
            })
        });
    }

    /**
     * Search for users
     */
    async searchUsers(query) {
        return this.request(`/api/profile/search/?q=${encodeURIComponent(query)}`);
    }

    /**
     * Send encrypted message
     */
    async sendMessage(recipient, encryptedContent, encryptedKey, iv) {
        return this.request('/api/messages/', {
            method: 'POST',
            body: JSON.stringify({
                recipient,
                encrypted_content: encryptedContent,
                encrypted_key: encryptedKey,
                iv
            })
        });
    }

    /**
     * Get received messages
     */
    async getMessages() {
        return this.request('/api/messages/');
    }

    /**
     * Mark message as read and delete
     */
    async markMessageAsRead(messageId) {
        return this.request(`/api/messages/${messageId}/mark_as_read/`, {
            method: 'POST'
        });
    }

    /**
     * Send encrypted file
     */
    async sendFile(recipient, file, encryptedKey, iv, fileName) {
        const formData = new FormData();
        formData.append('recipient', recipient);
        formData.append('file_name', fileName);
        formData.append('file', file);
        formData.append('encrypted_key', encryptedKey);
        formData.append('iv', iv);

        const headers = {};
        if (this.token) {
            headers['Authorization'] = `Bearer ${this.token}`;
        }

        try {
            const response = await fetch(`${this.baseURL}/api/files/`, {
                method: 'POST',
                headers,
                body: formData
            });

            if (!response.ok) {
                throw new Error(response.statusText);
            }

            return await response.json();
        } catch (error) {
            console.error('File upload error:', error);
            throw error;
        }
    }

    /**
     * Get received files
     */
    async getFiles() {
        return this.request('/api/files/');
    }

    /**
     * Download file
     */
    async downloadFile(fileId) {
        return this.request(`/api/files/${fileId}/download/`);
    }

    /**
     * Get contacts
     */
    async getContacts() {
        return this.request('/api/contacts/');
    }

    /**
     * Add contact with shared secret
     */
    async addContact(contactUserId, encryptedSharedSecret) {
        return this.request('/api/contacts/', {
            method: 'POST',
            body: JSON.stringify({
                contact_user: contactUserId,
                encrypted_shared_secret: encryptedSharedSecret
            })
        });
    }
}

// Create global instance
const apiClient = new APIClient();
