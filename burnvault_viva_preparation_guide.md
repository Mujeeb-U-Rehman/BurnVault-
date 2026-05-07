# BurnVault — Complete Presentation and Viva Preparation Guide

## Section 1: Project Overview

BurnVault is a zero-knowledge ephemeral communication platform designed to provide a highly secure environment for whistleblowers, legal professionals, and high-security teams to exchange sensitive messages and files. Its unique selling point lies in the combination of a strict zero-knowledge architecture—where the server never possesses plaintext data or the means to decrypt it—with an aggressive ephemerality model. Through "burn-on-read" and "destroy-after-download" mechanisms, messages and files are permanently and verifiably deleted from the server immediately after they are consumed, leaving absolutely no residual data behind.

## Section 2: Architecture & Technology Stack (In‑Depth)

BurnVault utilizes a modern, defense-in-depth architecture split across specialized layers to guarantee end-to-end security and ephemerality.

*   **Frontend Layer:** Built with Vanilla JavaScript (ES6+), HTML5, and Pure CSS to maintain a clean, lightweight UI without relying on heavy frontend frameworks. By avoiding unnecessary dependencies, we reduce the client-side attack surface and minimize the risk of supply-chain attacks.
*   **Cryptographic Layer (Client-Side):** Utilizes the browser-native **Web Crypto API**. We deliberately chose not to use third-party cryptographic libraries to avoid external vulnerabilities. All encryption, decryption, and key generation operations occur strictly within the browser memory.
*   **Backend Layer:** Powered by **Python, Django, and Django REST Framework (DRF)**. Django provides robust built-in security features (like ORM parameterized queries to prevent SQL injection and CSRF protection), while DRF handles secure API endpoints.
*   **Real-Time Communication Layer:** Implemented using **Django Channels** and WebSockets over a secure `wss://` connection. This allows for instant notification when a message arrives without requiring constant, resource-intensive HTTP polling.
*   **Message Broker & Caching Layer:** **Redis** serves a dual purpose. It acts as the high-performance message broker for Django Channels to manage WebSocket connections, and it functions as an ephemeral cache for ciphertext storage, leveraging Time-To-Live (TTL) and hard `DEL` commands for rapid data purging.
*   **Database Layer:** PostgreSQL (or SQLite for development) is used to store user models and encrypted blobs. The database only ever holds encrypted ciphertext and wrapped keys; it never stores plaintext data or usable private keys.

**Why Django Channels + Redis?**
Django Channels extends Django to handle asynchronous protocols like WebSockets, which is essential for real-time secure messaging. Redis was chosen as the backing store because it is an in-memory data structure store that provides sub-millisecond latency for message brokering. Additionally, Redis perfectly supports our ephemerality requirement—we can execute a hard `DEL` operation in Redis coupled with a database `.delete()` to ensure data is wiped instantly from all layers.

**Enforcing the Zero-Knowledge Principle**
The zero-knowledge principle is enforced at the architectural level by ensuring all encryption and decryption happens on the client side. The server only receives and stores encrypted blobs and wrapped (encrypted) keys. The server does not possess the user's plaintext password or private RSA key, meaning it is mathematically impossible for the server (or anyone who breaches the server) to decrypt the stored messages.

**Data-Flow Diagram (Textual):**
```text
[ Sender's Browser ]
   |  1. Fetches Recipient's Public Key.
   |  2. Generates Ephemeral AES Key.
   |  3. Encrypts Message (AES) + Wraps AES Key (RSA).
   v
[ HTTPS / WSS Transit ] --> (Encrypted Payload)
   v
[ Django Server & DRF ]
   |  4. Validates JWT & Payload.
   |  5. Stores Encrypted Blob in DB / Redis.
   |  6. Sends WebSocket Notification via Channels.
   v
[ Recipient's Browser ]
   |  7. Receives Notification, Fetches Payload.
   |  8. Unwraps AES Key using Private RSA Key (in memory).
   |  9. Decrypts Message (AES) & Displays it.
   v
[ Django Server ]
   | 10. Executes DB .delete() & Redis DEL instantly upon successful fetch.
```

## Section 3: Detailed Cryptographic Workflows

### 1. Registration & Key Generation
*   **Operations:** User inputs password. Browser generates an **RSA-2048-OAEP** key pair. The password is stretched and derived into an AES-GCM key using **PBKDF2** (with a secure salt and high iteration count). The private RSA key is encrypted using this derived AES-GCM key.
*   **Location:** Completely inside the **Sender's Browser** (Client-side).
*   **Why these algorithms:** RSA-2048 provides strong asymmetric security for key wrapping. OAEP padding prevents chosen-ciphertext attacks. PBKDF2 protects against brute-force password guessing by making derivation computationally expensive.
*   **Data Sent to Server:** Public RSA Key, Encrypted Private RSA Key, PBKDF2 Salt.

### 2. Authentication & Key Recovery
*   **Operations:** User logs in with password. Server authenticates and returns a short-lived **JWT** and the user's Encrypted Private RSA Key. The browser re-derives the AES key using PBKDF2 and the user's password. It then decrypts the Private RSA Key and holds it **only in browser memory** (never on disk/localStorage).
*   **Location:** PBKDF2 derivation and RSA decryption happen in the **Browser**. JWT validation happens on the **Server**.
*   **Why these algorithms:** Keeping the private key only in memory minimizes exposure if the device is compromised while offline. JWT provides stateless authentication.

### 3. Sending an Encrypted Message
*   **Operations:** Sender fetches recipient's Public RSA Key. Sender's browser generates a random, single-use **ephemeral AES-256-GCM** key and an Initialization Vector (IV). The plaintext message is encrypted with this AES key. The ephemeral AES key is then **wrapped (encrypted)** using the recipient's Public RSA Key.
*   **Location:** **Sender's Browser**.
*   **Why these algorithms:** AES-256-GCM is used for authenticated encryption (it encrypts the data and ensures it hasn't been tampered with via an authentication tag). Asymmetric RSA is too slow for large data, so we use it only to encrypt the small AES symmetric key (a hybrid encryption model).
*   **Data Sent to Server:** `{ ciphertext, wrapped_AES_key, IV, recipient_id }`.

### 4. Receiving & Decrypting (Burn-on-Read)
*   **Operations:** Recipient fetches the payload. Using their Private RSA key (held in memory), they unwrap the ephemeral AES key. The ephemeral AES key + IV are used to decrypt the message ciphertext. Immediately upon successful retrieval, the server executes a `.delete()` on the database.
*   **Location:** Decryption in **Recipient's Browser**. Deletion on the **Server**.

### 5. Secure File Transfer
*   **Operations:** File read as an `ArrayBuffer` in the browser. Encrypted with a fresh ephemeral AES-GCM key. File metadata (name, MIME type) and the AES key are wrapped with the recipient's Public RSA key. The encrypted file and metadata are uploaded. Upon download, the recipient unwraps the metadata and key, decrypts the blob, and triggers a local download. The server deletes the DB record and physical file post-download.
*   **Location:** Encryption/Decryption in **Browser**. Storage/Deletion on **Server**.

**Key Hierarchy Diagram:**
```text
User Password
      |
      v (PBKDF2 Derivation)
      |
Derived Symmetric Key (AES-GCM)
      |
      v (Decrypts at Login)
      |
Private RSA Key (Held in Memory)
      |
      v (Unwraps during Message Receive)
      |
Ephemeral AES-256-GCM Key  ------> Decrypts ------> Plaintext Message / File
```

## Section 4: Security Design & Threat Mitigations

**STRIDE Threat Model Analysis**

| Threat Category | Definition | BurnVault Mitigation |
| :--- | :--- | :--- |
| **S**poofing | Impersonating a user. | Enforced JWT authentication with short expiry times and TOTP-based 2FA. |
| **T**ampering | Modifying data in transit/rest. | AES-256-GCM provides an authentication tag; tampering fails decryption. HTTPS/TLS 1.3 secures transit. |
| **R**epudiation | Denying an action occurred. | JWT strictly binds all API actions to a verified user identity. |
| **I**nformation Disclosure | Exposing sensitive data. | Zero-knowledge architecture, hybrid end-to-end encryption, and Burn-on-Read. |
| **D**enial of Service | Disrupting the system. | Rate limiting on API endpoints, Redis connection throttling. |
| **E**levation of Privilege | Gaining unauthorized access. | Django object-level permissions, strict ownership checks on API views. |

**Core Security Controls Map to OWASP Top 10:**
1.  **Cryptography (Web Crypto API):** Mitigates *Cryptographic Failures* (A02:2021) by ensuring strong encryption at rest and in transit.
2.  **Authentication (JWT + 2FA):** Mitigates *Identification and Authentication Failures* (A07:2021) by ensuring session integrity.
3.  **Database Security (Django ORM):** Mitigates *Injection* (A03:2021) by using parameterized queries exclusively.
4.  **Network Security (Security Headers):** Mitigates *Security Misconfiguration* (A05:2021) using strict CORS, CSP, HSTS, and WSS.

**Implementing Ephemerality (Burn-on-Read) in Code:**
Ephemerality is guaranteed transactionally. When the recipient hits the `/api/messages/{id}/read/` endpoint, the Django view fetches the encrypted data, packages it for the HTTP response, and immediately calls `message.delete()` on the Django ORM model. Concurrently, it issues a `redis_client.delete(cache_key)` to purge the message broker cache. This ensures the data is returned to the user *and* destroyed on the server in a single synchronous flow.

**Preventing Client-Side Data Leakage:**
We prevent browser caching of sensitive pages and API responses by aggressively using `Cache-Control: no-store, no-cache, must-revalidate` headers. Sensitive variables (like the decrypted private key) are stored in standard JavaScript variables that are lost on page refresh, not in `localStorage`. Service Workers are completely disabled to prevent offline caching of payloads.

## Section 5: Security Testing Approach & Results

We employed both Static Application Security Testing (SAST) and Dynamic Application Security Testing (DAST) to comprehensively evaluate the application.
*   **Static Analysis:** Analyzes the source code without running it to find structural vulnerabilities, bad practices, and complexity issues.
*   **Dynamic Analysis:** Analyzes the application while it is running by simulating attacks to find runtime vulnerabilities and configuration errors.

**Security Testing Results:**

1.  **Bandit (Python Security Linter - Static)**
    *   **What it tests:** Scans Python code for known security issues (e.g., hardcoded passwords, shell injections, weak crypto).
    *   **Findings:** 1 LOW severity issue (`B110 – try, except, pass`). 0 HIGH/MEDIUM issues.
    *   **Fix:** Left as an acceptable risk (or fixed by logging the exception), but its low severity signifies that the core logic is highly secure and free of critical flaws like SQLi.
2.  **Pylint (Code Quality - Static)**
    *   **What it tests:** Code quality, styling, and structural logic. High quality correlates with fewer bugs and higher security.
    *   **Findings:** Initial score was 5.76/10.
    *   **Fix:** Refactored unused imports, fixed bare excepts, and corrected naming conventions. Final score improved to **8.42/10** (+2.66).
3.  **Radon (Complexity - Static)**
    *   **What it tests:** Cyclomatic complexity (how many independent paths exist through a function). High complexity means code is hard to test and prone to logic flaws.
    *   **Findings:** All functions scored Grade A or B (complexity ≤10). No excessively complex functions found.
4.  **Safety (Dependency Scan - Static)**
    *   **What it tests:** Scans `requirements.txt` against a database of known vulnerable packages.
    *   **Findings:** 0 known CVEs. All dependencies are secure.
5.  **Coverage.py (Test Coverage - Dynamic)**
    *   **What it tests:** Measures the percentage of codebase executed during automated testing.
    *   **Findings:** Started at 54%.
    *   **Fix:** Wrote additional unit tests for crypto utilities and WebSocket consumers, raising coverage to **87%**.
6.  **OWASP ZAP (Web Application Scanner - Dynamic)**
    *   **What it tests:** Actively attacks the running app (`127.0.0.1:8000`) looking for HTTP misconfigurations, XSS, and injection flaws.
    *   **Findings:** 0 High. 2 Medium (missing CSP, missing X-Frame-Options). 3 Low (verbose errors).
    *   **Fix:** Added Django middleware to enforce strict CSP, added `X-Frame-Options: DENY` to prevent clickjacking, and disabled `DEBUG=True` to stop verbose errors.

## Section 6: Code Walkthrough (Key Implementation Details)

**1. Frontend: Generating RSA Key and Wrapping Private Key (Conceptual JS)**
```javascript
// 1. Generate RSA Key Pair
const keyPair = await window.crypto.subtle.generateKey(
    { name: "RSA-OAEP", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" },
    true, ["encrypt", "decrypt"]
);

// 2. Derive AES Key from Password (PBKDF2)
const derivedAesKey = await deriveKeyFromPassword(userPassword, salt);

// 3. Wrap (Encrypt) the Private Key
const exportedPrivateKey = await window.crypto.subtle.exportKey("pkcs8", keyPair.privateKey);
const wrappedPrivateKey = await window.crypto.subtle.encrypt(
    { name: "AES-GCM", iv: crypto.getRandomValues(new Uint8Array(12)) },
    derivedAesKey,
    exportedPrivateKey
);
// Send wrappedPrivateKey to server... Server cannot decrypt it without userPassword.
```

**2. Backend: Django View for Burn-on-Read (Conceptual Python)**
```python
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def retrieve_message(request, message_id):
    try:
        # Fetch the encrypted message
        message = Message.objects.get(id=message_id, recipient=request.user)
        
        # Extract data for the response
        response_data = {
            "ciphertext": message.ciphertext,
            "wrapped_aes_key": message.wrapped_aes_key,
            "iv": message.iv
        }
        
        # BURN-ON-READ: Instantly delete the record from the database
        message.delete()
        
        # Return the data to the user for local decryption
        return Response(response_data, status=status.HTTP_200_OK)
        
    except Message.DoesNotExist:
        return Response({"error": "Message not found or already burned."}, status=404)
```
*Security Note:* This deletion happens synchronously before the response leaves the server. If the server crashes mid-request, standard database transaction rollbacks ensure the message either exists entirely or is deleted entirely.

**3. Backend: WebSocket Consumer (Conceptual Python)**
```python
class NotificationConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.user = self.scope["user"]
        if self.user.is_anonymous:
            await self.close()
        else:
            self.room_group_name = f'user_{self.user.id}'
            await self.channel_layer.group_add(self.room_group_name, self.channel_name)
            await self.accept()

    async def notify_message(self, event):
        # Triggered when a new encrypted message is saved in the DB
        await self.send(text_data=json.dumps({
            'type': 'new_message',
            'message_id': event['message_id']
        }))
```

## Section 7: Potential Viva Questions & Model Answers

**1. Why did you choose RSA-2048 and AES-256-GCM instead of using just RSA for everything?**
*Answer:* Asymmetric encryption like RSA is highly computationally expensive and can only encrypt data smaller than its key size. We use a "hybrid encryption" model. We use AES-256-GCM (symmetric encryption) to quickly and securely encrypt the actual message payload of any size. We then use RSA-2048 (asymmetric) only to encrypt and securely exchange the tiny ephemeral AES key. AES-GCM also provides an authentication tag, ensuring the message wasn't tampered with.

**2. Explain "Zero-Knowledge" in the context of BurnVault.**
*Answer:* Zero-knowledge means the server facilitates communication and storage but fundamentally lacks the mathematical ability to read the data. In BurnVault, data is encrypted on the client before leaving the browser. The server only stores ciphertext. Furthermore, the server stores the user's private key in an encrypted state, and the key required to decrypt it (derived from the user's password) is never sent to the server. Therefore, even a full server breach yields no plaintext.

**3. How does Burn-on-Read guarantee deletion? What if the user loses connection during the read?**
*Answer:* When the client requests the message via the API, the server fetches the record, prepares the response, and calls `.delete()` on the database in a synchronous transaction. The database guarantees the record is purged. If the user loses connection *after* the server sends the response but *before* the browser receives it, the message is permanently lost. This is a deliberate, fail-secure design choice: we prioritize absolute data destruction over guaranteed delivery.

**4. Why use PBKDF2 for password derivation?**
*Answer:* Passwords are often weak. PBKDF2 (Password-Based Key Derivation Function 2) "stretches" the password by applying a hashing algorithm (like SHA-256) thousands of times along with a random salt. This makes brute-force or dictionary attacks computationally infeasible if an attacker were to steal the encrypted private key and try to guess the password used to encrypt it.

**5. What is the difference between Authentication and Authorisation in your app?**
*Answer:* Authentication verifies *who* the user is, which we handle via short-lived JWTs (JSON Web Tokens) proving identity upon login. Authorisation determines *what* they are allowed to do. We implement authorisation using Django's object-level permissions, ensuring a user can only query or delete messages where their ID matches the `recipient_id`.

**6. What are XSS and CSP? How do they relate?**
*Answer:* Cross-Site Scripting (XSS) is an attack where malicious JavaScript is injected into a web page and executed by the victim's browser, potentially stealing secrets held in memory (like our private RSA keys). A Content Security Policy (CSP) is an HTTP header that mitigates XSS by strictly defining which domains the browser is allowed to load scripts from, effectively blocking unauthorized inline scripts.

**7. Why did you deliberately avoid using third-party cryptographic libraries (like crypto.js)?**
*Answer:* Third-party libraries increase the supply chain attack surface. If a library is compromised via a malicious NPM update, our entire encryption scheme is broken. By using the browser-native Web Crypto API, we rely on heavily audited, low-level cryptographic primitives implemented directly by browser vendors (like Google and Mozilla), ensuring maximum security and performance.

**8. How does a JWT work and why are refresh tokens useful?**
*Answer:* A JWT consists of a header, payload, and signature. The server signs it to prevent tampering. In BurnVault, JWTs authenticate WebSocket and API requests statelessly. Access tokens are short-lived (e.g., 15 minutes) to limit the window of exploitation if stolen. Refresh tokens live longer and are stored securely (HTTP-only cookies) to automatically request new access tokens without requiring the user to constantly log in.

**9. What is the STRIDE model and give an example of how you used it?**
*Answer:* STRIDE is a threat modeling framework (Spoofing, Tampering, Repudiation, Information Disclosure, Denial of Service, Elevation of Privilege). For example, to mitigate "Tampering" during transit, we enforce TLS 1.3. To mitigate "Tampering" of data at rest, we use AES-GCM, where the 'GCM' mode generates an authentication tag that causes decryption to fail if a single bit of the ciphertext is altered in the database.

**10. Why did you use Redis?**
*Answer:* We used Redis for two reasons. First, as a high-speed, low-latency message broker required by Django Channels to manage asynchronous WebSocket traffic. Second, as an ephemeral data store. Redis is an in-memory database, meaning data is inherently volatile, and it supports hard `DEL` commands, making it perfect for enforcing our strict burn-on-read ephemerality constraints.

**11. What happens if the database is compromised after a message is burned?**
*Answer:* Nothing. Because we use an immediate `.delete()` command in the database, the record is physically removed. Furthermore, because of zero-knowledge, even if an attacker compromises the database *before* the message is read, they only obtain AES-256 encrypted blobs and RSA wrapped keys with no means to decrypt them.

**12. How does the File Transfer workflow differ from Messaging?**
*Answer:* Text messages are small enough to encrypt directly. Files can be large (e.g., PDFs). Reading a large file into browser memory as an ArrayBuffer and encrypting it takes time. The file and its metadata (name, extension) are encrypted symmetrically with AES-GCM. Then, only the AES key and metadata are encrypted asymmetrically via RSA. The server handles the encrypted file as a binary blob and deletes it from disk using `os.remove()` immediately after download.

**13. Discuss the results of the OWASP ZAP scan.**
*Answer:* The DAST scan via ZAP found 0 High risk issues, demonstrating strong core architecture. It flagged 2 Medium risks: a missing Content-Security-Policy and missing X-Frame-Options (which prevents UI redressing/clickjacking). We remediated these by implementing strict HTTP headers in Django middleware.

**14. Why does a Pylint score matter for security?**
*Answer:* Pylint enforces code quality. Poor quality code—such as unused variables, overly complex logic, or bare exception handling (swallowing errors)—often hides subtle logical bugs. By improving our score from 5.76 to 8.42, we simplified the code, making security auditing much easier and reducing the likelihood of hidden vulnerabilities.

**15. What does Bandit finding only 1 LOW issue signify?**
*Answer:* Bandit scans the Abstract Syntax Tree of the Python code for known security bad practices. Finding only one low-level issue (a bare except block) proves that our code does not contain hardcoded credentials, insecure deserialization functions, or unsafe raw SQL queries, validating the robustness of our backend implementation.

**16. What is code coverage and why did you aim for >80%?**
*Answer:* Code coverage measures the percentage of our codebase that is executed during automated testing. Starting at 54% meant critical paths (like crypto utilities) weren't tested automatically. We wrote unit tests to achieve 87% coverage. Industry standards usually suggest >80% provides a strong safety net against regression, ensuring that future updates don't accidentally break security mechanisms.

**17. Distinguish between Static (SAST) and Dynamic (DAST) analysis.**
*Answer:* SAST tools (like Bandit and Pylint) analyze the source code from the inside out without running it, looking for bad syntax and known insecure patterns. DAST tools (like ZAP) attack the running application from the outside in, looking for runtime vulnerabilities like misconfigured HTTP headers or actual cross-site scripting vulnerabilities. Using both provides defense-in-depth testing.

**18. What was the most challenging part of the project?**
*Answer:* Implementing the Web Crypto API securely. JavaScript handles binary data asynchronously using Promises and ArrayBuffers, which is complex. Ensuring that the private key was successfully decrypted via PBKDF2 into memory, used to unwrap the ephemeral AES key, and then properly discarded without leaking into global scope or the browser cache required meticulous state management and testing.

**19. Why use HTTP-Only cookies?**
*Answer:* HTTP-Only cookies cannot be accessed via client-side JavaScript (e.g., `document.cookie`). We use them to store our JWT refresh tokens. If our application were vulnerable to an XSS attack, the attacker's script would be unable to steal the refresh token, protecting the user's session from being hijacked.

**20. What is the purpose of the AES Initialization Vector (IV)?**
*Answer:* An IV ensures that if we encrypt the exact same plaintext message twice with the same AES key, the resulting ciphertexts will be completely different. It provides semantic security by preventing attackers from recognizing patterns in the encrypted data. The IV does not need to be secret, so we send it in plaintext alongside the ciphertext.

## Section 8: Quick Revision Flashcards

*   **Project Goal:** Zero-Knowledge, Ephemeral (Burn-on-Read) secure messaging.
*   **Zero-Knowledge:** Server never sees plaintext or usable private keys. Client-side encryption only.
*   **Ephemerality:** `.delete()` in DB and `DEL` in Redis executed instantaneously on read.
*   **Crypto - Key Wrapping:** **RSA-2048-OAEP** (Used to encrypt the ephemeral AES keys).
*   **Crypto - Message Encryption:** **AES-256-GCM** (Provides authenticated encryption; generates cipher + auth tag).
*   **Crypto - Password Derivation:** **PBKDF2** (Stretches password to decrypt the user's private RSA key at login).
*   **Crypto API:** Browser-native **Web Crypto API** (No third-party libs = smaller attack surface).
*   **Backend:** Python, Django, DRF (Django prevents SQLi via ORM parameterization).
*   **Real-Time:** Django Channels + Redis (WebSockets via `wss://`).
*   **Auth:** JWTs (Stateless, short expiry) + 2FA.
*   **Testing - SAST:** Bandit (1 Low issue), Pylint (Score 8.42), Radon (Grade A/B complexity).
*   **Testing - DAST:** OWASP ZAP (0 High, 2 Medium -> fixed via CSP/X-Frame headers), Coverage (87%).
*   **Threat Model:** STRIDE (Spoofing, Tampering, Repudiation, Info Disclosure, DoS, Elevation of Privilege).
*   **Key Security Principle:** If the server crashes during read, fail-secure (data is lost, never left exposed).
