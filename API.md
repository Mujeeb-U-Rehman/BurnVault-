# BurnVault API Documentation

## Base URL

```
HTTP: http://localhost:8000/api
WebSocket: ws://localhost:8000/ws/messages/
```

## Authentication

All API requests (except registration and login) require JWT Bearer token:

```
Authorization: Bearer <access_token>
```

## Endpoints

### Authentication

#### Register User

```http
POST /api/register/
Content-Type: application/json

{
    "username": "alice",
    "email": "alice@example.com",
    "password": "SecurePassword123!",
    "public_key": "{...jwk_format...}"
}

Response 201:
{
    "message": "User registered successfully",
    "user_id": 123
}
```

#### Obtain Token

```http
POST /api/token/
Content-Type: application/json

{
    "username": "alice",
    "password": "SecurePassword123!"
}

Response 200:
{
    "access": "eyJ0eXAiOiJKV1QiLCJhbGc...",
    "refresh": "eyJ0eXAiOiJKV1QiLCJhbGc...",
    "user_id": 123,
    "username": "alice"
}
```

#### Refresh Token

```http
POST /api/token/refresh/
Content-Type: application/json

{
    "refresh": "eyJ0eXAiOiJKV1QiLCJhbGc..."
}

Response 200:
{
    "access": "eyJ0eXAiOiJKV1QiLCJhbGc..."
}
```

### User Profile

#### Get Current Profile

```http
GET /api/profile/me/
Authorization: Bearer <access_token>

Response 200:
{
    "user": {
        "id": 123,
        "username": "alice",
        "email": "alice@example.com"
    },
    "public_key": "{...jwk_format...}",
    "created_at": "2024-01-15T10:30:00Z",
    "updated_at": "2024-01-15T10:30:00Z"
}
```

#### Search Users

```http
GET /api/profile/search/?q=bob
Authorization: Bearer <access_token>

Response 200:
[
    {
        "id": 124,
        "username": "bob",
        "email": "bob@example.com"
    },
    {
        "id": 125,
        "username": "bobby",
        "email": "bobby@example.com"
    }
]
```

### Messages

#### Send Message

```http
POST /api/messages/
Authorization: Bearer <access_token>
Content-Type: application/json

{
    "recipient": 124,
    "encrypted_content": "a1b2c3d4e5f6...",
    "encrypted_key": "f6e5d4c3b2a1...",
    "iv": "0f1e2d3c4b5a6978"
}

Response 201:
{
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "sender": 123,
    "sender_username": "alice",
    "recipient": 124,
    "recipient_username": "bob",
    "encrypted_content": "a1b2c3d4e5f6...",
    "encrypted_key": "f6e5d4c3b2a1...",
    "iv": "0f1e2d3c4b5a6978",
    "is_read": false,
    "created_at": "2024-01-15T10:30:00Z",
    "expires_at": "2024-01-15T11:30:00Z"
}
```

#### List Received Messages

```http
GET /api/messages/
Authorization: Bearer <access_token>

Response 200:
[
    {
        "id": "550e8400-e29b-41d4-a716-446655440000",
        "sender": 123,
        "sender_username": "alice",
        "recipient": 124,
        "recipient_username": "bob",
        "encrypted_content": "a1b2c3d4e5f6...",
        "encrypted_key": "f6e5d4c3b2a1...",
        "iv": "0f1e2d3c4b5a6978",
        "is_read": false,
        "created_at": "2024-01-15T10:30:00Z",
        "expires_at": "2024-01-15T11:30:00Z"
    }
]
```

#### Mark Message as Read (Auto-Deletes)

```http
POST /api/messages/550e8400-e29b-41d4-a716-446655440000/mark_as_read/
Authorization: Bearer <access_token>

Response 200:
{
    "message": "Message read and deleted"
}
```

### Files

#### Send File

```http
POST /api/files/
Authorization: Bearer <access_token>
Content-Type: multipart/form-data

recipient: 124
file_name: document.pdf
file: <binary_encrypted_file>
encrypted_key: "f6e5d4c3b2a1..."
iv: "0f1e2d3c4b5a6978"

Response 201:
{
    "id": "550e8400-e29b-41d4-a716-446655440001",
    "sender": 123,
    "sender_username": "alice",
    "recipient": 124,
    "recipient_username": "bob",
    "file_name": "document.pdf",
    "file_size": 1024,
    "encrypted_key": "f6e5d4c3b2a1...",
    "iv": "0f1e2d3c4b5a6978",
    "is_downloaded": false,
    "created_at": "2024-01-15T10:30:00Z",
    "expires_at": "2024-01-16T10:30:00Z"
}
```

#### List Received Files

```http
GET /api/files/
Authorization: Bearer <access_token>

Response 200:
[
    {
        "id": "550e8400-e29b-41d4-a716-446655440001",
        "sender": 123,
        "sender_username": "alice",
        "recipient": 124,
        "recipient_username": "bob",
        "file_name": "document.pdf",
        "file_size": 1024,
        "encrypted_key": "f6e5d4c3b2a1...",
        "iv": "0f1e2d3c4b5a6978",
        "is_downloaded": false,
        "created_at": "2024-01-15T10:30:00Z",
        "expires_at": "2024-01-16T10:30:00Z"
    }
]
```

#### Download File (Auto-Deletes)

```http
GET /api/files/550e8400-e29b-41d4-a716-446655440001/download/
Authorization: Bearer <access_token>

Response 200:
{
    "id": "550e8400-e29b-41d4-a716-446655440001",
    "file_name": "document.pdf",
    "encrypted_file": "a1b2c3d4e5f6...",
    "encrypted_key": "f6e5d4c3b2a1...",
    "iv": "0f1e2d3c4b5a6978"
}
```

### Contacts

#### List Contacts

```http
GET /api/contacts/
Authorization: Bearer <access_token>

Response 200:
[
    {
        "id": 1,
        "contact_user": 124,
        "contact_user_username": "bob",
        "encrypted_shared_secret": "e5f6g7h8i9j0..."
    }
]
```

#### Add Contact

```http
POST /api/contacts/
Authorization: Bearer <access_token>
Content-Type: application/json

{
    "contact_user": 124,
    "encrypted_shared_secret": "e5f6g7h8i9j0..."
}

Response 201:
{
    "id": 1,
    "contact_user": 124,
    "contact_user_username": "bob",
    "encrypted_shared_secret": "e5f6g7h8i9j0..."
}
```

## WebSocket Events

### Connection

```javascript
// Connect
const ws = new WebSocket('ws://localhost:8000/ws/messages/');

// Connection established
ws.onopen = () => {
    console.log('Connected to BurnVault');
};
```

### Send Message via WebSocket

```javascript
ws.send(JSON.stringify({
    type: 'encrypt_message',
    recipient_id: 124,
    encrypted_content: 'a1b2c3d4e5f6...',
    encrypted_key: 'f6e5d4c3b2a1...',
    iv: '0f1e2d3c4b5a6978',
    timestamp: new Date().toISOString()
}));
```

### Receive Message Event

```javascript
ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    
    if (data.type === 'message_received') {
        console.log('From:', data.sender_username);
        console.log('Encrypted:', data.encrypted_content);
        console.log('Encrypted Key:', data.encrypted_key);
        console.log('IV:', data.iv);
    }
};

// Output:
{
    type: 'message_received',
    sender_id: 123,
    sender_username: 'alice',
    encrypted_content: 'a1b2c3d4e5f6...',
    encrypted_key: 'f6e5d4c3b2a1...',
    iv: '0f1e2d3c4b5a6978',
    timestamp: '2024-01-15T10:30:00Z'
}
```

### Send File Metadata

```javascript
ws.send(JSON.stringify({
    type: 'encrypt_file',
    recipient_id: 124,
    file_name: 'document.pdf',
    file_size: 1024,
    encrypted_key: 'f6e5d4c3b2a1...',
    iv: '0f1e2d3c4b5a6978',
    timestamp: new Date().toISOString()
}));
```

### Receive File Notification

```javascript
// Output:
{
    type: 'file_received',
    sender_id: 123,
    sender_username: 'alice',
    file_name: 'document.pdf',
    file_size: 1024,
    encrypted_key: 'f6e5d4c3b2a1...',
    iv: '0f1e2d3c4b5a6978',
    timestamp: '2024-01-15T10:30:00Z'
}
```

### Key Exchange

```javascript
ws.send(JSON.stringify({
    type: 'key_exchange',
    recipient_id: 124,
    public_key: '{...jwk_format...}',
    encrypted_shared_secret: 'secret_encrypted_with_recipient_pub_key'
}));

// Receive:
{
    type: 'key_exchange_received',
    sender_id: 123,
    sender_username: 'alice',
    public_key: '{...jwk_format...}',
    encrypted_shared_secret: 'secret_encrypted_with_my_pub_key'
}
```

## Error Responses

### 400 Bad Request

```json
{
    "error": "Missing required fields"
}
```

### 401 Unauthorized

```json
{
    "detail": "Unauthorized"
}
```

### 404 Not Found

```json
{
    "error": "Recipient not found"
}
```

### 500 Internal Server Error

```json
{
    "error": "Internal server error"
}
```

## Rate Limiting

- Login attempts: 5 per minute
- API calls: 100 per minute per user
- WebSocket messages: 50 per minute per user

## Pagination

List endpoints support pagination:

```
GET /api/messages/?page=1&page_size=20
```

---

**Last Updated**: January 2024
