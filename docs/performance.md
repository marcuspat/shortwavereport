# Performance Tuning Guide

## Overview

This guide provides comprehensive performance optimization strategies for the Shortwave Monitor system, covering system-level tuning, application optimization, and scaling considerations.

## System Performance Baseline

### Typical Performance Metrics

| Component | Operation | Duration | Memory Usage | CPU Usage |
|-----------|-----------|----------|--------------|-----------|
| SDR Discovery | Full network scan | 10-30s | 50-100MB | 20-40% |
| Audio Capture | 60s sample | 60-90s | 100-200MB | 30-50% |
| Audio Analysis | Per sample | 5-15s | 150-300MB | 40-70% |
| Report Generation | Dashboard creation | 2-5s | 50-100MB | 10-30% |
| **Total Workflow** | **End-to-end** | **3-5 minutes** | **200-400MB** | **Average 30%** |

### Resource Requirements

**Minimum System Requirements:**
- CPU: 2 cores, 2.4GHz
- RAM: 4GB available  
- Storage: 10GB free space
- Network: 10Mbps stable connection

**Recommended System Requirements:**
- CPU: 4+ cores, 3.0GHz+
- RAM: 8GB+ available
- Storage: 50GB+ SSD
- Network: 25Mbps+ with low latency

## Node.js Performance Optimization

### Memory Management

#### 1. Heap Size Optimization

```bash
# Set appropriate heap size based on available RAM
export NODE_OPTIONS="--max-old-space-size=4096"  # 4GB
export NODE_OPTIONS="--max-old-space-size=8192"  # 8GB (recommended)

# For memory-constrained environments
export NODE_OPTIONS="--max-old-space-size=2048"  # 2GB minimum
```

#### 2. Garbage Collection Tuning

```bash
# Enable concurrent garbage collection
export NODE_OPTIONS="--expose-gc --optimize-for-size"

# For production environments
export NODE_OPTIONS="--max-old-space-size=8192 --expose-gc --gc-interval=100"
```

#### 3. Memory Leak Prevention

```javascript
// config/performance.js
export default {
  memory: {
    // Automatic cleanup intervals
    cleanupInterval: 300000,      // 5 minutes
    maxMemoryThreshold: 0.8,      // 80% of max heap
    forceGCThreshold: 0.9,        // 90% triggers forced GC
    
    // Audio file retention
    audioRetentionTime: 3600000,  // 1 hour
    maxAudioFiles: 100,           // Limit concurrent files
    
    // Memory monitoring
    enableMonitoring: true,
    monitoringInterval: 60000     // 1 minute
  }
}
```

### CPU Optimization

#### 1. Event Loop Monitoring

```javascript
// Monitor event loop lag
setInterval(() => {
  const start = process.hrtime.bigint();
  setImmediate(() => {
    const lag = process.hrtime.bigint() - start;
    if (lag > 100000000n) { // > 100ms
      console.warn(`Event loop lag detected: ${lag / 1000000n}ms`);
    }
  });
}, 5000);
```

#### 2. CPU-Intensive Task Optimization

```javascript
// Use worker threads for heavy processing
import { Worker, isMainThread, parentPort } from 'worker_threads';

class PerformanceOptimizedAgent {
  constructor() {
    this.workerPool = [];
    this.maxWorkers = require('os').cpus().length;
  }
  
  async processWithWorker(data) {
    if (this.workerPool.length < this.maxWorkers) {
      const worker = new Worker('./workers/audio-processor.js');
      this.workerPool.push(worker);
    }
    
    const worker = this.workerPool[0];
    return new Promise((resolve, reject) => {
      worker.postMessage(data);
      worker.once('message', resolve);
      worker.once('error', reject);
    });
  }
}
```

## Application-Level Optimization

### 1. Agent Performance Tuning

#### SDR Discovery Agent Optimization

```javascript
// config/agents/sdr-discovery.js
export default {
  discovery: {
    // Parallel processing limits
    maxConcurrentChecks: 10,      // Increase for faster discovery
    batchSize: 50,                // Process SDRs in batches
    
    // Timeout optimization
    connectionTimeout: 5000,       // 5s for quick response
    responseTimeout: 10000,        // 10s for complete response
    
    // Caching strategy
    enableCaching: true,
    cacheTimeout: 1800000,        // 30 minutes
    maxCacheSize: 1000,           // Cache 1000 SDRs
    
    // Quality scoring optimization
    parallelScoring: true,
    scoringTimeout: 3000,         // 3s per SDR scoring
    minQualityThreshold: 0.5      // Skip low-quality SDRs early
  }
}
```

#### Audio Capture Agent Optimization

```javascript
// config/agents/audio-capture.js
export default {
  capture: {
    // Performance settings
    maxConcurrentCaptures: 4,     // Parallel audio captures
    captureQueueSize: 20,         // Queue management
    captureTimeout: 90000,        // 90s timeout
    
    // Audio quality optimization
    dynamicQuality: true,         // Adjust quality based on performance
    fallbackSampleRates: [44100, 22050, 16000], // Quality fallback
    
    // FFmpeg optimization
    ffmpegThreads: 2,             // CPU threads for FFmpeg
    ffmpegPreset: 'fast',         // Encoding speed preset
    bufferSize: 8192,             // Audio buffer size
    
    // Cleanup optimization
    enableStreaming: true,        // Stream processing
    tempFileCleanup: true,        // Immediate cleanup
    maxTempFiles: 50              // Limit temp files
  }
}
```

#### Audio Analysis Agent Optimization

```javascript
// config/agents/audio-analysis.js
export default {
  analysis: {
    // Processing optimization
    maxConcurrentAnalysis: 2,     // CPU-intensive processing
    analysisTimeout: 30000,       // 30s per sample
    
    // AI model optimization
    batchProcessing: true,        // Process multiple samples together
    modelCaching: true,           // Cache loaded models
    tensorOptimization: true,     // Tensor processing optimization
    
    // Feature extraction optimization
    parallelFeatures: true,       // Extract features in parallel
    featureCaching: true,         // Cache computed features
    
    // Quality thresholds
    minAudioLength: 5,            // Skip short samples
    maxAudioLength: 300,          // Limit long samples
    qualityThreshold: 0.3         // Skip low-quality audio
  }
}
```

### 2. Memory System Optimization

#### Namespace-Based Memory Optimization

```javascript
// Enhanced memory manager with performance optimizations
class OptimizedMemoryManager {
  constructor() {
    this.cache = new Map();
    this.writeQueue = [];
    this.maxCacheSize = 1000;
    this.flushInterval = 5000;    // 5s batch writes
    
    // Start background processes
    this.startBatchProcessor();
    this.startCacheEviction();
  }
  
  async store(namespace, key, data) {
    // Use in-memory cache for hot data
    const cacheKey = `${namespace}:${key}`;
    this.cache.set(cacheKey, data);
    
    // Queue for batch writing
    this.writeQueue.push({ namespace, key, data });
    
    // Immediate return for performance
    return Promise.resolve();
  }
  
  startBatchProcessor() {
    setInterval(async () => {
      if (this.writeQueue.length > 0) {
        const batch = this.writeQueue.splice(0, 100); // Process 100 at a time
        await this.processBatch(batch);
      }
    }, this.flushInterval);
  }
  
  startCacheEviction() {
    setInterval(() => {
      if (this.cache.size > this.maxCacheSize) {
        const keysToDelete = Array.from(this.cache.keys())
          .slice(0, this.cache.size - this.maxCacheSize);
        keysToDelete.forEach(key => this.cache.delete(key));
      }
    }, 60000); // Every minute
  }
}
```

### 3. Network Performance Optimization

#### Connection Pooling

```javascript
// HTTP connection pooling for SDR connections
import http from 'http';
import https from 'https';

const httpAgent = new http.Agent({
  keepAlive: true,
  maxSockets: 50,
  maxFreeSockets: 10,
  timeout: 60000,
  freeSocketTimeout: 30000
});

const httpsAgent = new https.Agent({
  keepAlive: true,
  maxSockets: 50,
  maxFreeSockets: 10,
  timeout: 60000,
  freeSocketTimeout: 30000
});

// Use in fetch requests
const fetchWithPool = (url, options = {}) => {
  const agent = url.startsWith('https:') ? httpsAgent : httpAgent;
  return fetch(url, { ...options, agent });
};
```

#### Request Optimization

```javascript
// Optimized request handling
class NetworkOptimizer {
  constructor() {
    this.requestQueue = [];
    this.activeRequests = new Set();
    this.maxConcurrentRequests = 20;
    this.rateLimitDelay = 100; // ms between requests
  }
  
  async makeRequest(url, options = {}) {
    return new Promise((resolve, reject) => {
      this.requestQueue.push({ url, options, resolve, reject });
      this.processQueue();
    });
  }
  
  async processQueue() {
    if (this.activeRequests.size >= this.maxConcurrentRequests) {
      return;
    }
    
    const request = this.requestQueue.shift();
    if (!request) return;
    
    this.activeRequests.add(request);
    
    try {
      const response = await fetchWithPool(request.url, request.options);
      request.resolve(response);
    } catch (error) {
      request.reject(error);
    } finally {
      this.activeRequests.delete(request);
      
      // Rate limiting
      setTimeout(() => this.processQueue(), this.rateLimitDelay);
    }
  }
}
```

## System-Level Optimization

### 1. Operating System Tuning

#### Linux Performance Tuning

```bash
# Network optimization
echo 'net.core.rmem_max = 268435456' >> /etc/sysctl.conf
echo 'net.core.wmem_max = 268435456' >> /etc/sysctl.conf
echo 'net.ipv4.tcp_rmem = 4096 87380 268435456' >> /etc/sysctl.conf
echo 'net.ipv4.tcp_wmem = 4096 65536 268435456' >> /etc/sysctl.conf

# File descriptor limits
echo '* soft nofile 65536' >> /etc/security/limits.conf
echo '* hard nofile 65536' >> /etc/security/limits.conf

# Apply changes
sysctl -p
```

#### Process Priorities

```bash
# Run with higher priority
nice -n -10 npm start

# Or set CPU affinity
taskset -c 0,1,2,3 npm start
```

### 2. Storage Optimization

#### SSD Configuration

```bash
# Enable SSD optimizations
echo 'deadline' > /sys/block/sda/queue/scheduler
echo '1' > /sys/block/sda/queue/nomerges

# Mount options for performance
mount -o noatime,nodiratime /dev/sda1 /path/to/shortwave
```

#### Temporary File Management

```javascript
// Use in-memory filesystem for temporary files
import tmpfs from 'tmpfs';

class TempFileManager {
  constructor() {
    this.tempDir = '/tmp/shortwave-audio';  // Use tmpfs mount
    this.maxTempSize = 1024 * 1024 * 1024;  // 1GB limit
  }
  
  async createTempFile(data) {
    const filename = `temp_${Date.now()}_${Math.random().toString(36)}`;
    const filepath = path.join(this.tempDir, filename);
    
    // Write to memory-based filesystem
    await fs.writeFile(filepath, data);
    
    // Schedule cleanup
    setTimeout(() => {
      fs.unlink(filepath).catch(console.error);
    }, 300000); // 5 minutes
    
    return filepath;
  }
}
```

## Monitoring and Profiling

### 1. Performance Monitoring

#### Built-in Metrics Collection

```javascript
// Enhanced orchestrator with performance monitoring
class PerformanceMonitoredOrchestrator extends SPARCOrchestrator {
  constructor() {
    super();
    this.metrics = {
      executionTimes: new Map(),
      memoryUsage: [],
      cpuUsage: [],
      networkLatency: []
    };
    
    this.startMetricsCollection();
  }
  
  startMetricsCollection() {
    setInterval(() => {
      const usage = process.memoryUsage();
      const cpu = process.cpuUsage();
      
      this.metrics.memoryUsage.push({
        timestamp: Date.now(),
        heapUsed: usage.heapUsed,
        heapTotal: usage.heapTotal,
        external: usage.external,
        rss: usage.rss
      });
      
      this.metrics.cpuUsage.push({
        timestamp: Date.now(),
        user: cpu.user,
        system: cpu.system
      });
      
      // Keep only recent metrics
      if (this.metrics.memoryUsage.length > 1000) {
        this.metrics.memoryUsage = this.metrics.memoryUsage.slice(-500);
      }
      if (this.metrics.cpuUsage.length > 1000) {
        this.metrics.cpuUsage = this.metrics.cpuUsage.slice(-500);
      }
    }, 5000);
  }
  
  async getPerformanceReport() {
    const memStats = this.calculateMemoryStats();  
    const cpuStats = this.calculateCPUStats();
    const networkStats = this.calculateNetworkStats();
    
    return {
      memory: memStats,
      cpu: cpuStats,
      network: networkStats,
      executionTimes: Object.fromEntries(this.metrics.executionTimes)
    };
  }
}
```

#### External Monitoring Integration

```javascript
// Prometheus metrics integration
import promClient from 'prom-client';

class PrometheusMetrics {
  constructor() {
    this.register = new promClient.Registry();
    
    // Define metrics
    this.httpDuration = new promClient.Histogram({
      name: 'http_request_duration_seconds',
      help: 'Duration of HTTP requests in seconds',
      labelNames: ['method', 'endpoint', 'status_code']
    });
    
    this.memoryUsage = new promClient.Gauge({
      name: 'nodejs_memory_usage_bytes',
      help: 'Memory usage in bytes',
      labelNames: ['type']
    });
    
    this.activeSDRs = new promClient.Gauge({
      name: 'sdr_active_count',
      help: 'Number of active SDR receivers'
    });
    
    this.audioSamples = new promClient.Counter({
      name: 'audio_samples_processed_total',
      help: 'Total number of audio samples processed'
    });
    
    // Register metrics
    this.register.registerMetric(this.httpDuration);
    this.register.registerMetric(this.memoryUsage);
    this.register.registerMetric(this.activeSDRs);
    this.register.registerMetric(this.audioSamples);
    
    // Start automatic collection
    this.startCollection();
  }
  
  startCollection() {
    setInterval(() => {
      const usage = process.memoryUsage();
      this.memoryUsage.set({ type: 'heap_used' }, usage.heapUsed);
      this.memoryUsage.set({ type: 'heap_total' }, usage.heapTotal);
      this.memoryUsage.set({ type: 'external' }, usage.external);
      this.memoryUsage.set({ type: 'rss' }, usage.rss);
    }, 5000);
  }
  
  getMetrics() {
    return this.register.metrics();
  }
}
```

### 2. Profiling Tools

#### CPU Profiling

```bash
# Install profiling tools
npm install -g clinic
npm install -g autocannon

# CPU profiling
clinic doctor -- node src/main.js

# Flame graph generation
clinic flame -- node src/main.js

# Bubble profiling
clinic bubbleprof -- node src/main.js
```

#### Memory Profiling

```bash
# Memory leak detection
node --inspect src/main.js
# Then use Chrome DevTools

# Heap snapshot analysis
node --heapsnapshot-signal=SIGUSR2 src/main.js
# Send SIGUSR2 to generate heap snapshot
```

## Load Testing and Scaling

### 1. Load Testing

#### API Load Testing

```bash
# Install load testing tools
npm install -g autocannon artillery

# Test API endpoints
autocannon -c 10 -d 60 http://localhost:3000/api/data

# Complex load testing
artillery quick --count 100 --num 10 http://localhost:3000/
```

#### Load Testing Configuration

```yaml
# artillery-config.yml
config:
  target: http://localhost:3000
  phases:
    - duration: 60
      arrivalRate: 5
      name: "Warm up"
    - duration: 120
      arrivalRate: 10
      name: "Sustained load"
    - duration: 60
      arrivalRate: 20
      name: "Peak load"

scenarios:
  - name: "API Testing"
    flow:
      - get:
          url: "/health"
      - get:
          url: "/api/data"
      - get:
          url: "/metrics"
```

### 2. Horizontal Scaling

#### Multi-Instance Deployment

```javascript
// cluster.js - Multi-process deployment
import cluster from 'cluster';
import os from 'os';
import { SPARCOrchestrator } from './src/orchestrator.js';

const numCPUs = os.cpus().length;

if (cluster.isPrimary) {
  console.log(`Master ${process.pid} is running`);
  
  // Fork workers
  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }
  
  cluster.on('exit', (worker, code, signal) => {
    console.log(`Worker ${worker.process.pid} died`);
    cluster.fork(); // Restart worker
  });
} else {
  const orchestrator = new SPARCOrchestrator();
  orchestrator.execute();
  console.log(`Worker ${process.pid} started`);
}
```

#### Load Balancer Configuration

```nginx
# nginx.conf - Load balancing
upstream shortwave_backend {
    least_conn;
    server 127.0.0.1:3000 weight=3 max_fails=3 fail_timeout=30s;
    server 127.0.0.1:3001 weight=3 max_fails=3 fail_timeout=30s;
    server 127.0.0.1:3002 weight=3 max_fails=3 fail_timeout=30s;
    server 127.0.0.1:3003 weight=3 max_fails=3 fail_timeout=30s;
    
    keepalive 32;
}

server {
    listen 80;
    
    location / {
        proxy_pass http://shortwave_backend;
        proxy_http_version 1.1;
        proxy_set_header Connection "";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        
        # Load balancing parameters
        proxy_connect_timeout 5s;
        proxy_send_timeout 30s;
        proxy_read_timeout 30s;
        proxy_next_upstream error timeout http_500 http_502 http_503;
    }
}
```

## Performance Benchmarks

### Target Performance Goals

| Metric | Target | Excellent |
|--------|--------|-----------|
| Discovery Time | < 30s | < 15s |
| Audio Capture | < 90s | < 70s |
| Analysis Time | < 30s | < 15s |
| Memory Usage | < 500MB | < 300MB |
| CPU Usage (avg) | < 50% | < 30% |
| API Response | < 500ms | < 200ms |
| Uptime | > 99% | > 99.9% |

### Optimization Checklist

- [ ] Node.js heap size configured appropriately
- [ ] Connection pooling enabled for HTTP requests
- [ ] FFmpeg optimized for available CPU cores  
- [ ] Temporary files using in-memory filesystem
- [ ] Garbage collection tuned for workload
- [ ] System file descriptor limits increased
- [ ] Network buffers optimized for throughput
- [ ] Audio processing using streaming where possible
- [ ] Database queries optimized and indexed
- [ ] Monitoring and alerting configured
- [ ] Load testing completed successfully
- [ ] Memory leak testing performed
- [ ] Cache hit ratios optimized
- [ ] Error rates monitored and minimized

### Performance Validation

```bash
# Run performance validation script
#!/bin/bash
echo "=== Performance Validation ==="

# System resources
echo "Memory: $(free -h | grep '^Mem:' | awk '{print $3 "/" $2}')"
echo "CPU Cores: $(nproc)"
echo "Storage: $(df -h . | tail -1 | awk '{print $4}' | head -1) available"

# Application performance
echo -e "\n=== Application Metrics ==="
curl -s http://localhost:3000/metrics | grep -E "(memory|cpu|duration)"

# Load test
echo -e "\n=== Load Test Results ==="
autocannon -c 5 -d 30 --json http://localhost:3000/api/data | jq '.requests.average'

echo -e "\n=== Validation Complete ==="
```

This performance tuning guide provides a comprehensive approach to optimizing the Shortwave Monitor system for various deployment scenarios and workloads.