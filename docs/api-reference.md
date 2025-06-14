# API Reference

## Overview

The Shortwave Monitor provides both internal agent APIs and external REST endpoints for accessing intelligence data and system status.

## OpenAPI Specification

```yaml
openapi: 3.0.3
info:
  title: Shortwave Monitor API
  description: AI-powered shortwave radio intelligence system
  version: 1.0.0
  contact:
    name: API Support
    url: https://github.com/shortwavereport/issues
servers:
  - url: http://localhost:3000
    description: Local development server
paths:
  /:
    get:
      summary: Interactive Dashboard
      description: Returns the main HTML dashboard interface
      responses:
        '200':
          description: HTML dashboard page
          content:
            text/html:
              schema:
                type: string
  /api/data:
    get:
      summary: Intelligence Data
      description: Returns complete aggregated intelligence data
      responses:
        '200':
          description: Intelligence data response
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/IntelligenceData'
        '500':
          description: Server error
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Error'
  /data/audio/{filename}:
    get:
      summary: Audio File Access
      description: Serves captured audio files
      parameters:
        - name: filename
          in: path
          required: true
          description: Audio filename with extension
          schema:
            type: string
            example: "sample_14_2_MHz.wav"
      responses:
        '200':
          description: Audio file
          content:
            audio/wav:
              schema:
                type: string
                format: binary
        '404':
          description: Audio file not found
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Error'
components:
  schemas:
    IntelligenceData:
      type: object
      properties:
        timestamp:
          type: string
          format: date-time
          description: Data collection timestamp
        summary:
          $ref: '#/components/schemas/Summary'
        sdrs:
          type: array
          items:
            $ref: '#/components/schemas/SDRReceiver'
        captures:
          type: array
          items:
            $ref: '#/components/schemas/AudioCapture'
        analysis:
          type: array
          items:
            $ref: '#/components/schemas/AnalysisResult'
    Summary:
      type: object
      properties:
        total_sdrs:
          type: integer
          description: Number of SDR receivers discovered
        total_captures:
          type: integer
          description: Number of audio samples captured
        analysis_results:
          type: integer
          description: Number of analysis results generated
        execution_time:
          type: string
          description: Total execution time
    SDRReceiver:
      type: object
      properties:
        url:
          type: string
          format: uri
          description: SDR receiver URL
        location:
          type: string
          description: Geographic location
        quality_score:
          type: number
          format: float
          minimum: 0
          maximum: 1
          description: Quality score (0-1)
        network_type:
          type: string
          enum: [websdr, kiwisdr, openwebrx]
          description: SDR network type
        status:
          type: string
          enum: [active, inactive, error]
          description: Current status
    AudioCapture:
      type: object
      properties:
        filename:
          type: string
          description: Audio file name
        sdr_url:
          type: string
          format: uri
          description: Source SDR receiver URL
        frequency:
          type: number
          format: float
          description: Capture frequency in MHz
        band:
          type: string
          enum: [hf_voice, broadcast, cw_digital, utility]
          description: Frequency band category
        duration:
          type: integer
          description: Capture duration in seconds
        quality_estimate:
          type: number
          format: float
          minimum: 0
          maximum: 1
          description: Audio quality estimate
        timestamp:
          type: string
          format: date-time
          description: Capture timestamp
    AnalysisResult:
      type: object
      properties:
        filename:
          type: string
          description: Source audio filename
        content_type:
          type: string
          enum: [voice, cw, digital, broadcast, noise, silence]
          description: Detected content type
        transcription:
          type: string
          nullable: true
          description: Speech-to-text result
        language:
          type: string
          nullable: true
          description: Detected language
        callsigns:
          type: array
          items:
            type: string
          description: Extracted amateur radio callsigns
        stations:
          type: array
          items:
            type: string
          description: Identified broadcast stations
        confidence:
          type: number
          format: float
          minimum: 0
          maximum: 1
          description: Analysis confidence score
        metadata:
          type: object
          description: Additional analysis metadata
    Error:
      type: object
      properties:
        error:
          type: string
          description: Error message
        code:
          type: integer
          description: Error code
        timestamp:
          type: string
          format: date-time
          description: Error timestamp
```

## Internal Agent APIs

### Memory Manager API

The memory manager provides inter-agent communication capabilities:

#### Methods

```javascript
// Store data with namespace
await memory.store(namespace, key, data)

// Query data by namespace and key
const data = await memory.query(namespace, key)

// Check if key exists
const exists = await memory.exists(namespace, key)

// Wait for signal from another agent
await memory.waitFor(namespace, signal, timeout)

// Send signal to other agents
await memory.signal(namespace, signal, data)
```

#### Example Usage

```javascript
// Store SDR discovery results
await memory.store('sdr-discovery', 'active-sdrs', sdrList)

// Signal completion to other agents
await memory.signal('orchestrator', 'sdr-discovery-complete', {
  count: sdrList.length,
  timestamp: new Date().toISOString()
})

// Wait for audio capture completion
const captureResults = await memory.waitFor('audio-capture', 'complete', 30000)
```

### Agent Coordination API

Agents coordinate through the SPARC orchestrator using promises:

#### Agent Interface

```javascript
class Agent {
  constructor(name, memory) {
    this.name = name
    this.memory = memory
  }

  async execute(params) {
    // Agent-specific logic
    return results
  }

  async cleanup() {
    // Cleanup resources
  }
}
```

#### Orchestrator Patterns

```javascript
// Parallel execution
const results = await Promise.allSettled([
  agents.sdrDiscovery.execute(),
  agents.audioCapture.execute(),
  agents.audioAnalysis.execute(),
  agents.reportGenerator.execute()
])

// Sequential execution with dependency handling
await agents.sdrDiscovery.execute()
await memory.waitFor('sdr-discovery', 'complete', 30000)
await agents.audioCapture.execute()
```

## REST API Endpoints

### GET /

Returns the interactive HTML dashboard.

**Response**: HTML page with embedded JavaScript for real-time updates

### GET /api/data

Returns complete intelligence data in JSON format.

**Response Example**:
```json
{
  "timestamp": "2024-01-15T10:30:00Z",
  "summary": {
    "total_sdrs": 15,
    "total_captures": 60,
    "analysis_results": 45,
    "execution_time": "3m 45s"
  },
  "sdrs": [
    {
      "url": "http://websdr.example.com:8901",
      "location": "Netherlands",
      "quality_score": 0.85,
      "network_type": "websdr",
      "status": "active"
    }
  ],
  "captures": [
    {
      "filename": "sample_14_2_MHz.wav",
      "sdr_url": "http://websdr.example.com:8901",
      "frequency": 14.2,
      "band": "hf_voice",
      "duration": 60,
      "quality_estimate": 0.78,
      "timestamp": "2024-01-15T10:25:00Z"
    }
  ],
  "analysis": [
    {
      "filename": "sample_14_2_MHz.wav",
      "content_type": "voice",
      "transcription": "CQ CQ CQ de G0ABC",
      "language": "English",
      "callsigns": ["G0ABC"],
      "stations": [],
      "confidence": 0.92,
      "metadata": {
        "signal_strength": "strong",
        "noise_level": "low"
      }
    }
  ]
}
```

### GET /data/audio/{filename}

Serves captured audio files.

**Parameters**:
- `filename` (path): Audio filename with extension

**Response**: Binary audio data (WAV format)

## Error Handling

All API endpoints return consistent error responses:

```json
{
  "error": "Description of the error",
  "code": 500,
  "timestamp": "2024-01-15T10:30:00Z"
}
```

### Common Error Codes

- `400`: Bad Request - Invalid parameters
- `404`: Not Found - Resource not found
- `500`: Internal Server Error - System error
- `503`: Service Unavailable - System busy or unavailable

## Rate Limiting

The API implements basic rate limiting:
- 100 requests per minute per IP address
- Audio file downloads: 10 per minute per IP address

## Authentication

Currently, no authentication is required for local development. For production deployments, consider implementing:

- API key authentication
- JWT token-based authentication
- IP whitelisting
- OAuth 2.0 integration

## WebSocket Support

Real-time updates are supported via WebSocket connections:

```javascript
const ws = new WebSocket('ws://localhost:3000')

ws.onmessage = (event) => {
  const update = JSON.parse(event.data)
  console.log('Real-time update:', update)
}
```

### WebSocket Message Types

- `sdr-discovery`: SDR discovery progress
- `audio-capture`: Audio capture status
- `analysis-complete`: Analysis results available
- `system-status`: Overall system status updates