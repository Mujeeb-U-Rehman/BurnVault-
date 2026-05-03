/**
 * BurnVault Cryptography Library
 * Handles client-side encryption/decryption using AES-GCM
 * Public-key cryptography for key exchange
 */

class CryptoLib {
    constructor() {
        this.algorithm = {
            name: 'AES-GCM',
            length: 256
        };
        this.rsaAlgorithm = {
            name: 'RSA-OAEP',
            modulusLength: 2048,
            publicExponent: new Uint8Array([1, 0, 1]),
            hash: 'SHA-256'
        };
    }

    /**
     * Generate a unique AES key for encryption
     */
    async generateAESKey() {
        return await window.crypto.subtle.generateKey(
            this.algorithm,
            true,  // extractable
            ['encrypt', 'decrypt']
        );
    }

    /**
     * Generate RSA key pair for key exchange
     */
    async generateRSAKeyPair() {
        return await window.crypto.subtle.generateKey(
            this.rsaAlgorithm,
            true,  // extractable
            ['encrypt', 'decrypt']
        );
    }

    /**
     * Encrypt message with AES-GCM
     * @param {string} message - Message to encrypt
     * @param {CryptoKey} key - AES key for encryption
     * @returns {Promise<{encrypted: string, iv: string, key: CryptoKey}>}
     */
    async encryptMessage(message, key) {
        try {
            // Generate random IV
            const iv = window.crypto.getRandomValues(new Uint8Array(12));

            // Convert message to ArrayBuffer
            const encodedMessage = new TextEncoder().encode(message);

            // Encrypt message
            const encrypted = await window.crypto.subtle.encrypt(
                { name: 'AES-GCM', iv: iv },
                key,
                encodedMessage
            );

            // Convert to hex strings for transmission
            const encryptedHex = this.arrayBufferToHex(encrypted);
            const ivHex = this.arrayBufferToHex(iv);

            return {
                encrypted: encryptedHex,
                iv: ivHex,
                key: key
            };
        } catch (error) {
            console.error('Encryption error:', error);
            throw new Error('Failed to encrypt message');
        }
    }

    /**
     * Decrypt message with AES-GCM
     * @param {string} encryptedHex - Encrypted message in hex
     * @param {string} ivHex - IV in hex
     * @param {CryptoKey} key - AES key for decryption
     * @returns {Promise<string>} Decrypted message
     */
    async decryptMessage(encryptedHex, ivHex, key) {
        try {
            const encrypted = this.hexToArrayBuffer(encryptedHex);
            const iv = this.hexToArrayBuffer(ivHex);

            const decrypted = await window.crypto.subtle.decrypt(
                { name: 'AES-GCM', iv: iv },
                key,
                encrypted
            );

            return new TextDecoder().decode(decrypted);
        } catch (error) {
            console.error('Decryption error:', error);
            throw new Error('Failed to decrypt message');
        }
    }

    /**
     * Encrypt a file (Blob/File) with AES-GCM
     * @param {Blob} fileBlob - The file to encrypt
     * @param {CryptoKey} key - AES key
     * @returns {Promise<{encryptedBlob: Blob, iv: string, key: CryptoKey}>}
     */
    async encryptFile(fileBlob, key) {
        try {
            const iv = window.crypto.getRandomValues(new Uint8Array(12));
            const buffer = await fileBlob.arrayBuffer();

            const encrypted = await window.crypto.subtle.encrypt(
                { name: 'AES-GCM', iv: iv },
                key,
                buffer
            );

            const ivHex = this.arrayBufferToHex(iv);
            return {
                encryptedBlob: new Blob([encrypted]),
                iv: ivHex,
                key: key
            };
        } catch (error) {
            console.error('File encryption error:', error);
            throw new Error('Failed to encrypt file');
        }
    }

    /**
     * Decrypt a file with AES-GCM
     * @param {ArrayBuffer} encryptedBuffer - The encrypted file data
     * @param {string} ivHex - IV in hex
     * @param {CryptoKey} key - AES key
     * @returns {Promise<Blob>} Decrypted file as Blob
     */
    async decryptFile(encryptedBuffer, ivHex, key) {
        try {
            const iv = this.hexToArrayBuffer(ivHex);

            const decrypted = await window.crypto.subtle.decrypt(
                { name: 'AES-GCM', iv: iv },
                key,
                encryptedBuffer
            );

            return new Blob([decrypted]);
        } catch (error) {
            console.error('File decryption error:', error);
            throw new Error('Failed to decrypt file');
        }
    }

    /**
     * Encrypt AES key with RSA public key
     * @param {CryptoKey} aesKey - AES key to encrypt
     * @param {CryptoKey} rsaPublicKey - RSA public key
     * @returns {Promise<string>} Encrypted key in hex
     */
    async encryptKeyWithPublicKey(aesKey, rsaPublicKey) {
        try {
            // Export AES key as raw bytes
            const exportedKey = await window.crypto.subtle.exportKey('raw', aesKey);

            // Encrypt with RSA
            const encryptedKey = await window.crypto.subtle.encrypt(
                { name: 'RSA-OAEP' },
                rsaPublicKey,
                exportedKey
            );

            return this.arrayBufferToHex(encryptedKey);
        } catch (error) {
            console.error('Key encryption error:', error);
            throw new Error('Failed to encrypt key');
        }
    }

    /**
     * Decrypt AES key with RSA private key
     * @param {string} encryptedKeyHex - Encrypted key in hex
     * @param {CryptoKey} rsaPrivateKey - RSA private key
     * @returns {Promise<CryptoKey>} Decrypted AES key
     */
    async decryptKeyWithPrivateKey(encryptedKeyHex, rsaPrivateKey) {
        try {
            const encryptedKey = this.hexToArrayBuffer(encryptedKeyHex);

            const decryptedKey = await window.crypto.subtle.decrypt(
                { name: 'RSA-OAEP' },
                rsaPrivateKey,
                encryptedKey
            );

            return await window.crypto.subtle.importKey(
                'raw',
                decryptedKey,
                this.algorithm,
                true,
                ['encrypt', 'decrypt']
            );
        } catch (error) {
            console.error('Key decryption error:', error);
            throw new Error('Failed to decrypt key');
        }
    }

    /**
     * Export public key as JWK for transmission
     * @param {CryptoKey} publicKey - RSA public key
     * @returns {Promise<object>} Public key as JWK
     */
    async exportPublicKey(publicKey) {
        try {
            return await window.crypto.subtle.exportKey('jwk', publicKey);
        } catch (error) {
            console.error('Public key export error:', error);
            throw new Error('Failed to export public key');
        }
    }

    /**
     * Export private key as JWK for session storage
     * Note: This trades security for usability; keep it session-scoped.
     * @param {CryptoKey} privateKey - RSA private key
     * @returns {Promise<object>} Private key as JWK
     */
    async exportPrivateKey(privateKey) {
        try {
            return await window.crypto.subtle.exportKey('jwk', privateKey);
        } catch (error) {
            console.error('Private key export error:', error);
            throw new Error('Failed to export private key');
        }
    }

    /**
     * Import public key from JWK
     * @param {object} jwk - Public key as JWK
     * @returns {Promise<CryptoKey>} Imported public key
     */
    async importPublicKey(jwk) {
        try {
            return await window.crypto.subtle.importKey(
                'jwk',
                jwk,
                this.rsaAlgorithm,
                true,
                ['encrypt']
            );
        } catch (error) {
            console.error('Public key import error:', error);
            throw new Error('Failed to import public key');
        }
    }

    /**
     * Import private key from JWK
     * @param {object} jwk - Private key as JWK
     * @returns {Promise<CryptoKey>} Imported private key
     */
    async importPrivateKey(jwk) {
        try {
            return await window.crypto.subtle.importKey(
                'jwk',
                jwk,
                this.rsaAlgorithm,
                true,
                ['decrypt']
            );
        } catch (error) {
            console.error('Private key import error:', error);
            throw new Error('Failed to import private key');
        }
    }

    /**
     * Derive an AES-GCM CryptoKey from a password (PBKDF2).
     */
    async deriveKeyFromPassword(password, salt, iterations = 150000) {
        const enc = new TextEncoder();
        const baseKey = await window.crypto.subtle.importKey(
            'raw',
            enc.encode(password),
            'PBKDF2',
            false,
            ['deriveKey']
        );

        return await window.crypto.subtle.deriveKey(
            {
                name: 'PBKDF2',
                salt,
                iterations,
                hash: 'SHA-256'
            },
            baseKey,
            { name: 'AES-GCM', length: 256 },
            false,
            ['encrypt', 'decrypt']
        );
    }

    arrayBufferToBase64(buffer) {
        const bytes = new Uint8Array(buffer);
        let binary = '';
        for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
        return btoa(binary);
    }

    base64ToArrayBuffer(base64) {
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        return bytes.buffer;
    }

    /**
     * Encrypt a JSON-serializable value with a password.
     * Returns a JSON string containing salt/iv/ciphertext.
     */
    async encryptJSONWithPassword(value, password) {
        const salt = window.crypto.getRandomValues(new Uint8Array(16));
        const iv = window.crypto.getRandomValues(new Uint8Array(12));
        const key = await this.deriveKeyFromPassword(password, salt);

        const plaintext = new TextEncoder().encode(JSON.stringify(value));
        const ciphertext = await window.crypto.subtle.encrypt(
            { name: 'AES-GCM', iv },
            key,
            plaintext
        );

        return JSON.stringify({
            v: 1,
            kdf: 'PBKDF2-SHA256',
            iter: 150000,
            salt: this.arrayBufferToBase64(salt),
            iv: this.arrayBufferToBase64(iv),
            ct: this.arrayBufferToBase64(ciphertext)
        });
    }

    /**
     * Decrypt a JSON string produced by encryptJSONWithPassword.
     */
    async decryptJSONWithPassword(encryptedBlob, password) {
        let payload;
        try {
            payload = typeof encryptedBlob === 'string' ? JSON.parse(encryptedBlob) : encryptedBlob;
        } catch (e) {
            throw new Error('Invalid encrypted key blob');
        }

        const salt = new Uint8Array(this.base64ToArrayBuffer(payload.salt));
        const iv = new Uint8Array(this.base64ToArrayBuffer(payload.iv));
        const ct = this.base64ToArrayBuffer(payload.ct);
        const iterations = payload.iter || 150000;

        const key = await this.deriveKeyFromPassword(password, salt, iterations);
        const plaintext = await window.crypto.subtle.decrypt(
            { name: 'AES-GCM', iv },
            key,
            ct
        );

        const jsonText = new TextDecoder().decode(plaintext);
        return JSON.parse(jsonText);
    }

    /**
     * Store private key securely (in local storage with warning)
     * Note: In production, consider IndexedDB or specialized storage
     * @param {CryptoKey} privateKey - RSA private key
     * @returns {Promise<void>}
     */
    async storePrivateKey(privateKey) {
        try {
            // Private keys cannot be exported, so we'll manage them in memory
            // In production, use a more secure method (e.g., passwordless auth)
            console.warn('Private key stored in memory only');
            return privateKey;
        } catch (error) {
            console.error('Private key storage error:', error);
            throw new Error('Failed to store private key');
        }
    }

    /**
     * Generate a shared secret using ECDH
     * @param {CryptoKey} privateKey - User's private key
     * @param {CryptoKey} publicKey - Other user's public key
     * @returns {Promise<CryptoKey>} Shared secret
     */
    async generateSharedSecret(privateKey, publicKey) {
        try {
            return await window.crypto.subtle.deriveKey(
                {
                    name: 'ECDH',
                    public: publicKey
                },
                privateKey,
                { name: 'AES-GCM', length: 256 },
                true,
                ['encrypt', 'decrypt']
            );
        } catch (error) {
            console.error('Shared secret generation error:', error);
            throw new Error('Failed to generate shared secret');
        }
    }

    /**
     * Generate a hash of data (SHA-256)
     * @param {string} data - Data to hash
     * @returns {Promise<string>} Hash in hex
     */
    async hash(data) {
        try {
            const encodedData = new TextEncoder().encode(data);
            const hashBuffer = await window.crypto.subtle.digest('SHA-256', encodedData);
            return this.arrayBufferToHex(hashBuffer);
        } catch (error) {
            console.error('Hashing error:', error);
            throw new Error('Failed to hash data');
        }
    }

    /**
     * Generate random bytes
     * @param {number} length - Number of bytes
     * @returns {Uint8Array} Random bytes
     */
    generateRandomBytes(length) {
        return window.crypto.getRandomValues(new Uint8Array(length));
    }

    /**
     * Convert ArrayBuffer to hex string
     * @param {ArrayBuffer} buffer - Buffer to convert
     * @returns {string} Hex string
     */
    arrayBufferToHex(buffer) {
        return Array.from(new Uint8Array(buffer))
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');
    }

    /**
     * Convert hex string to ArrayBuffer
     * @param {string} hex - Hex string
     * @returns {ArrayBuffer} Buffer
     */
    hexToArrayBuffer(hex) {
        const bytes = new Uint8Array(hex.length / 2);
        for (let i = 0; i < hex.length; i += 2) {
            bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
        }
        return bytes.buffer;
    }

    /**
     * Securely clear sensitive data
     * @param {any} data - Data to clear
     */
    clearSensitiveData(data) {
        if (data instanceof Uint8Array) {
            data.fill(0);
        } else if (typeof data === 'object') {
            Object.keys(data).forEach(key => {
                delete data[key];
            });
        } else if (typeof data === 'string') {
            // Strings are immutable in JS, so we just return
            return;
        }
    }
}

// Create global instance
const cryptoLib = new CryptoLib();
