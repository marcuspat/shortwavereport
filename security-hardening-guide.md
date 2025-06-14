# Security Hardening Guide - Shortwave Monitor System

**Version:** 1.0  
**Date:** 2025-06-14  
**Target:** Development and Operations Teams

## Overview

This guide provides step-by-step instructions to secure the Shortwave Monitor System based on the security audit findings. Implementation should follow the priority order to address the most critical vulnerabilities first.

## Priority 1: Critical Security Fixes (Implement Immediately)

### 1.1 Implement Authentication System

**Issue:** No authentication/authorization system (C001)

**Solution Steps:**

1. **Install required packages:**
```bash
npm install passport passport-local express-session bcrypt helmet
```

2. **Create authentication middleware:**
```javascript
// src/middleware/auth.js
import passport from 'passport';
import LocalStrategy from 'passport-local';
import bcrypt from 'bcrypt';
import session from 'express-session';

export class AuthenticationManager {
  constructor() {
    this.setupStrategy();
  }

  setupStrategy() {
    passport.use(new LocalStrategy(
      async (username, password, done) => {
        // For production: integrate with your user database
        const validUsers = {
          'admin': await bcrypt.hash('secure_password_123!', 10),
          'monitor': await bcrypt.hash('monitor_pass_456!', 10)
        };

        if (!validUsers[username]) {
          return done(null, false, { message: 'Invalid username.' });
        }

        const isValid = await bcrypt.compare(password, validUsers[username]);
        if (!isValid) {
          return done(null, false, { message: 'Invalid password.' });
        }

        return done(null, { username, role: username === 'admin' ? 'admin' : 'monitor' });
      }
    ));

    passport.serializeUser((user, done) => done(null, user));
    passport.deserializeUser((user, done) => done(null, user));
  }

  getMiddleware() {
    return [
      session({
        secret: process.env.SESSION_SECRET || 'change-this-secret-in-production',
        resave: false,
        saveUninitialized: false,
        cookie: { 
          secure: process.env.NODE_ENV === 'production',
          httpOnly: true,
          maxAge: 24 * 60 * 60 * 1000 // 24 hours
        }
      }),
      passport.initialize(),
      passport.session()
    ];
  }

  requireAuth(req, res, next) {
    if (req.isAuthenticated()) {
      return next();
    }
    res.status(401).json({ error: 'Authentication required' });
  }

  requireRole(role) {
    return (req, res, next) => {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: 'Authentication required' });
      }
      if (req.user.role !== role && req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }
      next();
    };
  }
}
```

3. **Update report generator with authentication:**
```javascript
// src/agents/report-generator.js - Update deployReport method
import { AuthenticationManager } from '../middleware/auth.js';

async deployReport() {
  const app = express();
  const port = process.env.PORT || 3000;
  const auth = new AuthenticationManager();

  // Apply authentication middleware
  app.use(...auth.getMiddleware());

  // Login route
  app.post('/login', passport.authenticate('local'), (req, res) => {
    res.json({ message: 'Login successful', user: req.user });
  });

  // Logout route
  app.post('/logout', (req, res) => {
    req.logout();
    res.json({ message: 'Logout successful' });
  });

  // Protected routes
  app.use(auth.requireAuth);
  app.use(express.static(this.reportsDir));
  app.use('/data', auth.requireRole('admin'), express.static(path.join(process.cwd(), 'data')));

  app.get('/', (req, res) => {
    res.sendFile(path.join(this.reportsDir, 'dashboard.html'));
  });

  app.get('/api/data', auth.requireRole('monitor'), (req, res) => {
    res.json(this.reportData);
  });

  // ... rest of the method
}
```

### 1.2 Fix XSS Vulnerabilities

**Issue:** Multiple XSS vulnerabilities (H001)

**Solution Steps:**

1. **Install HTML sanitization library:**
```bash
npm install dompurify html-escaper
```

2. **Create HTML escaping utility:**
```javascript
// src/utils/html-sanitizer.js
import { escape } from 'html-escaper';

export class HTMLSanitizer {
  static escapeHtml(text) {
    if (!text) return '';
    return escape(String(text));
  }

  static sanitizeForDisplay(data) {
    if (typeof data === 'string') {
      return this.escapeHtml(data);
    }
    if (Array.isArray(data)) {
      return data.map(item => this.sanitizeForDisplay(item));
    }
    if (typeof data === 'object' && data !== null) {
      const sanitized = {};
      for (const [key, value] of Object.entries(data)) {
        sanitized[key] = this.sanitizeForDisplay(value);
      }
      return sanitized;
    }
    return data;
  }
}
```

3. **Update report generator templates:**
```javascript
// src/agents/report-generator.js - Update template generation
import { HTMLSanitizer } from '../utils/html-sanitizer.js';

generateCoverageVisualization() {
  const { coverage } = this.reportData;
  const regions = Object.entries(coverage.regions);
  
  return `
    <div class="coverage-grid">
      ${regions.map(([region, sdrs]) => `
        <div class="region-card">
          <h4>${HTMLSanitizer.escapeHtml(region)}</h4>
          <p>${sdrs.length} SDRs</p>
          <div class="region-details">
            ${sdrs.map(sdr => `
              <div class="sdr-item">
                <span class="location">${HTMLSanitizer.escapeHtml(sdr.location)}</span>
                <span class="quality">${parseInt(sdr.quality_score)}/100</span>
              </div>
            `).join('')}
          </div>
        </div>
      `).join('')}
    </div>
  `;
}
```

### 1.3 Secure Command Execution

**Issue:** Command injection vulnerability (H002)

**Solution Steps:**

1. **Create secure command executor:**
```javascript
// src/utils/secure-command.js
import { spawn } from 'child_process';
import path from 'path';

export class SecureCommandExecutor {
  static validatePath(filePath) {
    // Ensure path is within allowed directory
    const allowedDir = path.resolve(process.cwd(), 'data');
    const resolvedPath = path.resolve(filePath);
    
    if (!resolvedPath.startsWith(allowedDir)) {
      throw new Error('Path outside allowed directory');
    }
    
    // Check for dangerous characters
    const dangerousChars = /[;&|`$\\]/;
    if (dangerousChars.test(filePath)) {
      throw new Error('Dangerous characters in path');
    }
    
    return resolvedPath;
  }

  static sanitizeFilename(filename) {
    // Allow only alphanumeric, underscore, hyphen, and dot
    return filename.replace(/[^a-zA-Z0-9._-]/g, '_');
  }

  static async executeFFmpeg(inputPath, outputPath, options = {}) {
    try {
      const safeInputPath = this.validatePath(inputPath);
      const safeOutputPath = this.validatePath(outputPath);
      
      const args = [
        '-i', safeInputPath,
        '-ar', String(parseInt(options.sampleRate) || 16000),
        '-ac', String(parseInt(options.channels) || 1),
        '-acodec', 'pcm_s16le',
        '-y',
        safeOutputPath
      ];

      return new Promise((resolve, reject) => {
        const ffmpeg = spawn('ffmpeg', args, {
          stdio: ['ignore', 'pipe', 'pipe']
        });

        let stderr = '';
        ffmpeg.stderr.on('data', (data) => {
          stderr += data.toString();
        });

        ffmpeg.on('close', (code) => {
          if (code === 0) {
            resolve();
          } else {
            reject(new Error(`FFmpeg failed with code ${code}: ${stderr}`));
          }
        });

        ffmpeg.on('error', (error) => {
          reject(new Error(`FFmpeg error: ${error.message}`));
        });
      });
    } catch (error) {
      throw new Error(`Command validation failed: ${error.message}`);
    }
  }
}
```

2. **Update audio capture agent:**
```javascript
// src/agents/audio-capture.js - Update processWithFFmpeg method
import { SecureCommandExecutor } from '../utils/secure-command.js';

async processWithFFmpeg(inputPath, outputPath) {
  return SecureCommandExecutor.executeFFmpeg(inputPath, outputPath, this.captureConfig);
}

async captureFrequency(sdr, config) {
  // ... existing code ...
  
  const safeLocation = SecureCommandExecutor.sanitizeFilename(sdr.location);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `${config.type}_${safeLocation}_${timestamp}.wav`;
  
  // ... rest of method
}
```

### 1.4 Restrict File Access

**Issue:** Unrestricted file access (H003)

**Solution Steps:**

1. **Create secure file server:**
```javascript
// src/middleware/secure-file-server.js
import path from 'path';
import fs from 'fs/promises';

export class SecureFileServer {
  constructor(allowedExtensions = ['.wav', '.json', '.html']) {
    this.allowedExtensions = allowedExtensions;
    this.allowedPaths = [
      path.resolve(process.cwd(), 'data', 'audio'),
      path.resolve(process.cwd(), 'src', 'reports')
    ];
  }

  async validateFileAccess(filePath, userRole) {
    const resolvedPath = path.resolve(filePath);
    
    // Check if path is within allowed directories
    const isAllowed = this.allowedPaths.some(allowedPath => 
      resolvedPath.startsWith(allowedPath)
    );
    
    if (!isAllowed) {
      throw new Error('File access denied: path not allowed');
    }

    // Check file extension
    const ext = path.extname(resolvedPath).toLowerCase();
    if (!this.allowedExtensions.includes(ext)) {
      throw new Error('File access denied: extension not allowed');
    }

    // Role-based access control
    if (resolvedPath.includes('/data/') && userRole !== 'admin') {
      throw new Error('File access denied: insufficient permissions');
    }

    // Check if file exists
    try {
      await fs.access(resolvedPath);
    } catch {
      throw new Error('File not found');
    }

    return resolvedPath;
  }

  middleware() {
    return async (req, res, next) => {
      try {
        const requestedPath = path.join(process.cwd(), req.path);
        await this.validateFileAccess(requestedPath, req.user?.role || 'guest');
        next();
      } catch (error) {
        res.status(403).json({ error: error.message });
      }
    };
  }
}
```

2. **Update report generator:**
```javascript
// src/agents/report-generator.js - Update deployReport method
import { SecureFileServer } from '../middleware/secure-file-server.js';

async deployReport() {
  // ... existing auth setup ...
  
  const fileServer = new SecureFileServer();
  
  // Secure static file serving
  app.use('/reports', auth.requireAuth, fileServer.middleware(), 
    express.static(this.reportsDir));
  
  app.use('/data', auth.requireRole('admin'), fileServer.middleware(), 
    express.static(path.join(process.cwd(), 'data')));
  
  // ... rest of method
}
```

## Priority 2: High-Priority Security Improvements

### 2.1 Implement Security Headers

**Issue:** Missing security headers (M002)

**Solution Steps:**

1. **Install Helmet.js:**
```bash
npm install helmet
```

2. **Configure security headers:**
```javascript
// src/middleware/security-headers.js
import helmet from 'helmet';

export function getSecurityHeaders() {
  return helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:"],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
      },
    },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true
    },
    noSniff: true,
    frameguard: { action: 'deny' },
    xssFilter: true
  });
}
```

3. **Apply to Express apps:**
```javascript
// Update both orchestrator.js and report-generator.js
import { getSecurityHeaders } from '../middleware/security-headers.js';

// Add this line after creating the Express app
app.use(getSecurityHeaders());
```

### 2.2 Add Input Validation

**Issue:** Missing input validation (M001)

**Solution Steps:**

1. **Install validation library:**
```bash
npm install joi
```

2. **Create validation schemas:**
```javascript
// src/utils/validation.js
import Joi from 'joi';

export const schemas = {
  sdrUrl: Joi.string().uri().max(200),
  
  location: Joi.string()
    .pattern(/^[a-zA-Z0-9\s,.-]+$/)
    .max(100),
  
  frequency: Joi.number()
    .integer()
    .min(100000)   // 100 kHz
    .max(30000000), // 30 MHz
  
  filename: Joi.string()
    .pattern(/^[a-zA-Z0-9._-]+$/)
    .max(255),
  
  audioConfig: Joi.object({
    frequency: Joi.number().integer().min(100000).max(30000000).required(),
    mode: Joi.string().valid('am', 'fm', 'usb', 'lsb', 'cw').required(),
    bandwidth: Joi.number().integer().min(100).max(10000).required(),
    type: Joi.string().valid('hf_voice', 'broadcast', 'cw_digital', 'utility').required()
  })
};

export function validateInput(data, schema) {
  const { error, value } = schema.validate(data);
  if (error) {
    throw new Error(`Validation failed: ${error.details[0].message}`);
  }
  return value;
}
```

3. **Apply validation in agents:**
```javascript
// src/agents/sdr-discovery.js - Update scoring method
import { validateInput, schemas } from '../utils/validation.js';

async scoreSDRs() {
  for (const sdr of this.discoveredSDRs) {
    try {
      // Validate SDR data
      sdr.url = validateInput(sdr.url, schemas.sdrUrl);
      sdr.location = validateInput(sdr.location, schemas.location);
      
      // ... rest of scoring logic
    } catch (error) {
      console.warn(`Invalid SDR data, removing: ${error.message}`);
      // Remove invalid SDR from list
      this.discoveredSDRs = this.discoveredSDRs.filter(s => s !== sdr);
    }
  }
}
```

### 2.3 Secure Error Handling

**Issue:** Information disclosure in errors (M003)

**Solution Steps:**

1. **Create production error handler:**
```javascript
// src/utils/production-error-handler.js
export class ProductionErrorHandler {
  static sanitizeError(error, includeStack = false) {
    const isProduction = process.env.NODE_ENV === 'production';
    
    // Generic error messages for production
    const genericMessages = {
      'ValidationError': 'Invalid input provided',
      'UnauthorizedError': 'Access denied',
      'NotFoundError': 'Resource not found',
      'NetworkError': 'External service unavailable'
    };

    if (isProduction) {
      return {
        message: genericMessages[error.name] || 'An error occurred',
        code: error.code || 'INTERNAL_ERROR',
        timestamp: new Date().toISOString()
      };
    }

    // Development mode - include more details
    return {
      message: error.message,
      code: error.code || 'INTERNAL_ERROR',
      timestamp: new Date().toISOString(),
      ...(includeStack && { stack: error.stack })
    };
  }

  static logSecurely(error, context = {}) {
    // Log full details securely for debugging
    const logEntry = {
      timestamp: new Date().toISOString(),
      level: 'ERROR',
      message: error.message,
      stack: error.stack,
      context: context,
      pid: process.pid
    };

    // In production, send to secure logging service
    console.error(JSON.stringify(logEntry));
  }
}
```

2. **Update error handler:**
```javascript
// src/utils/error-handler.js - Update logError method
import { ProductionErrorHandler } from './production-error-handler.js';

async logError(errorInfo) {
  // Secure logging
  ProductionErrorHandler.logSecurely(errorInfo, { 
    component: 'shortwave-monitor',
    version: '1.0.0'
  });

  // Sanitized console output
  const sanitizedError = ProductionErrorHandler.sanitizeError(errorInfo);
  console.error(`${this.getConsolePrefix(errorInfo.severity)} ${sanitizedError.message}`);
}
```

### 2.4 Add Rate Limiting

**Issue:** Missing rate limiting (L001)

**Solution Steps:**

1. **Install rate limiting:**
```bash
npm install express-rate-limit express-slow-down
```

2. **Configure rate limiting:**
```javascript
// src/middleware/rate-limiting.js
import rateLimit from 'express-rate-limit';
import slowDown from 'express-slow-down';

export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per window
  message: { error: 'Too many login attempts, please try again later' },
  standardHeaders: true,
  legacyHeaders: false
});

export const apiRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per window per IP
  message: { error: 'Too many requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false
});

export const slowDownMiddleware = slowDown({
  windowMs: 15 * 60 * 1000, // 15 minutes
  delayAfter: 50, // Allow 50 requests per window without delay
  delayMs: 500 // Add 500ms delay per request after delayAfter
});
```

3. **Apply rate limiting:**
```javascript
// src/agents/report-generator.js - Update deployReport method
import { authRateLimit, apiRateLimit, slowDownMiddleware } from '../middleware/rate-limiting.js';

async deployReport() {
  // ... existing setup ...
  
  // Apply rate limiting
  app.use('/login', authRateLimit);
  app.use('/api/', apiRateLimit, slowDownMiddleware);
  
  // ... rest of routes
}
```

## Priority 3: Additional Security Measures

### 3.1 Implement Audit Logging

**Issue:** No audit logging (L002)

**Solution Steps:**

1. **Create audit logger:**
```javascript
// src/utils/audit-logger.js
import fs from 'fs/promises';
import path from 'path';

export class AuditLogger {
  constructor() {
    this.logPath = path.join(process.cwd(), 'data', 'logs', 'audit.log');
    this.initializeLog();
  }

  async initializeLog() {
    const logDir = path.dirname(this.logPath);
    await fs.mkdir(logDir, { recursive: true });
  }

  async log(event, details = {}) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      event: event,
      user: details.user || 'system',
      ip: details.ip || 'unknown',
      userAgent: details.userAgent || 'unknown',
      resource: details.resource || 'unknown',
      action: details.action || 'unknown',
      result: details.result || 'unknown',
      details: details.additionalInfo || {}
    };

    const logLine = JSON.stringify(logEntry) + '\n';
    await fs.appendFile(this.logPath, logLine);
  }
}

export const auditLogger = new AuditLogger();
```

2. **Add audit middleware:**
```javascript
// src/middleware/audit-middleware.js
import { auditLogger } from '../utils/audit-logger.js';

export function auditMiddleware() {
  return async (req, res, next) => {
    const startTime = Date.now();
    
    // Override res.json to capture response
    const originalJson = res.json;
    res.json = function(body) {
      const responseTime = Date.now() - startTime;
      
      // Log the request
      auditLogger.log('http_request', {
        user: req.user?.username || 'anonymous',
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        resource: req.path,
        action: req.method,
        result: res.statusCode < 400 ? 'success' : 'failure',
        additionalInfo: {
          responseTime: responseTime,
          statusCode: res.statusCode
        }
      });
      
      return originalJson.call(this, body);
    };
    
    next();
  };
}
```

### 3.2 Environment Configuration

**Solution Steps:**

1. **Create `.env.example`:**
```bash
# .env.example
NODE_ENV=production
PORT=3000
HEALTH_PORT=3001
SESSION_SECRET=your-super-secure-secret-here-change-this
LOG_LEVEL=info
MAX_FILE_SIZE=100MB
ALLOWED_ORIGINS=https://yourdomain.com
```

2. **Update package.json:**
```json
{
  "scripts": {
    "start": "node src/orchestrator.js",
    "start:secure": "NODE_ENV=production node src/orchestrator.js",
    "security-check": "npm audit && node scripts/security-check.js"
  }
}
```

3. **Create security check script:**
```javascript
// scripts/security-check.js
import fs from 'fs';
import path from 'path';

console.log('🔒 Running security checks...');

const checks = [
  {
    name: 'Environment variables',
    check: () => process.env.SESSION_SECRET && process.env.SESSION_SECRET !== 'change-this-secret-in-production',
    message: 'SESSION_SECRET must be set and changed from default'
  },
  {
    name: 'Production mode',
    check: () => process.env.NODE_ENV === 'production',
    message: 'NODE_ENV should be set to production'
  },
  {
    name: 'HTTPS configuration',
    check: () => process.env.HTTPS === 'true' || process.env.NODE_ENV !== 'production',
    message: 'HTTPS should be enabled in production'
  }
];

let passed = 0;
let failed = 0;

checks.forEach(({ name, check, message }) => {
  if (check()) {
    console.log(`✅ ${name}: PASS`);
    passed++;
  } else {
    console.log(`❌ ${name}: FAIL - ${message}`);
    failed++;
  }
});

console.log(`\n📊 Security check results: ${passed} passed, ${failed} failed`);

if (failed > 0) {
  process.exit(1);
}
```

## Deployment Security Checklist

### Pre-Deployment

- [ ] All critical and high-priority fixes implemented
- [ ] Security headers configured
- [ ] Authentication system enabled
- [ ] Input validation implemented
- [ ] Rate limiting configured
- [ ] Audit logging enabled
- [ ] Environment variables properly set
- [ ] Security check script passes

### Production Configuration

- [ ] HTTPS enabled
- [ ] Secure session configuration
- [ ] File upload limits set
- [ ] Error messages sanitized
- [ ] Logging configured for production
- [ ] Database credentials secured
- [ ] API keys stored securely

### Monitoring

- [ ] Security monitoring enabled
- [ ] Log analysis configured
- [ ] Intrusion detection ready
- [ ] Performance monitoring active
- [ ] Backup procedures tested

## Testing Security Fixes

### Manual Testing

1. **Authentication Testing:**
```bash
# Test login without credentials
curl -X POST http://localhost:3000/login

# Test protected endpoint without auth
curl http://localhost:3000/api/data

# Test with valid credentials
curl -X POST http://localhost:3000/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"secure_password_123!"}'
```

2. **XSS Testing:**
```bash
# Test with malicious input
curl -X POST http://localhost:3000/api/test \
  -H "Content-Type: application/json" \
  -d '{"location":"<script>alert(1)</script>"}'
```

3. **Rate Limiting Testing:**
```bash
# Test rate limiting
for i in {1..10}; do
  curl -X POST http://localhost:3000/login &
done
```

### Automated Testing

1. **Create security test suite:**
```javascript
// test/security.test.js
import { test } from 'node:test';
import assert from 'node:assert';
import { HTMLSanitizer } from '../src/utils/html-sanitizer.js';

test('HTML sanitization prevents XSS', () => {
  const maliciousInput = '<script>alert("xss")</script>';
  const sanitized = HTMLSanitizer.escapeHtml(maliciousInput);
  assert.strictEqual(sanitized, '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
});

test('Path validation prevents traversal', () => {
  const { SecureCommandExecutor } = require('../src/utils/secure-command.js');
  assert.throws(() => {
    SecureCommandExecutor.validatePath('../../../etc/passwd');
  });
});
```

## Maintenance

### Regular Security Tasks

1. **Weekly:**
   - Review audit logs
   - Check for failed authentication attempts
   - Monitor system resources

2. **Monthly:**
   - Run dependency audit (`npm audit`)
   - Review and rotate session secrets
   - Update security policies

3. **Quarterly:**
   - Conduct penetration testing
   - Review access controls
   - Update security documentation

### Updates and Patches

1. **Monitor security advisories:**
   - Subscribe to Node.js security updates
   - Monitor npm package vulnerabilities
   - Follow Express.js security announcements

2. **Update process:**
   - Test updates in staging environment
   - Review dependency changes
   - Update security configurations as needed

---

**Important Notes:**
- Implement changes in order of priority
- Test all changes in a staging environment first
- Keep backups before making security changes
- Document all security configurations
- Train team members on new security procedures

This guide provides a comprehensive approach to securing the Shortwave Monitor System. For additional security consulting or implementation assistance, contact your security team.