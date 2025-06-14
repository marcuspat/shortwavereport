# System Architecture

## Overview

The Shortwave Monitor is built using the SPARC (Specification, Pseudocode, Architecture, Refinement, Completion) methodology with a distributed agent-based architecture. The system coordinates multiple specialized agents through a central orchestrator to provide comprehensive shortwave radio intelligence gathering capabilities.

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────┐
│                SPARC Orchestrator                       │
│           (Central Coordination Layer)                  │
├─────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐     │
│  │   Memory    │  │   Health    │  │  Execution  │     │
│  │  Manager    │  │   Monitor   │  │    Logger   │     │
│  └─────────────┘  └─────────────┘  └─────────────┘     │
└─────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│                  Agent Layer                            │
├─────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐     │
│  │     SDR     │  │    Audio    │  │    Audio    │     │
│  │  Discovery  │  │   Capture   │  │  Analysis   │     │
│  │    Agent    │  │    Agent    │  │    Agent    │     │
│  └─────────────┘  └─────────────┘  └─────────────┘     │
│                                                         │
│  ┌─────────────┐                                       │
│  │   Report    │                                       │
│  │ Generator   │                                       │
│  │    Agent    │                                       │
│  └─────────────┘                                       │
└─────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│                External Systems                         │
├─────────────────────────────────────────────────────────┤
│  WebSDR Network  │  KiwiSDR Network  │  OpenWebRX      │
│  ┌─────────────┐  │  ┌─────────────┐  │  ┌─────────────┐│
│  │   Receiver  │  │  │   Receiver  │  │  │   Receiver  ││
│  │   Receiver  │  │  │   Receiver  │  │  │   Receiver  ││
│  │   Receiver  │  │  │   Receiver  │  │  │   Receiver  ││
│  └─────────────┘  │  └─────────────┘  │  └─────────────┘│
└─────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│                   Output Layer                          │
├─────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐     │
│  │ Web Server  │  │  REST API   │  │  WebSocket  │     │
│  │(Dashboard)  │  │ Endpoints   │  │   Updates   │     │
│  └─────────────┘  └─────────────┘  └─────────────┘     │
└─────────────────────────────────────────────────────────┘
```

## Core Components

### 1. SPARC Orchestrator (`src/orchestrator.js`)

The central coordination component that implements the SPARC methodology workflow.

**Responsibilities:**
- Manages the 5-phase SPARC execution cycle
- Coordinates agent communication through memory manager
- Provides health monitoring and metrics collection
- Handles graceful startup and shutdown
- Implements parallel execution patterns

**Key Features:**
- Health check endpoints (`/health`, `/ready`, `/live`)
- Metrics collection and reporting
- Execution logging and status tracking
- Agent lifecycle management
- Error handling and recovery

```javascript
class SPARCOrchestrator {
  constructor() {
    this.memory = new MemoryManager();
    this.agents = {
      sdrDiscovery: new SDRDiscoveryAgent(),
      audioCapture: new AudioCaptureAgent(),
      audioAnalysis: new AudioAnalysisAgent(),
      reportGenerator: new ReportGeneratorAgent()
    };
  }
  
  async execute() {
    // 5-phase SPARC workflow
    await this.phase1_specification();
    await this.phase2_pseudocode();
    await this.phase3_architecture();
    await this.phase4_refinement();
    await this.phase5_completion();
  }
}
```

### 2. Memory Manager (`src/memory/memory-manager.js`)

Inter-agent communication and state persistence system.

**Architecture:**
```
┌─────────────────────────────────────────┐
│           Memory Manager                │
├─────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐      │
│  │ Namespaced  │  │   Signal    │      │
│  │   Storage   │  │  Handling   │      │
│  └─────────────┘  └─────────────┘      │
│                                         │
│  ┌─────────────┐  ┌─────────────┐      │
│  │   Timeout   │  │ Encryption  │      │
│  │  Management │  │  (Optional) │      │
│  └─────────────┘  └─────────────┘      │
└─────────────────────────────────────────┘
```

**Key Methods:**
- `store(namespace, key, data)`: Store data with namespace isolation
- `query(namespace, key)`: Retrieve data by namespace/key
- `waitFor(namespace, signal, timeout)`: Wait for inter-agent signals
- `signal(namespace, signal, data)`: Send signals between agents

### 3. Agent Layer

#### SDR Discovery Agent (`src/agents/sdr-discovery.js`)

Discovers and evaluates available SDR receivers across multiple networks.

**Discovery Process:**
```
WebSDR.org ─┐
            ├── Parallel Scanning ──► Quality Scoring ──► Active SDR List
KiwiSDR.com ─┤
            └── Response Time ────► Geographic Mapping
OpenWebRX ───┘    Testing
```

**Quality Scoring Factors:**
- Response time (< 5 seconds preferred)
- Accessibility (HTTP 200 response)
- Geographic diversity
- Network stability

#### Audio Capture Agent (`src/agents/audio-capture.js`)

Captures audio samples from selected SDR receivers across multiple frequency bands.

**Capture Architecture:**
```
┌─────────────────────────────────────────┐
│         Audio Capture Pipeline          │
├─────────────────────────────────────────┤
│  SDR Selection ──► Frequency Tuning     │
│                                         │
│  ┌─────────────┐  ┌─────────────┐      │
│  │  HF Voice   │  │  Broadcast  │      │
│  │14.2-14.35MHz│  │  9-12 MHz   │      │
│  └─────────────┘  └─────────────┘      │
│                                         │
│  ┌─────────────┐  ┌─────────────┐      │
│  │ CW/Digital  │  │   Utility   │      │
│  │14.0-14.07MHz│  │  8-12 MHz   │      │
│  └─────────────┘  └─────────────┘      │
│                                         │
│         ▼                               │
│  ┌─────────────────────────────────┐   │
│  │      FFmpeg Processing         │   │
│  │   WAV Format, 44.1kHz, Mono    │   │
│  └─────────────────────────────────┘   │
└─────────────────────────────────────────┘
```

**Frequency Bands:**
- **HF Voice**: 14.2-14.35 MHz (Amateur radio voice communications)
- **Broadcast**: 9-12 MHz (International shortwave broadcast)
- **CW/Digital**: 14.0-14.07 MHz (Morse code and digital modes)
- **Utility**: 8-12 MHz (Utility stations and data transmissions)

#### Audio Analysis Agent (`src/agents/audio-analysis.js`)

Processes captured audio using AI-powered analysis techniques.

**Analysis Pipeline:**
```
Audio File ──► Content Classification ──► Speech Processing
    │                    │                       │
    │                    ▼                       ▼
    │             ┌─────────────┐        ┌─────────────┐
    │             │    Voice    │        │Speech-to-Text│
    │             │     CW      │        │   (STT)     │
    │             │   Digital   │        └─────────────┘
    │             │  Broadcast  │                │
    │             │    Noise    │                ▼
    │             └─────────────┘        ┌─────────────┐
    │                                    │  Language   │
    │                                    │ Detection   │
    │                                    └─────────────┘
    │                                            │
    ▼                                            ▼
┌─────────────┐                          ┌─────────────┐
│   Station   │                          │  Confidence │
│Identification│                         │   Scoring   │
│ (Callsigns, │                          └─────────────┘
│ Broadcasters)│
└─────────────┘
```

**Analysis Capabilities:**
- Content type classification
- Speech-to-text transcription
- Language detection (multi-language support)
- Amateur radio callsign extraction
- Broadcast station identification
- CW/Morse code decoding
- Digital mode detection (PSK31, FT8, RTTY)
- Confidence scoring for all results

#### Report Generator Agent (`src/agents/report-generator.js`)

Creates interactive web dashboard and intelligence reports.

**Report Architecture:**
```
┌─────────────────────────────────────────┐
│         Report Generation Pipeline      │
├─────────────────────────────────────────┤
│  Data Aggregation ──► Template Engine  │
│                                         │
│  ┌─────────────┐    ┌─────────────┐    │
│  │   SDR Data  │    │ Executive   │    │
│  │ Audio Data  │───►│  Summary    │    │
│  │Analysis Data│    │ Generation  │    │
│  └─────────────┘    └─────────────┘    │
│                                         │
│        ▼                                │
│  ┌─────────────────────────────────┐   │
│  │    Interactive Dashboard        │   │
│  │   - Geographic visualization    │   │
│  │   - Audio playback interface    │   │
│  │   - Content analysis charts     │   │
│  │   - Real-time status updates    │   │
│  └─────────────────────────────────┘   │
│                                         │
│        ▼                                │
│  ┌─────────────────────────────────┐   │
│  │      Web Server Deployment      │   │
│  │     Express.js + Static Files   │   │
│  └─────────────────────────────────┘   │
└─────────────────────────────────────────┘
```

## Data Flow Architecture

### 1. Discovery Phase
```
Internet ──► WebSDR Networks ──► Quality Assessment ──► Active SDR List
                                                             │
                                                             ▼
                                                    Memory Storage
                                                   (namespace: sdr-discovery)
```

### 2. Capture Phase
```
Active SDR List ──► Parallel Audio Capture ──► FFmpeg Processing ──► Audio Files
                                                                           │
                                                                           ▼
                                                                    File System
                                                                   (/data/audio/)
```

### 3. Analysis Phase
```
Audio Files ──► AI Processing ──► Content Classification ──► Analysis Results
                                                                     │
                                                                     ▼
                                                             Memory Storage
                                                           (namespace: analysis)
```

### 4. Report Phase
```
All Data Sources ──► Aggregation ──► Dashboard Generation ──► Web Server
                                                                    │
                                                                    ▼
                                                            HTTP Server
                                                           (Port 3000)
```

## Communication Patterns

### Agent Coordination
The system uses multiple communication patterns for agent coordination:

#### 1. Promise-Based Parallel Execution
```javascript
const results = await Promise.allSettled([
  agents.sdrDiscovery.execute(),
  agents.audioCapture.execute(),
  agents.audioAnalysis.execute(),
  agents.reportGenerator.execute()
]);
```

#### 2. Signal-Based Synchronization
```javascript
// Agent A signals completion
await memory.signal('orchestrator', 'sdr-discovery-complete', results);

// Agent B waits for signal
await memory.waitFor('orchestrator', 'sdr-discovery-complete', 30000);
```

#### 3. Shared Memory Communication
```javascript
// Store shared data
await memory.store('shared', 'active-sdrs', sdrList);

// Access shared data
const sdrs = await memory.query('shared', 'active-sdrs');
```

### Error Handling Strategy

```
┌─────────────────────────────────────────┐
│            Error Handling               │
├─────────────────────────────────────────┤
│  Agent Level    ──► Local Error Handling │
│                     + Graceful Degradation│
│                                         │
│  Memory Level   ──► Timeout Management   │
│                     + Retry Logic        │
│                                         │
│  Orchestrator   ──► Global Error Handling│
│  Level              + System Recovery    │
│                                         │
│  System Level   ──► Health Monitoring    │
│                     + Automatic Restart  │
└─────────────────────────────────────────┘
```

## Performance Architecture

### Concurrency Model
- **Single-threaded Node.js** with event-driven architecture
- **Parallel agent execution** using Promise.allSettled()
- **Non-blocking I/O** for network operations
- **Streaming audio processing** to minimize memory usage

### Memory Management
- **Namespaced storage** to prevent data conflicts
- **Automatic cleanup** of temporary audio files
- **Configurable memory limits** with health monitoring
- **Efficient data serialization** using JSON

### Scalability Patterns
```
┌─────────────────────────────────────────┐
│           Scalability Design            │
├─────────────────────────────────────────┤
│  Horizontal:  Multiple SDR Sources      │
│               Parallel Processing       │
│               Load Distribution         │
│                                         │
│  Vertical:    Memory Optimization       │
│               CPU Utilization           │
│               I/O Efficiency            │
│                                         │
│  Elastic:     Dynamic Resource Scaling  │
│               Auto-scaling Triggers     │
│               Performance Monitoring    │
└─────────────────────────────────────────┘
```

## Security Architecture

### Data Protection
- **Local processing only** - no cloud dependencies
- **Temporary file management** - automatic cleanup
- **Memory encryption** (optional) for sensitive data
- **No persistent storage** of intercepted communications

### Network Security
- **Read-only access** to public SDR instances
- **No authentication requirements** for public receivers
- **Rate limiting** to prevent abuse
- **IP whitelisting** support for production deployments

### Privacy Compliance
- **No personal data collection**
- **Anonymized processing**
- **Local data retention** with configurable cleanup
- **GDPR-compliant by design**

## Monitoring and Observability

### Health Monitoring
```
┌─────────────────────────────────────────┐
│         Health Check Architecture       │
├─────────────────────────────────────────┤
│  /health    ──► Overall system health   │
│  /ready     ──► Readiness for requests  │
│  /live      ──► Liveness probe          │
│  /metrics   ──► Performance metrics     │
│  /status    ──► Comprehensive status    │
└─────────────────────────────────────────┘
```

### Metrics Collection
- **System metrics**: CPU, memory, uptime
- **Agent metrics**: Execution times, success rates
- **Business metrics**: SDR counts, capture success, analysis accuracy
- **Error metrics**: Failure rates, timeout counts

### Logging Strategy
```
┌─────────────────────────────────────────┐
│            Logging Architecture         │
├─────────────────────────────────────────┤
│  Application ──► Structured JSON logs   │
│  Agents      ──► Component-specific logs │
│  Orchestrator──► Execution flow logs    │
│  System      ──► Error and debug logs   │
│                                         │
│        All logs ──► Log aggregation     │
│                     File rotation       │
│                     Remote shipping     │
└─────────────────────────────────────────┘
```

## Deployment Architecture

### Container Architecture
```
┌─────────────────────────────────────────┐
│              Docker Container           │
├─────────────────────────────────────────┤
│  ┌─────────────────────────────────┐   │
│  │       Application Layer         │   │
│  │    (Node.js + Dependencies)     │   │
│  └─────────────────────────────────┘   │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │         Runtime Layer           │   │
│  │       (FFmpeg + System)         │   │
│  └─────────────────────────────────┘   │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │         Base OS Layer           │   │
│  │        (Alpine Linux)           │   │
│  └─────────────────────────────────┘   │
└─────────────────────────────────────────┘
```

### Production Architecture
```
┌─────────────────────────────────────────┐
│            Load Balancer                │
├─────────────────────────────────────────┤
│                    │                    │
│                    ▼                    │
│  ┌─────────────────────────────────┐   │
│  │         Reverse Proxy           │   │
│  │      (Nginx + SSL/TLS)          │   │
│  └─────────────────────────────────┘   │
│                    │                    │
│                    ▼                    │
│  ┌─────────────────────────────────┐   │
│  │      Application Instances      │   │
│  │      (PM2 + Node.js Apps)       │   │
│  └─────────────────────────────────┘   │
│                    │                    │
│                    ▼                    │
│  ┌─────────────────────────────────┐   │
│  │       Monitoring Stack          │   │
│  │   (Prometheus + Grafana)        │   │
│  └─────────────────────────────────┘   │
└─────────────────────────────────────────┘
```

## Technology Stack

### Core Technologies
- **Runtime**: Node.js 18+ with ES Modules
- **Web Framework**: Express.js for REST API and static serving
- **Audio Processing**: FFmpeg for audio capture and conversion
- **Memory Management**: Custom JSON-based memory system
- **Networking**: node-fetch for HTTP clients, ws for WebSocket

### Development Technologies
- **Testing**: Custom test framework with TDD approach
- **Process Management**: PM2 for production deployment
- **Containerization**: Docker with multi-stage builds
- **Monitoring**: Built-in health checks and metrics

### External Dependencies
- **WebSDR Networks**: Public shortwave receiver networks
- **KiwiSDR Systems**: Global KiwiSDR receiver network
- **OpenWebRX**: Open-source WebSDR implementations

This architecture provides a robust, scalable, and maintainable foundation for comprehensive shortwave radio intelligence gathering while maintaining strong security and privacy standards.