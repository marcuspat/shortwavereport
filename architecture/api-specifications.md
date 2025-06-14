# 📡 Shortwave Monitor API Specifications

## API Architecture Overview

The Shortwave Monitor system exposes both internal agent APIs for coordination and external REST APIs for dashboard integration. This document details all API interfaces, data schemas, and communication protocols.

## 🔄 Internal Agent APIs

### Memory Manager API

#### Memory Storage Operations

```javascript
// Store data in memory
await memory.store(key: string, data: any) -> boolean

// Query data from memory  
await memory.query(key: string) -> any | null

// Check if key exists
await memory.exists(key: string) -> boolean

// Wait for key availability
await memory.waitFor(key: string, timeoutMs: number) -> any

// Signal completion to other agents
await memory.signal(signal: string, data: object) -> boolean

// List all memory keys
await memory.list() -> string[]
```

#### Memory Schema

```json
{
  "memoryEntry": {
    "key": "string",
    "data": "any",
    "timestamp": "ISO8601",
    "namespace": "shortwave_monitor"
  }
}
```

### SPARC Orchestrator API

#### Agent Execution Interface

```javascript
class SPARCOrchestrator {
  // Main orchestration workflow
  async execute() -> CompletionReport
  
  // Phase execution methods
  async executePhase1() -> void  // SDR Discovery
  async executePhase2() -> void  // Audio Capture  
  async executePhase3() -> void  // Audio Analysis
  async executePhase4() -> void  // Report Generation
  
  // System lifecycle
  async initializeSystem() -> void
  async finalValidation() -> void
  async shutdown() -> void
}
```

#### Completion Report Schema

```json
{
  "status": "MISSION_COMPLETED",
  "execution_time": "number (seconds)",
  "dashboard_url": "string",
  "summary": {
    "sdrs_discovered": "number",
    "samples_captured": "number", 
    "analyses_completed": "number",
    "report_generated": "boolean"
  },
  "phases_completed": "number",
  "agents_executed": "number",
  "execution_log": "ExecutionLogEntry[]"
}
```

## 🕷️ Agent-Specific APIs

### 1. SDR Discovery Agent API

#### Interface
```javascript
class SDRDiscoveryAgent {
  async execute() -> SDRResult[]
  async discoverWebSDRs() -> SDRResult[]
  async discoverKiwiSDRs() -> SDRResult[]
  async discoverOpenWebRX() -> SDRResult[]
  async scoreSDRs() -> void
}
```

#### SDR Result Schema
```json
{
  "sdr": {
    "url": "string",
    "location": "string",
    "frequencies": "string[]",
    "quality_score": "number (0-100)",
    "last_checked": "ISO8601",
    "network": "WebSDR|KiwiSDR|OpenWebRX",
    "response_time": "number (ms)",
    "status": "online|offline",
    "error": "string (optional)"
  }
}
```

#### Memory Signals
```json
{
  "active_sdrs": "SDRResult[]",
  "sdr_ready": {
    "count": "number",
    "timestamp": "ISO8601"
  }
}
```

### 2. Audio Capture Agent API

#### Interface
```javascript
class AudioCaptureAgent {
  async execute() -> AudioSample[]
  async captureHFVoice(sdr: SDRResult) -> AudioSample
  async captureBroadcast(sdr: SDRResult) -> AudioSample
  async captureCW(sdr: SDRResult) -> AudioSample
  async captureUtility(sdr: SDRResult) -> AudioSample
  async processAudioFiles() -> void
}
```

#### Audio Sample Schema
```json
{
  "audioSample": {
    "id": "string",
    "filename": "string", 
    "filepath": "string",
    "processed_filepath": "string (optional)",
    "sdr": "SDRResult",
    "config": {
      "frequency": "number (Hz)",
      "bandwidth": "number (Hz)",
      "mode": "usb|am|cw",
      "type": "hf_voice|broadcast|cw_digital|utility",
      "description": "string"
    },
    "metadata": {
      "frequency": "number",
      "mode": "string",
      "bandwidth": "number",
      "duration": "number (seconds)",
      "sampleRate": "number",
      "timestamp": "ISO8601",
      "quality_estimate": "number (0-100)"
    },
    "processed": "boolean",
    "error": "string (optional)"
  }
}
```

#### Memory Signals
```json
{
  "audio_samples": "AudioSample[]",
  "capture_complete": {
    "count": "number",
    "timestamp": "ISO8601"
  }
}
```

### 3. Audio Analysis Agent API

#### Interface
```javascript
class AudioAnalysisAgent {
  async execute() -> AnalysisResult[]
  async analyzeSample(sample: AudioSample) -> AnalysisResult
  async analyzeVoice(sample: AudioSample) -> AnalysisData
  async analyzeBroadcast(sample: AudioSample) -> AnalysisData
  async analyzeCWDigital(sample: AudioSample) -> AnalysisData
  async analyzeUtility(sample: AudioSample) -> AnalysisData
}
```

#### Analysis Result Schema
```json
{
  "analysisResult": {
    "sample_id": "string",
    "filename": "string",
    "metadata": "AudioMetadata",
    "analysis_results": {
      "content_type": "voice|cw|digital|broadcast|noise|unknown",
      "language": "string|unknown",
      "transcription": "string",
      "stations": "string[]",
      "quality_score": "number (0-100)",
      "timestamp": "ISO8601",
      "confidence": "number (0-100)",
      "error": "string (optional)"
    }
  }
}
```

#### Memory Signals
```json
{
  "analysis_results": "AnalysisResult[]",
  "analysis_complete": {
    "count": "number", 
    "timestamp": "ISO8601"
  }
}
```

### 4. Report Generator Agent API

#### Interface
```javascript
class ReportGeneratorAgent {
  async execute() -> ReportResult
  async aggregateData() -> void
  async generateReportComponents() -> void
  async buildDashboard() -> string (HTML)
  async deployReport() -> string (URL)
  shutdown() -> void
}
```

#### Report Result Schema
```json
{
  "reportResult": {
    "url": "string",
    "data": {
      "timestamp": "ISO8601",
      "activeSDRs": "SDRResult[]",
      "audioSamples": "AudioSample[]", 
      "analysisResults": "AnalysisResult[]",
      "summary": "ExecutiveSummary",
      "coverage": "CoverageData",
      "analysis": "AnalysisSummary",
      "audioSamples": "PreparedAudioSample[]"
    }
  }
}
```

#### Memory Signals
```json
{
  "report_data": "ReportData",
  "report_ready": {
    "url": "string",
    "timestamp": "ISO8601",
    "summary": "ExecutiveSummary"
  }
}
```

## 🌐 External REST API

### Base URL
```
http://localhost:3000
```

### Endpoints

#### 1. Dashboard Endpoint
```http
GET /
```
**Response**: HTML dashboard page

#### 2. Data API Endpoint
```http
GET /api/data
```
**Response**: Complete report data
```json
{
  "timestamp": "ISO8601",
  "activeSDRs": "SDRResult[]",
  "audioSamples": "AudioSample[]",
  "analysisResults": "AnalysisResult[]", 
  "summary": {
    "totalSDRs": "number",
    "totalSamples": "number",
    "totalAnalyses": "number",
    "keyFindings": "string[]",
    "notableActivity": "NotableActivity[]",
    "coverageAreas": "string[]",
    "detectedLanguages": "string[]",
    "stationCount": "number",
    "qualityScore": "number"
  },
  "coverage": {
    "totalLocations": "number",
    "regions": "RegionData",
    "networkDistribution": "Record<string, number>",
    "qualityDistribution": "Record<string, number>"
  },
  "analysis": {
    "contentTypes": "Record<string, number>",
    "languages": "Record<string, number>",
    "averageConfidence": "number",
    "stationsByType": "Record<string, string[]>",
    "trends": "any[]"
  }
}
```

#### 3. Audio Files Endpoint
```http
GET /data/audio/{filename}
```
**Response**: Audio file (WAV format)
**Headers**: 
```
Content-Type: audio/wav
Content-Disposition: inline; filename="{filename}"
```

#### 4. Health Check Endpoint
```http
GET /api/health
```
**Response**:
```json
{
  "status": "healthy",
  "timestamp": "ISO8601",
  "uptime": "number (seconds)",
  "memory": "MemoryUsage",
  "agents": {
    "sdr_discovery": "active|idle|error",
    "audio_capture": "active|idle|error", 
    "audio_analysis": "active|idle|error",
    "report_generator": "active|idle|error"
  }
}
```

## 📡 WebSocket API (Future Enhancement)

### Real-time Updates
```javascript
// Connect to WebSocket
const ws = new WebSocket('ws://localhost:3000/ws');

// Message Types
{
  "type": "sdr_discovered",
  "data": "SDRResult"
}

{
  "type": "audio_captured", 
  "data": "AudioSample"
}

{
  "type": "analysis_complete",
  "data": "AnalysisResult"
}

{
  "type": "report_updated",
  "data": "ReportData"
}
```

## 🔒 Authentication & Security

### Current Security Model
- **Public Access**: Dashboard and API are publicly accessible on localhost
- **Network Security**: Only accesses public WebSDR instances
- **Data Security**: No sensitive data persistence

### Future Security Enhancements
```http
Authorization: Bearer <jwt_token>
```

#### JWT Token Structure
```json
{
  "header": {
    "alg": "HS256",
    "typ": "JWT"
  },
  "payload": {
    "sub": "user_id",
    "iat": "timestamp",
    "exp": "timestamp",
    "scope": "read|write|admin"
  }
}
```

## 📊 Error Handling

### Error Response Schema
```json
{
  "error": {
    "code": "string",
    "message": "string", 
    "details": "object (optional)",
    "timestamp": "ISO8601",
    "request_id": "string"
  }
}
```

### Common Error Codes
- `SDR_DISCOVERY_FAILED`: SDR network discovery failed
- `AUDIO_CAPTURE_FAILED`: Audio capture process failed
- `ANALYSIS_FAILED`: Audio analysis process failed
- `MEMORY_TIMEOUT`: Memory operation timed out
- `REPORT_GENERATION_FAILED`: Report generation failed

## 🔄 API Versioning

### Version Header
```http
API-Version: v1
```

### Backward Compatibility
- v1: Current implementation
- v2: Planned enhancements with authentication
- v3: Planned real-time WebSocket integration

## 📈 Rate Limiting

### Current Limits
- **Dashboard**: No limits (localhost only)
- **API Endpoints**: No limits (localhost only)

### Future Rate Limiting
```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 99
X-RateLimit-Reset: 1640995200
```

## 🧪 API Testing

### Testing Endpoints
```bash
# Health check
curl http://localhost:3000/api/health

# Get complete data
curl http://localhost:3000/api/data

# Test dashboard
curl http://localhost:3000/
```

### Integration Testing
```javascript
// Example test suite
describe('Shortwave Monitor API', () => {
  test('GET /api/health returns 200', async () => {
    const response = await fetch('http://localhost:3000/api/health');
    expect(response.status).toBe(200);
  });
  
  test('GET /api/data returns valid structure', async () => {
    const response = await fetch('http://localhost:3000/api/data');
    const data = await response.json();
    expect(data).toHaveProperty('summary');
    expect(data).toHaveProperty('coverage');
    expect(data).toHaveProperty('analysis');
  });
});
```

This API specification provides comprehensive documentation for all interfaces within the Shortwave Monitor system, enabling efficient development, integration, and maintenance.