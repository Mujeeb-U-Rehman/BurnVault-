# BurnVault - Deliverable 3 Final Report
**Course:** Secure Software Development (CY321)

## 1. Security Testing Analysis & Techniques

During the development of BurnVault, various security testing techniques were employed to ensure the robustness of the system:

- **Static Application Security Testing (SAST):** The source code was analyzed for common vulnerabilities such as hardcoded secrets, insecure cryptographic implementations, and injection flaws.
- **Dynamic Application Security Testing (DAST):** Live API endpoints were tested against common web vulnerabilities (e.g., OWASP Top 10) including XSS, CSRF, and broken access control.
- **Manual Penetration Testing:** Manual testing focused on the zero-knowledge implementation to ensure that even with database access, messages and private keys could not be recovered without the user's password.
- **WebSocket Security Testing:** The Django Channels WebSocket implementation was tested to ensure proper JWT token validation and rejection of unauthenticated connections.

## 2. Secure Code Review

A comprehensive secure code review was conducted focusing on the following areas:

- **Authentication & Authorization:** Verified that all REST endpoints utilize `rest_framework_simplejwt.authentication.JWTAuthentication` and enforce `IsAuthenticated` permissions.
- **Cryptography Implementation:** Reviewed `frontend/static/js/crypto-lib.js` to ensure the correct usage of the `SubtleCrypto` API. Verified that `AES-GCM` uses unique 12-byte IVs for every encryption operation and that `RSA-OAEP` keys are generated with secure parameters (2048-bit modulus).
- **Ephemeral Logic:** Reviewed the Django views (`FileDownloadView` and `MarkMessageReadView`) to confirm that messages and files are permanently deleted (`.delete()`) from the database immediately after successful retrieval.

## 3. Final Security Fixes and Enhancements

Several security enhancements were integrated into the final release:

1. **Storage Backend Fix:** Resolved an issue where Django 4.2+ static file storage configuration broke the default file upload storage. Explicitly defined the `default` storage backend in `settings.py` to ensure file attachments are securely saved.
2. **Refresh Token Rotation:** Enhanced the SimpleJWT configuration by enabling `ROTATE_REFRESH_TOKENS = True` to prevent replay attacks and ensure tokens are invalidated correctly.
3. **Frontend Token Handling:** Improved `api-client.js` to gracefully handle new refresh tokens and securely store them in memory.
4. **CORS Hardening:** Configured `CORS_ALLOWED_ORIGINS` to restrict API access only from authorized domains in production environments.

## 4. Final Security Report Summary

### System Threat Model Status
The threat model defined in Deliverable 1 has been fully realized. The core mitigation—the Zero-Knowledge Architecture—has been successfully implemented. The server acts purely as a dumb relay for encrypted ciphertexts and never processes plaintext data.

### Implemented Security Features
- **End-to-End Encryption (E2EE):** Using Web Crypto API natively in the browser.
- **Zero-Knowledge Key Management:** Private keys are AES-encrypted using a password-derived key (PBKDF2) before being stored on the server.
- **Burn-on-Read:** Enforced server-side deletion upon data access.
- **JWT Authentication:** Stateless, short-lived tokens for secure API and WebSocket access.
- **Secure File Transfers:** Files are encrypted client-side before upload and deleted server-side post-download.

### Test Results
- **Authentication Bypass:** FAILED. All unauthorized API requests return 401 Unauthorized.
- **Data Leakage:** FAILED. Database inspection confirmed that `encrypted_content`, `encrypted_aes_key`, and `encrypted_private_key` fields contain only random ciphertext blobs.
- **Cross-Site Scripting (XSS):** FAILED. Frontend UI successfully sanitizes message content using `textContent` assignments instead of `innerHTML`.
- **WebSocket Hijacking:** FAILED. WebSocket connections strictly enforce JWT validation upon connection handshake.

## 5. Live Demo & Presentation
The project is fully operational and ready for the live demonstration. All features including registration, key generation, real-time encrypted messaging, and encrypted file transfers have been verified end-to-end.
