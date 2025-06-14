# 📡 Shortwave Monitor System Architecture Overview

## System Architecture Overview

The Shortwave Monitor system is a comprehensive SPARC-based intelligence platform that automatically discovers WebSDR/KiwiSDR receivers, captures audio samples across HF frequencies, analyzes content using AI, and generates intelligence reports through an interactive web dashboard.

## 🏗️ High-Level Architecture

```mermaid
graph TB
    subgraph "External Networks"
        WebSDR[WebSDR Network]
        KiwiSDR[KiwiSDR Network]
        OpenWebRX[OpenWebRX Network]
    end

    subgraph "SPARC Orchestration Layer"
        Orchestrator[SPARC Orchestrator]
        Memory[Memory Manager]
    end

    subgraph "Agent Layer"
        SDRAgent[SDR Discovery Agent]
        AudioAgent[Audio Capture Agent]
        AnalysisAgent[Audio Analysis Agent]
        ReportAgent[Report Generator Agent]
    end

    subgraph "Processing Pipeline"
        SDRDisc[SDR Discovery]
        AudioCap[Audio Capture]
        AudioAnal[Audio Analysis]
        ReportGen[Report Generation]
    end

    subgraph "Data Storage"
        AudioData[(Audio Files)]
        AnalysisData[(Analysis Results)]
        MemoryData[(Memory Storage)]
        Reports[(Generated Reports)]
    end

    subgraph "Web Interface"
        Dashboard[Interactive Dashboard]
        API[REST API]
        WebServer[Express Server]
    end

    WebSDR --> SDRAgent
    KiwiSDR --> SDRAgent
    OpenWebRX --> SDRAgent

    Orchestrator --> SDRAgent
    Orchestrator --> AudioAgent
    Orchestrator --> AnalysisAgent
    Orchestrator --> ReportAgent

    SDRAgent --> Memory
    AudioAgent --> Memory
    AnalysisAgent --> Memory
    ReportAgent --> Memory

    SDRAgent --> SDRDisc
    AudioAgent --> AudioCap
    AnalysisAgent --> AudioAnal
    ReportAgent --> ReportGen

    SDRDisc --> AudioData
    AudioCap --> AudioData
    AudioAnal --> AnalysisData
    ReportGen --> Reports

    Memory --> MemoryData

    ReportAgent --> WebServer
    WebServer --> Dashboard
    WebServer --> API

    classDef external fill:#e1f5fe
    classDef orchestration fill:#f3e5f5
    classDef agent fill:#e8f5e8
    classDef processing fill:#fff3e0
    classDef storage fill:#fce4ec
    classDef web fill:#e0f2f1

    class WebSDR,KiwiSDR,OpenWebRX external
    class Orchestrator,Memory orchestration
    class SDRAgent,AudioAgent,AnalysisAgent,ReportAgent agent
    class SDRDisc,AudioCap,AudioAnal,ReportGen processing
    class AudioData,AnalysisData,MemoryData,Reports storage
    class Dashboard,API,WebServer web
```

## 🔄 SPARC Methodology Flow

```mermaid
sequenceDiagram
    participant O as SPARC Orchestrator
    participant S as SDR Discovery
    participant A as Audio Capture
    participant AN as Audio Analysis
    participant R as Report Generator
    participant M as Memory Manager
    participant D as Dashboard

    Note over O: Phase 1: Specification & Discovery
    O->>S: Execute SDR Discovery
    S->>M: Store active SDRs
    S->>O: Discovery Complete

    Note over O: Phase 2: Architecture & Implementation
    O->>A: Execute Audio Capture
    A->>M: Query active SDRs
    A->>M: Store audio samples
    A->>O: Capture Complete

    Note over O: Phase 3: Refinement & Analysis
    O->>AN: Execute Audio Analysis
    AN->>M: Query audio samples
    AN->>M: Store analysis results
    AN->>O: Analysis Complete

    Note over O: Phase 4: Completion & Delivery
    O->>R: Execute Report Generation
    R->>M: Query all data
    R->>D: Deploy Dashboard
    R->>O: Report Ready
```

## 🔧 Component Architecture

### 1. SDR Discovery Agent
**Purpose**: Identifies and monitors WebSDR/KiwiSDR receivers
- **Input**: WebSDR/KiwiSDR network endpoints
- **Output**: List of active, scored SDR receivers
- **Key Features**:
  - Parallel network scanning
  - Quality scoring based on accessibility and response time
  - Geographic location mapping
  - Network type classification

### 2. Audio Capture Agent
**Purpose**: Captures audio samples from selected SDR receivers
- **Input**: Active SDR list from discovery phase
- **Output**: Audio files with metadata
- **Key Features**:
  - Multi-frequency band capture (HF voice, broadcast, CW/digital, utility)
  - Parallel capture across multiple SDRs
  - Audio processing with FFmpeg
  - Quality estimation and metadata generation

### 3. Audio Analysis Agent
**Purpose**: Processes captured audio for intelligence extraction
- **Input**: Audio files from capture phase
- **Output**: Analysis results with transcriptions and classifications
- **Key Features**:
  - Content type classification (voice, CW, digital, broadcast)
  - Speech-to-text transcription
  - Language detection
  - Station identification and callsign extraction
  - Confidence scoring

### 4. Report Generator Agent
**Purpose**: Creates intelligence reports and web dashboard
- **Input**: All analysis results and metadata
- **Output**: Interactive web dashboard
- **Key Features**:
  - Executive summary generation
  - Geographic coverage visualization
  - Content analysis charts
  - Audio sample playback interface
  - Real-time dashboard updates

### 5. Memory Manager
**Purpose**: Handles inter-agent communication and state persistence
- **Features**:
  - Namespaced memory storage
  - Signal-based coordination
  - Timeout handling for agent synchronization
  - JSON-based file storage

## 📊 Data Flow Architecture

```mermaid
flowchart TD
    A[SDR Networks] --> B[Discovery Agent]
    B --> C{Memory Store}
    C --> D[Audio Capture Agent]
    D --> E[Audio Files]
    E --> F[Analysis Agent]
    F --> G[Analysis Results]
    G --> H{Memory Store}
    H --> I[Report Generator]
    I --> J[Web Dashboard]
    I --> K[REST API]
    
    C --> L[SDR List]
    H --> M[Complete Dataset]
    
    subgraph "Data Processing Pipeline"
        E --> N[FFmpeg Processing]
        N --> O[Normalized Audio]
        O --> F
    end
    
    subgraph "Analysis Pipeline"
        F --> P[Content Classification]
        F --> Q[Speech-to-Text]
        F --> R[Language Detection]
        F --> S[Station Identification]
        P --> G
        Q --> G
        R --> G
        S --> G
    end
```

## 🔐 Security Architecture

### Security Boundaries
1. **Network Layer**: Only accesses public WebSDR instances
2. **Data Layer**: No permanent storage of sensitive audio content
3. **Processing Layer**: Local-only analysis, no cloud dependencies
4. **Memory Layer**: Encrypted storage with namespace isolation

### Privacy Safeguards
- Audio samples are processed locally
- No personal information collection
- Temporary file cleanup after analysis
- Memory encryption for sensitive data

## 🚀 Performance Architecture

### Parallel Processing Design
- **Agent Coordination**: Multiple agents run concurrently using Promise.allSettled()
- **Memory Efficiency**: Streaming audio processing to minimize RAM usage
- **Network Optimization**: Intelligent SDR selection based on quality scores
- **Scalability**: Modular design allows for easy horizontal scaling

### Performance Metrics
- SDR Discovery: 10-30 seconds
- Audio Capture: 60 seconds per sample
- Analysis Processing: 5-15 seconds per sample
- Report Generation: 2-5 seconds
- **Total Workflow**: 3-5 minutes end-to-end

## 🔄 State Management

```mermaid
stateDiagram-v2
    [*] --> Initialized
    Initialized --> SDRDiscovery
    SDRDiscovery --> AudioCapture: sdr_ready
    AudioCapture --> AudioAnalysis: capture_complete
    AudioAnalysis --> ReportGeneration: analysis_complete
    ReportGeneration --> Deployed: report_ready
    Deployed --> [*]: mission_complete
    
    SDRDiscovery --> Failed: error
    AudioCapture --> Failed: error
    AudioAnalysis --> Failed: error
    ReportGeneration --> Failed: error
    Failed --> [*]: cleanup
```

## 📈 Scalability Considerations

### Horizontal Scaling
- **Agent Distribution**: Agents can be deployed across multiple nodes
- **Load Balancing**: SDR discovery can be distributed geographically
- **Data Sharding**: Audio processing can be parallelized by frequency bands

### Vertical Scaling
- **Memory Optimization**: Configurable sample rates and durations
- **CPU Optimization**: Concurrent processing with worker threads
- **Storage Optimization**: Configurable retention policies

## 🛠️ Technology Stack

### Core Technologies
- **Runtime**: Node.js 18+ with ES Modules
- **Framework**: Express.js for web server
- **Audio Processing**: FFmpeg for audio manipulation
- **Data Storage**: JSON files with namespaced memory management
- **Web Technologies**: HTML5, CSS3, JavaScript for dashboard

### External Dependencies
- **node-fetch**: HTTP client for SDR network access
- **cheerio**: HTML parsing for SDR discovery
- **ws**: WebSocket support for real-time updates
- **express**: Web server framework

## 🔧 Configuration Management

### Environment Variables
```bash
PORT=3000                    # Dashboard port
SPARC_MEMORY_DIR=./data     # Memory storage location
AUDIO_SAMPLE_RATE=16000     # Audio sample rate
CAPTURE_DURATION=60         # Capture duration in seconds
DEBUG=sparc:*               # Debug logging
```

### Configuration Files
- **package.json**: Dependencies and scripts
- **CLAUDE.md**: SPARC development configuration
- **.roomodes**: SPARC mode definitions

## 📋 Quality Assurance

### Testing Strategy
- **Unit Tests**: Individual agent functionality
- **Integration Tests**: Agent coordination and memory operations
- **End-to-End Tests**: Complete workflow validation
- **Performance Tests**: Load testing and resource monitoring

### Monitoring & Observability
- **Execution Logging**: Detailed progress tracking
- **Performance Metrics**: Timing and resource usage
- **Error Handling**: Comprehensive error capture and recovery
- **Health Checks**: System status monitoring

This architecture provides a robust, scalable, and secure foundation for the Shortwave Monitor system, following SPARC methodology principles while ensuring high performance and reliability.