# BurnVault Security Architecture

## Overview

BurnVault implements a zero-knowledge, end-to-end encrypted communication system where all sensitive operations occur client-side, and the server remains completely unaware of message content.

## Cryptographic Foundations

### 1. Symmetric Encryption: AES-256-GCM

**Purpose**: Message and file encryption

```
User A wants to send message to User B:

1. Client generates unique AES-256 key (K_msg)
2. Client encrypts message: C_msg = AES_GCM_encrypt(message, K_msg, random_IV)
3. Transmission: C_msg + IV (message sent)
4. Server stores: (C_msg, encrypted_key, IV) - cannot decrypt
```

**Why AES-GCM**:
- Authenticated encryption
- Built-in AEAD (Authenticated Encryption with Associated Data)
- Prevents tampering
- Provides IV for each encryption

### 2. Asymmetric Encryption: RSA-2048-OAEP

**Purpose**: Secure AES key delivery

```
User Registration:
1. Client generates RSA-2048 key pair (Pub_A, Priv_A)
2. Priv_A stored in browser memory only
3. Pub_A sent to server and stored

Message Sending:
1. Client retrieves recipient's public key (Pub_B)
2. Client encrypts AES key: E_key = RSA_OAEP_encrypt(K_msg, Pub_B)
3. Transmission: (C_msg, E_key, IV)
4. Only Recipient B (with Priv_B) can decrypt E_key
```

**Why RSA-OAEP**:
- Industry standard for key encryption
- OAEP provides semantic security
- 2048-bit provides > 112-bit symmetric strength

### 3. Key Exchange and Shared Secrets

**Purpose**: Establish secure communication channels

```
Initiator A → Recipient B:
1. A generates ephemeral DH parameters
2. A sends: {public_params, A's_ephemeral_pub_key}
3. B receives and generates own ephemeral key pair
4. B sends: {B's_ephemeral_pub_key}
5. Both derive shared secret: SS = ECDH(A_ephemeral_priv, B_ephemeral_pub)
6. Shared secret used for session communication

Shared Secret Encryption:
- SS protected: E_SS = RSA_OAEP_encrypt(SS, Pub_B)
- Only B can decrypt to recover shared secret
```

## Message Flow with Encryption

### Sending a Message

```
┌─────────────────────┐
│   User A (Client)   │
└──────────┬──────────┘
           │
           ├─→ Generate unique AES key (K_msg)
           │
           ├─→ Encrypt: C_msg = AES-GCM(plaintext, K_msg, random_IV)
           │
           ├─→ Retrieve User B's RSA public key (Pub_B)
           │
           ├─→ Encrypt key: E_key = RSA-OAEP(K_msg, Pub_B)
           │
           ├─→ Prepare payload: {
           │      encrypted_content: C_msg,
           │      encrypted_key: E_key,
           │      iv: IV,
           │      recipient_id: B_id,
           │      timestamp: now
           │    }
           │
           ├─→ Send via WebSocket or HTTPS API
           │
           ▼
┌─────────────────────┐
│   BurnVault Server  │
└──────────┬──────────┘
           │
           ├─→ Receive encrypted payload
           │
           ├─→ Verify recipient exists
           │
           ├─→ Relay via WebSocket to User B
           │   (Server CANNOT decrypt)
           │
           ├─→ Store in DB with expiry time
           │
           ▼
┌─────────────────────┐
│   User B (Client)   │
└──────────┬──────────┘
           │
           ├─→ Receive {C_msg, E_key, IV}
           │
           ├─→ Decrypt key: K_msg = RSA-OAEP_decrypt(E_key, Priv_B)
           │   (Only B has Priv_B)
           │
           ├─→ Decrypt message: plaintext = AES-GCM(C_msg, K_msg, IV)
           │
           ├─→ Display to User B
           │
           ├─→ Mark as read in API
           │
           ▼
       Message Deleted
     (Immediately from server)
```

## Ephemeral Storage Guarantee

### Deletion Triggers

```
1. Immediate Deletion:
   - After recipient marks as read
   - After recipient downloads file
   - Server-side deletion is irreversible

2. TTL-Based Deletion:
   - MESSAGE_EXPIRY_TIME: 1 hour (configurable)
   - FILE_EXPIRY_TIME: 24 hours (configurable)
   - Background task purges expired items

3. Data Structure:
   {
     id: UUID,
     sender_id: int,
     recipient_id: int,
     encrypted_content: bytes,  # Cannot be decrypted without key
     encrypted_key: bytes,       # Only recipient's RSA can decrypt
     iv: str,                    # Initialization vector
     is_read: boolean,
     created_at: datetime,
     expires_at: datetime,       # TTL marker
   }
```

### Deletion Implementation

```python
# Upon reading
message.delete()  # Physical deletion from database

# TTL-based
async def cleanup_expired_messages():
    expired = Message.objects.filter(expires_at__lt=now())
    for msg in expired:
        msg.delete()  # Irreversible
```

## Zero-Knowledge Guarantee

### What Server Knows

✓ User identities and public keys
✓ Timestamp of communication
✓ Message sender and recipient (metadata)
✓ Existence of encrypted payload
✗ Message content (encrypted)
✗ Private keys
✗ Encryption keys
✗ Shared secrets

### What Server Cannot Do

- Decrypt any message
- Recover any encryption key
- Impersonate users (private keys only in browser)
- Access past messages (auto-deleted)
- Perform known-plaintext attacks (unique key per message)
- Forge messages (would need recipient's private key)

## Session Management

### JWT Authentication

```
Login Flow:
1. User provides username/password
2. Server validates, returns JWT token
3. Client stores token in memory (or secure storage)
4. All API requests include: Authorization: Bearer <token>
5. Server validates JWT signature

Token Structure:
{
  "user_id": 123,
  "username": "alice",
  "iat": 1234567890,
  "exp": 1234571490,  # 1 hour expiry
  "aud": "burnvault"
}
```

### Refresh Token

```
Refresh Flow:
1. Access token expires
2. Client uses refresh token (7-day lifetime)
3. Server validates refresh token
4. New access token issued
5. No re-login required
```

## Attack Resistance

### 1. Replay Attacks
- ✓ Unique IV for each message
- ✓ Timestamp verification
- ✓ Unique AES key per message
- Message cannot be replayed (already deleted)

### 2. Man-in-the-Middle (MITM)
- ✓ HTTPS/WSS encryption layer
- ✓ RSA-OAEP key encryption
- ✓ Message authentication (AES-GCM)
- Server cannot decrypt even if intercepted

### 3. Dictionary/Brute Force
- ✓ AES-256 (2^256 possibilities)
- ✓ RSA-2048 (> 2^112 symmetric equivalent)
- ✓ Rate limiting on login attempts
- ✓ User account lockout

### 4. Side-Channel Attacks
- ✓ Constant-time comparisons for sensitive data
- ✓ Memory clearing after decryption
- ✓ No timing-based leaks

### 5. Metadata Leakage
- ✓ Message size: Consistent through padding (optional enhancement)
- ✓ Timing: Multiple messages in batch
- ✓ Frequency: Cannot determine from encrypted data

## Future Enhancements

1. **Perfect Forward Secrecy (PFS)**
   - Ephemeral DH for each message
   - Even if private key compromised, past messages safe

2. **Multi-Device Support**
   - Key hierarchy for device management
   - Cross-device encryption

3. **Group Messaging**
   - Recipient list encryption
   - Group key exchange protocol

4. **Message Signatures**
   - Sender authentication
   - Non-repudiation

5. **Sealed References**
   - Encrypted references between messages
   - Conversation threading

## Compliance

- **GDPR**: No user data stored after deletion
- **HIPAA**: End-to-end encryption for healthcare
- **SOC 2**: Security controls and monitoring
- **CCPA**: User data control and deletion

## References

- NIST Special Publications on Cryptography
- RFC 3394 (AES Key Wrap)
- RFC 2104 (HMAC)
- Web Crypto API Specification
- OWASP Security Guidelines

---

**BurnVault Security Team**

*This document serves as reference for security implementation. For production deployment, conduct independent security audit.*
