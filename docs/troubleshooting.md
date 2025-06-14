# Troubleshooting Guide

## Common Issues and Solutions

### Installation Issues

#### Node.js Version Problems

**Problem**: `TypeError: fetch is not defined` or similar ES module errors
```bash
Error: fetch is not defined
    at SDRDiscoveryAgent.discoverWebSDRs
```

**Solution**:
```bash
# Check Node.js version
node --version

# Should be 18.0.0 or higher
# If not, update Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
```

#### FFmpeg Not Found

**Problem**: `Error: spawn ffmpeg ENOENT`
```bash
Error: spawn ffmpeg ENOENT
    at Process.ChildProcess._handle.onexit
```

**Solution**:
```bash
# Ubuntu/Debian
sudo apt update
sudo apt install -y ffmpeg

# macOS
brew install ffmpeg

# Windows
choco install ffmpeg

# Verify installation
ffmpeg -version
which ffmpeg
```

#### Permission Denied Errors

**Problem**: `EACCES: permission denied` when creating directories
```bash
Error: EACCES: permission denied, mkdir '/data'
```

**Solution**:
```bash
# Fix directory permissions
sudo chown -R $USER:$USER $(pwd)
chmod -R 755 $(pwd)

# Or run with proper user
sudo -u shortwave npm start
```

### Runtime Issues

#### Memory Out of Bounds

**Problem**: `JavaScript heap out of memory`
```bash
FATAL ERROR: Reached heap limit Allocation failed - JavaScript heap out of memory
```

**Solution**:
```bash
# Increase Node.js memory limit
export NODE_OPTIONS="--max-old-space-size=4096"
npm start

# Or permanently in package.json
"scripts": {
  "start": "node --max-old-space-size=4096 src/main.js"
}
```

#### Port Already in Use

**Problem**: `Error: listen EADDRINUSE: address already in use :::3000`

**Solution**:
```bash
# Find process using port 3000
sudo lsof -i :3000
# Or
netstat -tlnp | grep :3000

# Kill the process
sudo kill -9 <PID>

# Or use different port
export PORT=3001
npm start
```

#### SDR Discovery Timeout

**Problem**: SDR discovery fails with timeout errors
```bash
❌ WebSDR: Discovery failed - fetch timeout
❌ KiwiSDR: Discovery failed - Network timeout
```

**Solutions**:

1. **Check Network Connectivity:**
   ```bash
   # Test basic connectivity
   ping -c 4 google.com
   curl -I http://websdr.org/
   ```

2. **Increase Timeout Values:**
   ```javascript
   // config/config.js
   export default {
     discovery: {
       timeout: 60000,  // Increase to 60 seconds
       maxRetries: 5,   // More retry attempts
       qualityThreshold: 0.3  // Lower threshold
     }
   }
   ```

3. **Use Demo Mode:**
   ```bash
   # Run with mock data when network issues persist
   npm run demo
   ```

#### Audio Capture Failures

**Problem**: Audio capture returns empty or corrupted files
```bash
⚠️ Warning: Audio sample quality very low: 0.1
❌ Audio capture failed: No audio data received
```

**Solutions**:

1. **Check SDR Availability:**
   ```bash
   # Test SDR accessibility
   curl -I http://websdr.ewi.utwente.nl:8901/
   ```

2. **Verify FFmpeg Configuration:**
   ```bash
   # Test FFmpeg with simple recording
   ffmpeg -f lavfi -i "sine=frequency=1000:duration=5" test.wav
   ```

3. **Adjust Capture Parameters:**
   ```javascript
   // config/config.js
   export default {
     capture: {
       duration: 30,      // Shorter duration
       sampleRate: 22050, // Lower sample rate
       maxRetries: 3,     // More retries
       fallbackSDRs: [    // Backup SDRs
         'http://websdr.ewi.utwente.nl:8901/'
       ]
     }
   }
   ```

### Analysis Issues

#### Speech-to-Text Failures

**Problem**: Analysis returns no transcription results
```bash
Content type: voice, but no transcription available
Analysis confidence: 0.0
```

**Solutions**:

1. **Check Audio Quality:**
   ```bash
   # Play captured audio to verify quality
   ffplay data/audio/sample_14_2_MHz.wav
   ```

2. **Adjust Analysis Thresholds:**
   ```javascript
   // config/config.js
   export default {
     analysis: {
       confidenceThreshold: 0.4,  // Lower threshold
       enableSTT: true,
       fallbackToMockAnalysis: true
     }
   }
   ```

3. **Enable Debug Logging:**
   ```bash
   DEBUG=analysis npm start
   ```

#### Language Detection Issues

**Problem**: Incorrect language detection or no language detected
```bash
Language: null (confidence: 0.0)
```

**Solutions**:

1. **Verify Language Support:**
   ```javascript
   // Supported languages
   const supportedLanguages = ['en', 'de', 'fr', 'es', 'ru', 'ja'];
   ```

2. **Adjust Detection Sensitivity:**
   ```javascript
   // config/config.js
   export default {
     analysis: {
       languageDetection: {
         minSampleLength: 10,  // Minimum seconds
         confidenceThreshold: 0.3
       }
     }
   }
   ```

### Web Interface Issues

#### Dashboard Not Loading

**Problem**: Browser shows "Cannot GET /" or blank page

**Solutions**:

1. **Check Server Status:**
   ```bash
   # Verify server is running
   curl http://localhost:3000/health
   
   # Check server logs
   pm2 logs shortwave-monitor
   ```

2. **Clear Browser Cache:**
   ```bash
   # Hard refresh browser
   Ctrl+F5 (Windows/Linux)
   Cmd+Shift+R (macOS)
   ```

3. **Check Port Configuration:**
   ```bash
   # Verify correct port
   echo $PORT
   netstat -tlnp | grep :3000
   ```

#### Audio Files Not Playing

**Problem**: Audio player shows error when trying to play samples

**Solutions**:

1. **Check File Permissions:**
   ```bash
   ls -la data/audio/
   chmod 644 data/audio/*.wav
   ```

2. **Verify MIME Types:**
   ```javascript
   // Express server should serve .wav files correctly
   app.use('/data/audio', express.static('data/audio', {
     setHeaders: (res, path) => {
       if (path.endsWith('.wav')) {
         res.set('Content-Type', 'audio/wav');
       }
     }
   }));
   ```

3. **Browser Compatibility:**
   ```html
   <!-- Check browser audio support -->
   <audio controls>
     <source src="sample.wav" type="audio/wav">
     <source src="sample.mp3" type="audio/mpeg">
     Your browser does not support audio playback.
   </audio>
   ```

### Docker Issues

#### Build Failures

**Problem**: Docker build fails with missing dependencies
```bash
ERROR [5/7] RUN npm ci --only=production
npm ERR! Cannot read property 'length' of undefined
```

**Solutions**:

1. **Clear Docker Cache:**
   ```bash
   docker system prune -a
   docker build --no-cache -t shortwave-monitor .
   ```

2. **Update Base Image:**
   ```dockerfile
   # Use latest stable Node.js image
   FROM node:18-alpine

   # Update package manager
   RUN apk update && apk upgrade
   ```

3. **Check Dockerfile Context:**
   ```bash
   # Ensure Dockerfile is in project root
   ls -la Dockerfile package.json
   ```

#### Container Runtime Issues

**Problem**: Container exits immediately after starting
```bash
shortwave-monitor_1 exited with code 1
```

**Solutions**:

1. **Check Container Logs:**
   ```bash
   docker-compose logs shortwave-monitor
   docker logs <container_id>
   ```

2. **Interactive Debugging:**
   ```bash
   # Start container with shell
   docker run -it shortwave-monitor /bin/sh
   
   # Check environment
   env
   node --version
   npm --version
   ```

3. **Health Check Configuration:**
   ```dockerfile
   HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
     CMD curl -f http://localhost:3000/health || exit 1
   ```

### Production Issues

#### PM2 Process Management

**Problem**: PM2 processes keep restarting or crashing
```bash
shortwave-monitor  errored    0    0    0s     5      0%      0.0MB
```

**Solutions**:

1. **Check PM2 Logs:**
   ```bash
   pm2 logs shortwave-monitor --lines 100
   pm2 show shortwave-monitor
   ```

2. **Adjust Memory Limits:**
   ```javascript
   // ecosystem.config.js
   module.exports = {
     apps: [{
       name: 'shortwave-monitor',
       script: 'src/main.js',
       max_memory_restart: '4G',    // Increase memory limit
       min_uptime: '10s',           // Minimum uptime before restart
       max_restarts: 5,             // Limit restart attempts
       restart_delay: 10000         // Delay between restarts
     }]
   }
   ```

3. **Enable Process Monitoring:**
   ```bash
   pm2 monit
   pm2 install pm2-logrotate
   ```

#### Nginx Reverse Proxy Issues

**Problem**: 502 Bad Gateway or connection refused errors

**Solutions**:

1. **Check Upstream Connection:**
   ```bash
   # Test direct connection
   curl http://localhost:3000/health
   
   # Check Nginx error logs
   sudo tail -f /var/log/nginx/error.log
   ```

2. **Verify Nginx Configuration:**
   ```bash
   # Test configuration
   sudo nginx -t
   
   # Reload configuration
   sudo systemctl reload nginx
   ```

3. **Update Upstream Configuration:**
   ```nginx
   upstream shortwave-backend {
     server 127.0.0.1:3000 max_fails=3 fail_timeout=30s;
     keepalive 32;
   }
   
   server {
     location / {
       proxy_pass http://shortwave-backend;
       proxy_http_version 1.1;
       proxy_set_header Connection "";
       proxy_connect_timeout 10s;
       proxy_send_timeout 10s;
       proxy_read_timeout 10s;
     }
   }
   ```

### Performance Issues

#### Slow Response Times

**Problem**: Web interface loads slowly or times out

**Solutions**:

1. **Enable Response Compression:**
   ```javascript
   // Express server
   const compression = require('compression');
   app.use(compression());
   ```

2. **Implement Caching:**
   ```javascript
   // Cache API responses
   app.get('/api/data', cache('5 minutes'), (req, res) => {
     // API handler
   });
   ```

3. **Optimize Database Queries:**
   ```javascript
   // Use indexed queries
   const results = await memory.query('analysis', 'results_index');
   ```

#### High Memory Usage

**Problem**: System runs out of memory during execution

**Solutions**:

1. **Monitor Memory Usage:**
   ```bash
   # System memory
   free -h
   watch -n 1 free -h
   
   # Process memory
   top -p $(pgrep node)
   ```

2. **Optimize Memory Configuration:**
   ```javascript
   // config/config.js
   export default {
     performance: {
       maxMemoryUsage: '2GB',
       enableGC: true,
       gcInterval: 300000  // 5 minutes
     }
   }
   ```

3. **Implement Memory Cleanup:**
   ```javascript
   // Periodic cleanup
   setInterval(() => {
     if (global.gc) {
       global.gc();
     }
   }, 300000);
   ```

## Debug Mode

### Enable Comprehensive Debugging

```bash
# Enable all debug output
DEBUG=* npm start

# Enable specific components
DEBUG=orchestrator,sdr-discovery,audio-capture npm start

# Enable with log levels
LOG_LEVEL=debug npm start
```

### Debug Configuration

```javascript
// config/debug.js
export default {
  logging: {
    level: 'debug',
    components: {
      orchestrator: true,
      sdr_discovery: true,
      audio_capture: true,
      audio_analysis: true,
      report_generator: true
    },
    file: './logs/debug.log',
    console: true
  }
}
```

### Debug Utilities

```bash
# Create debug script
cat << 'EOF' > debug.sh
#!/bin/bash
echo "=== System Information ==="
uname -a
node --version
npm --version
ffmpeg -version | head -1

echo -e "\n=== Network Connectivity ==="
ping -c 2 google.com
curl -I --timeout 5 http://websdr.org/

echo -e "\n=== Port Status ==="
netstat -tlnp | grep :3000

echo -e "\n=== Memory Usage ==="
free -h

echo -e "\n=== Disk Space ==="
df -h .

echo -e "\n=== Process Status ==="
pm2 status 2>/dev/null || echo "PM2 not running"

echo -e "\n=== Recent Logs ==="
tail -20 logs/*.log 2>/dev/null || echo "No log files found"
EOF

chmod +x debug.sh
./debug.sh
```

## Health Monitoring

### Health Check Endpoints

```bash
# System health
curl http://localhost:3000/health

# Readiness probe
curl http://localhost:3000/ready

# Liveness probe
curl http://localhost:3000/live

# Detailed metrics
curl http://localhost:3000/metrics

# Full system status
curl http://localhost:3000/status
```

### Monitoring Script

```bash
#!/bin/bash
# monitor.sh - Continuous health monitoring

ENDPOINT="http://localhost:3000"
LOG_FILE="monitoring.log"

while true; do
  TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
  
  # Health check
  HEALTH=$(curl -s -o /dev/null -w "%{http_code}" $ENDPOINT/health)
  
  if [ "$HEALTH" -eq 200 ]; then
    echo "$TIMESTAMP - HEALTHY" >> $LOG_FILE
  else
    echo "$TIMESTAMP - UNHEALTHY (HTTP $HEALTH)" >> $LOG_FILE
    
    # Alert or restart logic here
    # pm2 restart shortwave-monitor
  fi
  
  sleep 30
done
```

## Getting Help

### Log Collection

Before seeking help, collect relevant logs:

```bash
# Create support bundle
mkdir -p support-bundle
cp -r logs/ support-bundle/
cp config/config.js support-bundle/config.txt
cp package.json support-bundle/
npm list > support-bundle/dependencies.txt
./debug.sh > support-bundle/system-info.txt

# Create archive
tar -czf support-bundle-$(date +%Y%m%d).tar.gz support-bundle/
```

### Common Commands for Support

```bash
# System information
uname -a
node --version
npm --version
ffmpeg -version

# Application status
pm2 status
pm2 logs --lines 50

# Network connectivity
curl -I http://websdr.org/
ping -c 4 8.8.8.8

# Resource usage
free -h
df -h
top -bn1 | head -10
```

### Contact Information

- **GitHub Issues**: Create detailed issue with logs and system information
- **Documentation**: Check docs/ directory for additional information
- **SPARC Support**: Use `npx claude-flow sparc info debug` for debugging assistance

### Emergency Recovery

If the system is completely non-functional:

```bash
# Stop all processes
pm2 stop all
pkill -f node

# Clean temporary files
rm -rf data/audio/*
rm -rf memory/*
rm -rf logs/*

# Reset to clean state
git checkout -- .
npm install

# Start with demo data
npm run demo
```