# BurnVault - Deliverable 2
**Course:** Secure Software Development (CY321)

## Initial Implementation & Secure Coding

The source code submission for Deliverable 2 is the entirety of this repository. The project has been fully implemented with secure coding practices integrated throughout the development lifecycle.

### Key Components:
- **Backend Source Code:** Located in the `/backend/` directory. It utilizes Django REST Framework with strict JWT authentication and Channels for secure WebSockets.
- **Frontend Source Code:** Located in the `/frontend/` directory. It implements the Web Crypto API for client-side Zero-Knowledge encryption in `crypto-lib.js`.
- **Environment Configuration:** All sensitive credentials are managed securely via `.env` files rather than hardcoded in the repository.

Please review the root `README.md`, `SECURITY.md`, and `API.md` for complete architectural and implementation details of the secure codebase.
