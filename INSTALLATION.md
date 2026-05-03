# BurnVault Installation & Deployment Guide

## System Requirements

### Minimum
- **OS**: Linux (Ubuntu 20.04+), macOS (10.15+), or Windows with WSL2
- **CPU**: 2 cores
- **RAM**: 4GB
- **Storage**: 10GB

### Recommended for Production
- **CPU**: 4+ cores
- **RAM**: 8GB+
- **Storage**: 50GB+ (SSD recommended)
- **Network**: 1Gbps connection

## Software Prerequisites

```bash
# Check versions
python3 --version        # Should be 3.11 or higher
pip --version
postgres --version       # Should be 13 or higher
redis-server --version   # Should be 7.0 or higher
```

## Installation Methods

## Method 1: Traditional Setup (Recommended for Development)

### Step 1: Clone Repository

```bash
git clone https://github.com/burnvault/burnvault.git
cd burnvault
```

### Step 2: Backend Setup

```bash
cd backend

# Create Python virtual environment
python3 -m venv venv

# Activate virtual environment
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
```

### Step 3: Database Setup

```bash
# Create database (if using PostgreSQL)
createdb burnvault_db

# Or with psql:
psql -U postgres
CREATE DATABASE burnvault_db;
\q
```

### Step 4: Environment Configuration

```bash
# Copy environment template
cp .env.example .env

# Edit .env with your settings
nano .env
```

**Important settings to update:**

```env
DEBUG=False                    # Set to False for production
SECRET_KEY=your-super-secret-key-here

DB_NAME=burnvault_db
DB_USER=postgres
DB_PASSWORD=your_secure_password
DB_HOST=localhost
DB_PORT=5432

REDIS_HOST=localhost
REDIS_PORT=6379

ALLOWED_HOSTS=localhost,127.0.0.1,yourdomain.com
CORS_ALLOWED_ORIGINS=http://localhost:8000
```

### Step 5: Run Migrations

```bash
python manage.py migrate
```

### Step 6: Create Superuser (Optional)

```bash
python manage.py createsuperuser
```

### Step 7: Collect Static Files

```bash
python manage.py collectstatic --noinput
```

### Step 8: Start Services

**Terminal 1 - Django Development Server:**

```bash
cd backend
source venv/bin/activate
python manage.py runserver 0.0.0.0:8000
```

**Terminal 2 - Redis Server:**

```bash
redis-server
```

**Terminal 3 - Celery Worker (Optional):**

```bash
cd backend
source venv/bin/activate
celery -A burnvault_project worker -l info
```

Access application at: `http://localhost:8000`

---

## Method 2: Docker Setup (Recommended for Production)

### Prerequisites

```bash
docker --version         # Should be 20.10+
docker-compose --version # Should be 1.29+
```

### Step 1: Build and Start Containers

```bash
# From project root
docker-compose up --build
```

### Step 2: Run Initial Setup

```bash
# In another terminal
docker-compose exec django python manage.py migrate
docker-compose exec django python manage.py createsuperuser
```

### Step 3: Access Application

```
Web: http://localhost:8000
Admin: http://localhost:8000/admin/
```

### Useful Docker Commands

```bash
# View logs
docker-compose logs -f django

# Stop containers
docker-compose down

# Remove volumes (careful - deletes data)
docker-compose down -v

# Rebuild after code changes
docker-compose up --build

# Run shell in container
docker-compose exec django python manage.py shell
```

---

## Method 3: Production Deployment (Nginx + Gunicorn + Systemd)

### Step 1: Install System Dependencies

```bash
sudo apt update
sudo apt install -y python3.11 python3.11-venv python3.11-dev \
    postgresql postgresql-contrib redis-server nginx supervisor
```

### Step 2: Create Application User

```bash
sudo useradd -m -s /bin/bash burnvault
sudo su - burnvault
```

### Step 3: Setup Application

```bash
git clone https://github.com/burnvault/burnvault.git
cd burnvault/backend
python3.11 -m venv venv
source venv/bin/activate

cp .env.example .env
# Edit .env with production settings
nano .env

pip install -r requirements.txt
python manage.py migrate
python manage.py collectstatic --noinput
```

### Step 4: Create Systemd Services

**Django Service** (`/etc/systemd/system/burnvault-django.service`):

```ini
[Unit]
Description=BurnVault Django Application
After=network.target postgresql.service redis.service

[Service]
Type=notify
User=burnvault
Group=www-data
WorkingDirectory=/home/burnvault/burnvault/backend
Environment="PATH=/home/burnvault/burnvault/backend/venv/bin"
ExecStart=/home/burnvault/burnvault/backend/venv/bin/daphne \
    -b 127.0.0.1 -p 8000 burnvault_project.asgi:application
Restart=on-failure

[Install]
WantedBy=multi-user.target
```

**Enable and start:**

```bash
sudo systemctl enable burnvault-django
sudo systemctl start burnvault-django
sudo systemctl status burnvault-django
```

### Step 5: Configure Nginx Reverse Proxy

**`/etc/nginx/sites-available/burnvault`:**

```nginx
upstream daphne {
    server 127.0.0.1:8000;
}

server {
    listen 80;
    server_name yourdomain.com;

    # Redirect to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "DENY" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    client_max_body_size 100M;

    location / {
        proxy_pass http://daphne;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_redirect off;
    }

    location /static/ {
        alias /home/burnvault/burnvault/frontend/static/;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }

    location /ws/ {
        proxy_pass http://daphne;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_read_timeout 86400;
    }
}
```

**Enable site:**

```bash
sudo ln -s /etc/nginx/sites-available/burnvault /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### Step 6: Configure SSL (Let's Encrypt)

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot certonly --nginx -d yourdomain.com
```

### Step 7: Configure PostgreSQL

```bash
sudo -u postgres psql

CREATE USER burnvault WITH PASSWORD 'secure_password';
CREATE DATABASE burnvault_db OWNER burnvault;
GRANT ALL PRIVILEGES ON DATABASE burnvault_db TO burnvault;
\q
```

### Step 8: Configure Redis

```bash
# Secure Redis (if needed)
sudo nano /etc/redis/redis.conf
# Add: requirepass your_redis_password

sudo systemctl restart redis-server
```

### Step 9: Update .env for Production

```env
DEBUG=False
SECURE_SSL_REDIRECT=True
SESSION_COOKIE_SECURE=True
CSRF_COOKIE_SECURE=True
ALLOWED_HOSTS=yourdomain.com,www.yourdomain.com
CORS_ALLOWED_ORIGINS=https://yourdomain.com
```

### Step 10: Verify Services

```bash
sudo systemctl status burnvault-django
sudo systemctl status postgresql
sudo systemctl status redis-server
sudo systemctl status nginx
```

---

## Step 11: Backup Strategy

### Database Backups

```bash
# Automated daily backup
sudo tee /usr/local/bin/backup-burnvault.sh << EOF
#!/bin/bash
BACKUP_DIR="/backups/burnvault"
DATE=\$(date +%Y%m%d_%H%M%S)
pg_dump -U burnvault burnvault_db | gzip > \$BACKUP_DIR/db_\$DATE.sql.gz
find \$BACKUP_DIR -name "*.gz" -mtime +30 -delete
EOF

sudo chmod +x /usr/local/bin/backup-burnvault.sh

# Add to crontab
sudo crontab -e
# Add: 0 2 * * * /usr/local/bin/backup-burnvault.sh
```

### Encrypted Backups

```bash
# Backup with encryption
tar czf - /home/burnvault/burnvault | \
    gpg --symmetric --cipher-algo AES256 > burnvault_backup.tar.gz.gpg
```

---

## Troubleshooting

### Port Already in Use

```bash
# Find process using port 8000
sudo lsof -i :8000
# Kill process
sudo kill -9 <PID>
```

### Database Connection Error

```bash
# Check PostgreSQL status
sudo systemctl status postgresql
psql -U burnvault -d burnvault_db -c "SELECT 1;"
```

### WebSocket Connection Fails

```bash
# Check Redis
redis-cli ping
# Expected: PONG

# Check Daphne logs
sudo journalctl -u burnvault-django -f
```

### Static Files Not Loading

```bash
cd /home/burnvault/burnvault/backend
source venv/bin/activate
python manage.py collectstatic --clear --noinput
sudo systemctl reload nginx
```

### Permission Denied

```bash
sudo chown -R burnvault:www-data /home/burnvault/burnvault
sudo chmod -R 755 /home/burnvault/burnvault
```

---

## Monitoring

### Application Health Check

```bash
# Add health check endpoint monitoring
curl http://localhost:8000/health/
```

### System Monitoring

```bash
# CPU and Memory
top -b -n 1 | head -20

# Disk Space
df -h

# Network Connections
netstat -tulpn | grep 8000
```

### Log Monitoring

```bash
# Django logs
tail -f /var/log/burnvault/django.log

# Nginx logs
tail -f /var/log/nginx/access.log
tail -f /var/log/nginx/error.log

# PostgreSQL logs
tail -f /var/log/postgresql/postgresql.log
```

---

## Security Checklist

- [ ] Change default Django `SECRET_KEY`
- [ ] Set `DEBUG = False` in production
- [ ] Configure HTTPS with valid SSL certificate
- [ ] Update `ALLOWED_HOSTS` and `CORS_ALLOWED_ORIGINS`
- [ ] Configure strong database password
- [ ] Enable PostgreSQL authentication
- [ ] Secure Redis with password
- [ ] Configure firewall rules
- [ ] Set up automated backups
- [ ] Configure monitoring and alerts
- [ ] Implement rate limiting
- [ ] Review and update security headers
- [ ] Regular security audits
- [ ] Keep dependencies updated

---

## Performance Optimization

### Caching

```python
# In settings.py
CACHES = {
    'default': {
        'BACKEND': 'django_redis.cache.RedisCache',
        'LOCATION': 'redis://127.0.0.1:6379/1',
    }
}
```

### Database Indexing

```bash
# Create indexes for frequently queried fields
python manage.py sqlsequencereset communication | python manage.py dbshell
```

### Static File Compression

```bash
# Enable in settings.py
STATICFILES_STORAGE = 'whitenoise.storage.CompressedManifestStaticFilesStorage'
```

---

## Maintenance

### Regular Updates

```bash
# Check for security updates
pip list --outdated

# Update dependencies safely
pip install --upgrade pip setuptools wheel
pip install -r requirements.txt --upgrade
```

### Database Cleanup

```bash
# Remove expired messages and files
python manage.py shell
>>> from communication.models import Message, FileTransfer
>>> from django.utils import timezone
>>> Message.objects.filter(expires_at__lt=timezone.now()).delete()
```

---

## Support & Community

- **Documentation**: See README.md
- **Security**: See SECURITY.md
- **API Reference**: See API.md
- **Issues**: GitHub Issues

---

**Version**: 1.0.0
**Last Updated**: January 2024
