# BurnVault - Secure Communication Platform

Welcome to **BurnVault**, a highly secure, ephemeral communication platform designed for private conversations that automatically disappear after being read.

## 🔥 Features

- **Client-Side Encryption**: All messages and files are encrypted in the browser using AES-GCM before transmission
- **End-to-End Security**: RSA-OAEP public-key cryptography for secure key exchange
- **Zero-Knowledge Architecture**: The server never has access to plaintext data or private encryption keys
- **Ephemeral Storage**: Messages and files are automatically deleted immediately after being read/downloaded
- **Real-Time Communication**: WebSocket-based instant messaging and file transfers
- **JWT Authentication**: Secure user authentication with JWT tokens
- **Responsive UI**: Modern, dark-themed interface optimized for all devices

## 🏗️ Architecture

### Backend (Django)
- **Framework**: Django 4.2 with Django REST Framework
- **Real-Time**: Django Channels with WebSocket support
- **Database**: PostgreSQL for persistent storage
- **Message Queue**: Redis with Celery for background tasks
- **API**: RESTful API with JWT authentication

### Frontend (HTML/CSS/JavaScript)
- **Encryption**: Web Crypto API for AES-GCM and RSA operations
- **Communication**: WebSocket client for real-time messaging
- **UI**: Responsive CSS Grid layout with dark theme
- **Security**: Client-side encryption before any server transmission

## 📋 Prerequisites

- Python 3.11+
- PostgreSQL 13+
- Redis 7+
- Node.js 18+ (optional, for frontend tooling)
- Docker & Docker Compose (optional)

## 🚀 Quick Start

### 1. Clone and Setup

```bash
cd burnvault/backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Create .env file
cp .env.example .env

# Update .env with your settings
```

### 2. Database Setup

```bash
# Run migrations
python manage.py migrate

# Create superuser (optional, for admin panel)
python manage.py createsuperuser
```

### 3. Run Development Server

```bash
# Terminal 1: Start Django/Daphne server
python manage.py runserver

# Terminal 2: Start Redis (if not using Docker)
redis-server
```

Access the application at `http://localhost:8000`

### 4. Docker Setup (Alternative)

```bash
# From project root
docker-compose up --build

# In another terminal, run migrations
docker-compose exec django python manage.py migrate
```

## 🔐 Security Features Explained

### Client-Side Encryption

1. **Message Encryption**:
   - Generate unique AES-256-GCM key for each message
   - Encrypt message content with AES-GCM
   - Encrypt AES key with recipient's RSA public key
   - Transmit: encrypted content + encrypted key + IV

2. **Key Exchange**:
   - Each user generates RSA-2048 key pair on registration
   - Public keys are stored on server
   - Private keys stay in browser memory only
   - Shared secrets derived for contact communication

3. **File Transfer**:
   - Files encrypted with AES-GCM (same as messages)
   - Encrypted file stored on server temporarily
   - File deleted immediately after download

### Ephemeral Storage

- Messages expire after configured time (default: 1 hour)
- Files expire after configured time (default: 24 hours)
- Access triggers immediate deletion
- Background tasks clean up expired items

### Zero-Knowledge

- Server never decrypts user data
- Private keys never transmitted to server
- All cryptography happens client-side
- Server acts only as relay and storage

## 📚 API Endpoints

### Authentication
- `POST /api/register/` - Register new user
- `POST /api/token/` - Obtain JWT token
- `POST /api/token/refresh/` - Refresh token

### User Profile
- `GET /api/profile/me/` - Get current user profile
- `GET /api/profile/search/?q=username` - Search users

### Messages
- `POST /api/messages/` - Send encrypted message
- `GET /api/messages/` - List received messages
- `POST /api/messages/{id}/mark_as_read/` - Mark as read and delete

### Files
- `POST /api/files/` - Upload encrypted file
- `GET /api/files/` - List received files
- `GET /api/files/{id}/download/` - Download and delete file

### Contacts
- `GET /api/contacts/` - List contacts
- `POST /api/contacts/` - Add contact with shared secret

## 🔌 WebSocket Events

### Client → Server
- `encrypt_message` - Send encrypted message
- `encrypt_file` - Send file metadata
- `key_exchange` - Exchange keys with contact

### Server → Client
- `message_received` - Incoming encrypted message
- `file_received` - Incoming file notification
- `key_exchange_received` - Key exchange request

## ⚙️ Configuration

Edit `backend/.env` to customize:

```env
# Security
SECRET_KEY=your-super-secret-key
DEBUG=False  # Set to False in production

# Database
DB_NAME=burnvault_db
DB_USER=postgres
DB_PASSWORD=secure_password
DB_HOST=localhost

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# Expiry times (seconds)
MESSAGE_EXPIRY_TIME=3600      # 1 hour
FILE_EXPIRY_TIME=86400        # 24 hours

# Security settings (production)
SECURE_SSL_REDIRECT=True
SESSION_COOKIE_SECURE=True
CSRF_COOKIE_SECURE=True
```

## 🧪 Testing

```bash
# Run tests
python manage.py test

# Run with coverage
coverage run --source='.' manage.py test
coverage report
```

## 📊 Database Models

- **User**: Django user model
- **UserProfile**: Extended user profile with public key
- **Message**: Encrypted messages with expiry
- **FileTransfer**: Encrypted file transfers with expiry
- **Contact**: User contacts with shared secrets
- **SessionToken**: Temporary session tokens

## 🚨 Important Security Notes

1. **Private Keys**: Stored in browser memory only. Closing the browser clears them.
2. **HTTPS**: Always use HTTPS in production
3. **Secrets**: Change `SECRET_KEY` in production
4. **Database**: Use strong passwords for PostgreSQL
5. **Redis**: Secure Redis with password in production

## 🔄 Workflow Example

1. **User Registration**:
   - Generate RSA-2048 key pair
   - Register account with public key
   - Private key stays in browser

2. **Send Message**:
   - Generate unique AES key
   - Encrypt message with AES-GCM
   - Get recipient's public key
   - Encrypt AES key with recipient's public key
   - Send encrypted package to server
   - Server relays to recipient via WebSocket

3. **Receive Message**:
   - WebSocket notification arrives
   - Decrypt AES key using private key
   - Decrypt message using AES key
   - Display message
   - Message auto-deleted from server

4. **Auto-Delete**:
   - Message marked as read
   - Server deletes message immediately
   - No trace remains

## 🐛 Troubleshooting

### WebSocket Connection Fails
- Check Redis is running: `redis-cli ping`
- Verify `ALLOWED_HOSTS` in settings.py
- Check browser console for WebSocket errors

### Encryption Errors
- Ensure browser supports Web Crypto API
- Check private key is properly imported
- Verify IV and encrypted data format

### Database Errors
- Run migrations: `python manage.py migrate`
- Check PostgreSQL is running
- Verify `.env` database credentials

## 📝 License

This project is provided as-is for educational purposes.

## ⚠️ Disclaimer

This is a demonstration of secure communication principles. For production use:

1. Conduct thorough security audit
2. Implement proper key management
3. Add rate limiting and DDoS protection
4. Implement audit logging
5. Use professional security testing
6. Comply with data protection regulations

## 🤝 Contributing

Contributions are welcome! Please follow security best practices.

## 📧 Support

For issues and questions, please create an issue in the repository.

---

**Built with security as the foundation, privacy as the mission.**

🔥 BurnVault - Communications that disappear.
