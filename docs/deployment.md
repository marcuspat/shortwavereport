# Deployment Guide

## Overview

This guide covers multiple deployment scenarios for the Shortwave Monitor system, from local development to production environments.

## Prerequisites

### System Requirements

**Minimum**:
- CPU: 2 cores
- RAM: 4GB
- Storage: 10GB free space
- Network: Broadband internet connection

**Recommended**:
- CPU: 4+ cores
- RAM: 8GB+
- Storage: 50GB+ SSD
- Network: High-speed internet with low latency

### Software Dependencies

- **Node.js**: 18.0.0 or higher
- **npm**: 9.0.0 or higher
- **FFmpeg**: Latest stable version
- **Git**: For source code management

## Local Development Setup

### 1. Install Dependencies

#### Ubuntu/Debian
```bash
# Update package list
sudo apt update

# Install Node.js and npm
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install FFmpeg
sudo apt-get install -y ffmpeg

# Install Git
sudo apt-get install -y git
```

#### macOS
```bash
# Install Homebrew if not installed
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Install Node.js
brew install node@18

# Install FFmpeg
brew install ffmpeg

# Install Git
brew install git
```

#### Windows
```powershell
# Install using Chocolatey
choco install nodejs.install --version=18.17.0
choco install ffmpeg
choco install git

# Or download installers manually:
# Node.js: https://nodejs.org/
# FFmpeg: https://ffmpeg.org/download.html
# Git: https://git-scm.com/download/win
```

### 2. Clone and Setup

```bash
# Clone repository
git clone <repository-url>
cd shortwavereport

# Install project dependencies
npm install

# Verify installation
node --version  # Should show v18+
npm --version   # Should show v9+
ffmpeg -version # Should show FFmpeg info
```

### 3. Configuration

Create environment configuration:

```bash
# Copy example configuration
cp config/config.example.js config/config.js

# Edit configuration as needed
nano config/config.js
```

#### Configuration Options

```javascript
// config/config.js
export default {
  // Server settings
  port: 3000,
  host: 'localhost',
  
  // Audio capture settings
  capture: {
    duration: 60,        // seconds
    sampleRate: 44100,   // Hz
    channels: 1,         // mono
    format: 'wav'
  },
  
  // SDR discovery settings
  discovery: {
    timeout: 30000,      // ms
    maxRetries: 3,
    qualityThreshold: 0.5
  },
  
  // Analysis settings
  analysis: {
    enableSTT: true,
    enableLanguageDetection: true,
    enableCallsignExtraction: true,
    confidenceThreshold: 0.6
  },
  
  // Memory settings
  memory: {
    baseDir: './memory',
    timeout: 30000,      // ms
    encryption: false
  },
  
  // Logging settings
  logging: {
    level: 'info',       // debug, info, warn, error
    file: './logs/app.log',
    console: true
  }
}
```

### 4. Run Development Server

```bash
# Run with demo data (recommended for testing)
npm run demo

# Run full system
npm start

# Run with debug logging
DEBUG=* npm start

# Run specific components
npm run test:discovery
npm run test:capture
npm run test:analysis
```

## Docker Deployment

### 1. Docker Setup

#### Dockerfile
```dockerfile
FROM node:18-alpine

# Install FFmpeg
RUN apk add --no-cache ffmpeg

# Create app directory
WORKDIR /usr/src/app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY . .

# Create necessary directories
RUN mkdir -p memory data logs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1

# Run application
CMD ["npm", "start"]
```

#### docker-compose.yml
```yaml
version: '3.8'

services:
  shortwave-monitor:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - LOG_LEVEL=info
    volumes:
      - ./data:/usr/src/app/data
      - ./logs:/usr/src/app/logs
      - ./memory:/usr/src/app/memory
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 60s

  # Optional: Add monitoring
  prometheus:
    image: prom/prometheus
    ports:
      - "9090:9090"
    volumes:
      - ./monitoring/prometheus.yml:/etc/prometheus/prometheus.yml
    restart: unless-stopped

  grafana:
    image: grafana/grafana
    ports:
      - "3001:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
    volumes:
      - grafana-storage:/var/lib/grafana
    restart: unless-stopped

volumes:
  grafana-storage:
```

### 2. Build and Run

```bash
# Build Docker image
docker build -t shortwave-monitor .

# Run with Docker Compose
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

### 3. Docker Environment Variables

```bash
# .env file for Docker Compose
NODE_ENV=production
LOG_LEVEL=info
PORT=3000
CAPTURE_DURATION=60
SDR_TIMEOUT=30000
ANALYSIS_CONFIDENCE_THRESHOLD=0.6
MEMORY_ENCRYPTION=false
```

## Production Deployment

### 1. Server Preparation

#### Ubuntu 22.04 LTS Setup
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install required packages
sudo apt install -y curl wget gnupg2 software-properties-common

# Install Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install FFmpeg
sudo apt install -y ffmpeg

# Install PM2 for process management
sudo npm install -g pm2

# Create application user
sudo useradd -m -s /bin/bash shortwave
sudo usermod -aG sudo shortwave
```

#### Security Hardening
```bash
# Configure firewall
sudo ufw allow ssh
sudo ufw allow 3000/tcp
sudo ufw --force enable

# Configure fail2ban
sudo apt install -y fail2ban
sudo systemctl enable fail2ban
sudo systemctl start fail2ban

# Set up SSL certificate (if using HTTPS)
sudo apt install -y certbot
sudo certbot certonly --standalone -d your-domain.com
```

### 2. Application Deployment

```bash
# Switch to application user
sudo su - shortwave

# Clone repository
git clone <repository-url> /home/shortwave/shortwavereport
cd /home/shortwave/shortwavereport

# Install dependencies
npm ci --only=production

# Create production configuration
cp config/config.example.js config/config.production.js
nano config/config.production.js

# Set up directories
mkdir -p logs memory data
chmod 755 logs memory data

# Set environment
export NODE_ENV=production
```

#### Production Configuration
```javascript
// config/config.production.js
export default {
  port: 3000,
  host: '0.0.0.0',
  
  // Production optimizations
  capture: {
    duration: 30,          // Shorter captures
    maxConcurrent: 4,      // Limit concurrent captures
    cleanup: true          // Auto-cleanup old files
  },
  
  // Enhanced security
  security: {
    enableCORS: true,
    allowedOrigins: ['https://your-domain.com'],
    enableRateLimit: true,
    maxRequestsPerMinute: 60
  },
  
  // Performance tuning
  performance: {
    enableCaching: true,
    cacheTimeout: 300000,  // 5 minutes
    maxMemoryUsage: '2GB'
  },
  
  // Logging for production
  logging: {
    level: 'warn',
    file: './logs/production.log',
    rotation: {
      maxSize: '100MB',
      maxFiles: 10
    }
  }
}
```

### 3. Process Management with PM2

#### PM2 Configuration
```javascript
// ecosystem.config.js
module.exports = {
  apps: [{
    name: 'shortwave-monitor',
    script: 'src/main.js',
    cwd: '/home/shortwave/shortwavereport',
    instances: 1,
    exec_mode: 'fork',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    log_file: './logs/pm2.log',
    error_file: './logs/pm2-error.log',
    out_file: './logs/pm2-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    max_memory_restart: '2G',
    restart_delay: 5000,
    max_restarts: 10,
    min_uptime: '10s'
  }]
}
```

#### PM2 Commands
```bash
# Start application
pm2 start ecosystem.config.js

# Monitor application
pm2 monit

# View logs
pm2 logs shortwave-monitor

# Restart application
pm2 restart shortwave-monitor

# Save PM2 configuration
pm2 save

# Setup PM2 startup
pm2 startup
sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u shortwave --hp /home/shortwave
```

### 4. Reverse Proxy with Nginx

#### Nginx Configuration
```nginx
# /etc/nginx/sites-available/shortwave-monitor
server {
    listen 80;
    server_name your-domain.com;
    
    # Redirect to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;
    
    # SSL Configuration
    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES128-GCM-SHA256:ECDHE-RSA-AES256-GCM-SHA384;
    
    # Security headers
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains";
    
    # Gzip compression
    gzip on;
    gzip_types text/plain application/json application/javascript text/css;
    
    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/m;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
    
    location /api/ {
        limit_req zone=api burst=20 nodelay;
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    
    location /data/audio/ {
        limit_req zone=api burst=5 nodelay;
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Cache audio files
        proxy_cache_valid 200 1h;
        add_header X-Cache-Status $upstream_cache_status;
    }
}
```

#### Enable Nginx Configuration
```bash
# Enable site
sudo ln -s /etc/nginx/sites-available/shortwave-monitor /etc/nginx/sites-enabled/

# Test configuration
sudo nginx -t

# Reload Nginx
sudo systemctl reload nginx
```

### 5. Monitoring and Logging

#### Log Rotation
```bash
# /etc/logrotate.d/shortwave-monitor
/home/shortwave/shortwavereport/logs/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    copytruncate
    postrotate
        pm2 reloadLogs
    endscript
}
```

#### System Monitoring
```bash
# Install monitoring tools
sudo apt install -y htop iotop nethogs

# Create monitoring script
cat << 'EOF' > /home/shortwave/monitor.sh
#!/bin/bash
# System monitoring for Shortwave Monitor

echo "=== System Resources ==="
free -h
df -h /
echo ""

echo "=== Application Status ==="
pm2 status
echo ""

echo "=== Network Connections ==="
netstat -tlnp | grep :3000
echo ""

echo "=== Recent Logs ==="
tail -n 20 /home/shortwave/shortwavereport/logs/production.log
EOF

chmod +x /home/shortwave/monitor.sh
```

## Cloud Deployment

### AWS EC2 Deployment

#### 1. Launch EC2 Instance
```bash
# Launch Ubuntu 22.04 LTS instance
# t3.medium or larger recommended
# Security group: Allow SSH (22), HTTP (80), HTTPS (443), App (3000)
```

#### 2. User Data Script
```bash
#!/bin/bash
# AWS EC2 User Data Script

# Update system
apt update && apt upgrade -y

# Install dependencies
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt-get install -y nodejs ffmpeg git nginx certbot python3-certbot-nginx

# Install PM2
npm install -g pm2

# Create application user
useradd -m -s /bin/bash shortwave
usermod -aG sudo shortwave

# Clone and setup application
su - shortwave -c "
git clone <repository-url> /home/shortwave/shortwavereport
cd /home/shortwave/shortwavereport
npm ci --only=production
mkdir -p logs memory data
cp config/config.example.js config/config.production.js
"

# Setup PM2
su - shortwave -c "
cd /home/shortwave/shortwavereport
pm2 start ecosystem.config.js
pm2 save
"

# Setup PM2 startup
pm2 startup systemd -u shortwave --hp /home/shortwave

# Configure Nginx (basic)
systemctl enable nginx
systemctl start nginx
```

### Google Cloud Platform Deployment

#### Cloud Run Deployment
```yaml
# cloudbuild.yaml
steps:
  - name: 'gcr.io/cloud-builders/docker'
    args: ['build', '-t', 'gcr.io/$PROJECT_ID/shortwave-monitor', '.']
  - name: 'gcr.io/cloud-builders/docker'
    args: ['push', 'gcr.io/$PROJECT_ID/shortwave-monitor']
  - name: 'gcr.io/cloud-builders/gcloud'
    args: [
      'run', 'deploy', 'shortwave-monitor',
      '--image', 'gcr.io/$PROJECT_ID/shortwave-monitor',
      '--platform', 'managed',
      '--region', 'us-central1',
      '--memory', '2Gi',
      '--cpu', '2',
      '--timeout', '3600',
      '--allow-unauthenticated'
    ]
```

### Digital Ocean App Platform

#### app.yaml
```yaml
name: shortwave-monitor
services:
- name: web
  source_dir: /
  github:
    repo: your-username/shortwavereport
    branch: main
  run_command: npm start
  environment_slug: node-js
  instance_count: 1
  instance_size_slug: basic-s
  envs:
  - key: NODE_ENV
    value: production
  - key: PORT
    value: "3000"
  http_port: 3000
  routes:
  - path: /
```

## Backup and Recovery

### Database Backup
```bash
#!/bin/bash
# backup.sh

BACKUP_DIR="/backup/shortwave-monitor"
DATE=$(date +%Y%m%d_%H%M%S)

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Backup memory data
tar -czf "$BACKUP_DIR/memory_$DATE.tar.gz" /home/shortwave/shortwavereport/memory/

# Backup logs
tar -czf "$BACKUP_DIR/logs_$DATE.tar.gz" /home/shortwave/shortwavereport/logs/

# Backup configuration
cp /home/shortwave/shortwavereport/config/config.production.js "$BACKUP_DIR/config_$DATE.js"

# Cleanup old backups (keep 30 days)
find "$BACKUP_DIR" -name "*.tar.gz" -mtime +30 -delete
find "$BACKUP_DIR" -name "*.js" -mtime +30 -delete

echo "Backup completed: $DATE"
```

### Automated Backup with Cron
```bash
# Add to crontab
0 2 * * * /home/shortwave/backup.sh >> /home/shortwave/backup.log 2>&1
```

## Troubleshooting Deployment

### Common Issues

1. **Port Already in Use**
   ```bash
   # Find process using port 3000
   sudo lsof -i :3000
   
   # Kill process if needed
   sudo kill -9 <PID>
   ```

2. **FFmpeg Not Found**
   ```bash
   # Verify FFmpeg installation
   which ffmpeg
   ffmpeg -version
   
   # Install if missing
   sudo apt install -y ffmpeg
   ```

3. **Permission Denied**
   ```bash
   # Fix file permissions
   sudo chown -R shortwave:shortwave /home/shortwave/shortwavereport
   chmod -R 755 /home/shortwave/shortwavereport
   ```

4. **Memory Issues**
   ```bash
   # Check memory usage
   free -h
   
   # Restart PM2 processes
   pm2 restart all
   ```

### Health Checks

```bash
# Check application health
curl -f http://localhost:3000/api/health

# Check system resources
htop

# Check application logs
pm2 logs --lines 50

# Check network connectivity
ping -c 4 google.com
```