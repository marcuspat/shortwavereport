# Shortwavereport Deployment Guide

This guide covers deployment options for the Shortwavereport system using Docker, Docker Compose, and CI/CD pipelines.

## Table of Contents

- [Quick Start](#quick-start)
- [Docker Deployment](#docker-deployment)
- [Docker Compose Deployment](#docker-compose-deployment)
- [Production Deployment](#production-deployment)
- [CI/CD Pipeline](#cicd-pipeline)
- [Monitoring Setup](#monitoring-setup)
- [Troubleshooting](#troubleshooting)

## Quick Start

### Prerequisites

- Docker 20.10+ and Docker Compose 2.0+
- Node.js 18+ (for local development)
- Git
- 4GB+ RAM, 20GB+ disk space

### Local Development

```bash
# Clone the repository
git clone <repository-url>
cd shortwavereport

# Copy environment file
cp .env.example .env.development

# Install dependencies
npm install

# Run in development mode
npm run dev
```

### Docker Quick Start

```bash
# Build and run with Docker Compose
docker-compose up -d

# Check status
docker-compose ps

# View logs
docker-compose logs -f shortwavereport

# Access the application
open http://localhost:3000
```

## Docker Deployment

### Building the Image

```bash
# Build production image
docker build -t shortwavereport:latest .

# Build with specific target
docker build --target production -t shortwavereport:prod .

# Build development image
docker build --target development -t shortwavereport:dev .
```

### Running Single Container

```bash
# Run production container
docker run -d \
  --name shortwavereport \
  -p 3000:3000 \
  -p 8080:8080 \
  -v $(pwd)/data:/app/data \
  -e NODE_ENV=production \
  shortwavereport:latest

# Run with environment file
docker run -d \
  --name shortwavereport \
  -p 3000:3000 \
  --env-file .env.production \
  shortwavereport:latest
```

## Docker Compose Deployment

### Development Environment

```bash
# Start development environment
docker-compose --profile development up -d

# This includes:
# - Application in development mode
# - Redis for caching
# - Prometheus for metrics
# - Grafana for monitoring
```

### Production Environment

```bash
# Start production environment
docker-compose --profile production up -d

# This includes:
# - Application in production mode
# - Redis for caching
# - Prometheus for metrics
# - Grafana for monitoring
# - Nginx reverse proxy
# - Node Exporter for system metrics
```

### Environment-Specific Configurations

```bash
# Production with custom compose file
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d

# Scaling the application
docker-compose up -d --scale shortwavereport=3
```

## Production Deployment

### Server Requirements

**Minimum Requirements:**
- 2 CPU cores
- 4GB RAM
- 20GB disk space
- Ubuntu 20.04+ or CentOS 8+

**Recommended Requirements:**
- 4+ CPU cores
- 8GB+ RAM
- 100GB+ SSD storage
- Load balancer for high availability

### Pre-deployment Setup

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Create application user
sudo useradd -m -s /bin/bash shortwavereport
sudo usermod -aG docker shortwavereport

# Create application directory
sudo mkdir -p /opt/shortwavereport
sudo chown shortwavereport:shortwavereport /opt/shortwavereport
```

### Production Deployment Steps

```bash
# Switch to application user
sudo su - shortwavereport

# Clone repository
cd /opt/shortwavereport
git clone <repository-url> .

# Configure environment
cp .env.example .env.production
# Edit .env.production with production values

# Create data directories
mkdir -p data/{audio,analysis,memory,reports}
mkdir -p logs

# Set proper permissions
chmod 755 data logs
chmod 644 .env.production

# Deploy using Docker Compose
docker-compose -f docker-compose.yml --profile production up -d

# Verify deployment
docker-compose ps
docker-compose logs -f
```

### SSL/TLS Configuration

#### Using Let's Encrypt with Certbot

```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx

# Generate SSL certificate
sudo certbot --nginx -d yourdomain.com

# Update nginx configuration
# Edit nginx/nginx.conf to enable SSL server block

# Restart nginx container
docker-compose restart nginx
```

#### Using Custom SSL Certificates

```bash
# Create SSL directory
mkdir -p nginx/ssl

# Copy certificates
cp your-cert.pem nginx/ssl/cert.pem
cp your-key.pem nginx/ssl/key.pem

# Set permissions
chmod 600 nginx/ssl/*.pem

# Update docker-compose.yml to mount SSL directory
# Restart services
docker-compose up -d
```

## CI/CD Pipeline

The project includes GitHub Actions workflows for automated CI/CD.

### GitHub Actions Setup

1. **Repository Secrets**
   ```
   GITHUB_TOKEN (automatically provided)
   SLACK_WEBHOOK_URL (for notifications)
   STAGING_URL (staging environment URL)
   PRODUCTION_URL (production environment URL)
   ```

2. **Environment Variables**
   ```
   STAGING_URL (in staging environment)
   PRODUCTION_URL (in production environment)
   ```

### Workflow Triggers

- **Continuous Integration**: Runs on push/PR to main/develop branches
- **Staging Deployment**: Automatic on push to develop branch
- **Production Deployment**: Automatic on release publication

### Pipeline Stages

1. **Test and Build**
   - Code linting and type checking
   - Unit and integration tests
   - Security audit
   - Multi-Node.js version testing

2. **Docker Build**
   - Multi-architecture builds (AMD64/ARM64)
   - Container security scanning
   - Image registry push

3. **Deployment**
   - Staging deployment (develop branch)
   - Production deployment (releases)
   - Health checks and smoke tests

### Manual Deployment

```bash
# Build and push manually
docker build -t ghcr.io/yourorg/shortwavereport:latest .
docker push ghcr.io/yourorg/shortwavereport:latest

# Deploy to production
docker-compose pull
docker-compose up -d
```

## Monitoring Setup

### Prometheus Configuration

The system includes pre-configured Prometheus monitoring:

- Application metrics: `http://localhost:9090`
- System metrics via Node Exporter
- Custom business metrics

### Grafana Dashboards

- Access: `http://localhost:3001`
- Default credentials: `admin` / `shortwavereport123`
- Pre-configured dashboards for system overview

### Health Monitoring

Built-in health check endpoints:

```bash
# Health check
curl http://localhost:3000/health

# Readiness check
curl http://localhost:3000/ready

# Liveness check
curl http://localhost:3000/live

# Metrics
curl http://localhost:3000/metrics

# System status
curl http://localhost:3000/status
```

### Log Management

```bash
# View application logs
docker-compose logs -f shortwavereport

# View all service logs
docker-compose logs -f

# Log rotation is handled automatically by Docker
# Configure external log aggregation for production
```

## Troubleshooting

### Common Issues

**Container fails to start:**
```bash
# Check logs
docker-compose logs shortwavereport

# Check resource usage
docker stats

# Verify environment variables
docker-compose config
```

**Health checks failing:**
```bash
# Test health endpoint directly
curl -i http://localhost:3000/health

# Check container health
docker inspect --format='{{.State.Health.Status}}' shortwavereport

# View health check logs
docker inspect --format='{{range .State.Health.Log}}{{.Output}}{{end}}' shortwavereport
```

**Performance issues:**
```bash
# Monitor resource usage
docker stats shortwavereport

# Check memory usage
curl http://localhost:3000/metrics | grep memory

# Review configuration
docker-compose exec shortwavereport cat /app/config/app.config.js
```

**Audio processing problems:**
```bash
# Verify FFmpeg installation
docker-compose exec shortwavereport ffmpeg -version

# Check audio directory permissions
docker-compose exec shortwavereport ls -la /app/data/audio

# Review audio processing logs
docker-compose logs shortwavereport | grep audio
```

### Debugging Commands

```bash
# Access container shell
docker-compose exec shortwavereport /bin/bash

# Check application status
docker-compose exec shortwavereport npm run status

# View configuration
docker-compose exec shortwavereport node -e "console.log(require('./config/app.config.js').default)"

# Test SDR connectivity
docker-compose exec shortwavereport node -e "
const agent = require('./src/agents/sdr-discovery.js');
new agent.default().execute().then(console.log).catch(console.error);
"
```

### Performance Optimization

```bash
# Optimize Docker images
docker system prune -f
docker image prune -f

# Update resource limits in docker-compose.yml
services:
  shortwavereport:
    deploy:
      resources:
        limits:
          memory: 2G
          cpus: '1.0'
        reservations:
          memory: 1G
          cpus: '0.5'
```

### Backup and Recovery

```bash
# Backup data directory
tar -czf backup-$(date +%Y%m%d).tar.gz data/

# Backup configuration
cp .env.production .env.production.backup

# Recovery
tar -xzf backup-YYYYMMDD.tar.gz
docker-compose up -d
```

## Security Considerations

### Production Security Checklist

- [ ] Change default passwords and secrets
- [ ] Configure proper CORS origins
- [ ] Enable SSL/TLS
- [ ] Set up proper firewall rules
- [ ] Configure rate limiting
- [ ] Enable security headers
- [ ] Set up log monitoring
- [ ] Regular security updates
- [ ] Container image scanning
- [ ] Network segmentation

### Security Updates

```bash
# Update base images
docker-compose pull
docker-compose up -d

# Update application
git pull origin main
docker-compose build --no-cache
docker-compose up -d

# Security audit
npm audit
docker scan shortwavereport:latest
```

## Support

For deployment issues:

1. Check this documentation
2. Review application logs
3. Consult the troubleshooting section
4. Create an issue in the repository

## License

This deployment guide is part of the Shortwavereport project and follows the same license terms.