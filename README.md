# 📡 Shortwave Monitor - SPARC Intelligence System

A comprehensive shortwave audio monitoring system built using the SPARC (Specification, Pseudocode, Architecture, Refinement, Completion) methodology with claude-flow orchestration patterns.

## 🎯 Overview

This system automatically discovers WebSDR/KiwiSDR receivers, captures audio samples across HF frequencies, analyzes content using AI, and generates intelligence reports through an interactive web dashboard.

## 🏗️ Architecture

The system follows SPARC methodology with 5 specialized agents:

1. **SDR Discovery Agent** - Identifies active WebSDR/KiwiSDR receivers
2. **Audio Capture Agent** - Captures audio samples from selected SDRs  
3. **Audio Analysis Agent** - Processes audio using STT, CW decoding, language detection
4. **Report Generator Agent** - Creates interactive web dashboard
5. **SPARC Orchestrator** - Coordinates all agents with parallel execution

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ 
- npm or yarn
- ffmpeg (for audio processing)
- Network access to WebSDR instances

### Installation

```bash
# Clone and install dependencies
git clone <repository>
cd shortwave-monitor
npm install

# Create required directories
mkdir -p data/{audio,analysis,memory,reports}
```

### Running the System

```bash
# Run complete SPARC workflow
npm start

# Or run individual components
npm run sdr-discovery
npm run audio-capture  
npm run audio-analysis
npm run report-generator
```

### Development

```bash
# Development mode with auto-reload
npm run dev

# Run tests
npm test

# Lint and typecheck
npm run build
```

## 📊 Dashboard

Once running, the intelligence dashboard will be available at `http://localhost:3000` featuring:

- **Executive Summary** - Key findings and statistics
- **Geographic Coverage** - Active SDR locations and quality scores
- **Content Analysis** - Detected languages, station types, confidence metrics
- **Notable Stations** - Identified callsigns and broadcasters
- **Audio Samples** - Captured audio with analysis results

## 🔧 Configuration

### Environment Variables

```bash
# Optional configuration
PORT=3000                    # Dashboard port
SPARC_MEMORY_DIR=./data     # Memory storage location
AUDIO_SAMPLE_RATE=16000     # Audio sample rate
CAPTURE_DURATION=60         # Capture duration in seconds
```

### SDR Networks

The system automatically discovers receivers from:

- **WebSDR.org** - Global WebSDR network
- **KiwiSDR.com** - Worldwide KiwiSDR receivers  
- **OpenWebRX** - Open source WebSDR instances

## 🧪 Testing

Comprehensive test suite covering:

```bash
# Run all tests
npm test

# Individual test suites
node --test test/orchestrator.test.js
node --test test/agents.test.js
```

Test coverage includes:
- Agent functionality and coordination
- Memory operations and persistence
- Error handling and recovery
- End-to-end workflow validation

## 📁 Project Structure

```
shortwave-monitor/
├── src/
│   ├── agents/              # SPARC agent implementations
│   │   ├── sdr-discovery.js
│   │   ├── audio-capture.js
│   │   ├── audio-analysis.js
│   │   └── report-generator.js
│   ├── memory/              # Memory management system
│   │   └── memory-manager.js
│   ├── reports/             # Generated reports and dashboard
│   └── orchestrator.js      # Main SPARC coordinator
├── test/                    # Comprehensive test suite
├── data/                    # Runtime data storage
│   ├── audio/              # Captured audio samples
│   ├── analysis/           # Analysis results
│   ├── memory/             # Agent coordination state
│   └── reports/            # Generated reports
└── package.json
```

## 🔍 Monitoring Capabilities

### Frequency Coverage

- **HF Voice** (14.200-14.350 MHz) - Amateur radio communications
- **Broadcast** (9-12 MHz) - Shortwave broadcast stations
- **CW/Digital** (14.000-14.070 MHz) - Morse code and digital modes
- **Utility** (8-12 MHz) - Maritime and utility stations

### Content Analysis

- **Speech-to-Text** - Voice communication transcription
- **Language Detection** - Multi-language support
- **Station Identification** - Callsign and broadcaster recognition
- **CW Decoding** - Morse code translation
- **Digital Mode Detection** - PSK31, FT8, RTTY identification

## 🔄 SPARC Methodology

### Phase 1: Specification & Discovery
- SDR network scanning and validation
- Requirements verification
- System capability assessment

### Phase 2: Architecture & Implementation  
- Parallel audio capture across multiple SDRs
- Real-time quality monitoring
- Adaptive frequency selection

### Phase 3: Refinement & Analysis
- Test-driven audio analysis pipeline
- Machine learning content classification
- Quality assurance validation

### Phase 4: Completion & Delivery
- Interactive dashboard generation
- Real-time report updates
- Web-based intelligence visualization

## 🛡️ Security & Privacy

- No audio data is permanently stored
- All processing is local - no cloud dependencies
- Memory system uses encrypted storage
- Network access limited to public WebSDR instances
- No personal information collection

## 🤝 Contributing

This system follows SPARC development principles:

1. **Modular Design** - Keep files under 500 lines
2. **Test-Driven Development** - Write tests before implementation
3. **Clean Architecture** - Separate concerns and dependencies
4. **Security First** - No hardcoded secrets or credentials

### Development Workflow

```bash
# 1. Create feature branch
git checkout -b feature/sparc-enhancement

# 2. Implement using SPARC methodology
npm run sparc-spec-pseudocode "feature description"
npm run sparc-architect "system design"  
npm run sparc-tdd "implementation with tests"

# 3. Validate and deploy
npm run build
npm test
```

## 📈 Performance

- **Parallel Processing** - Multiple agents run concurrently
- **Memory Efficiency** - Streaming audio processing
- **Network Optimization** - Intelligent SDR selection
- **Real-time Updates** - Live dashboard refresh

### Typical Performance Metrics

- SDR Discovery: 10-30 seconds
- Audio Capture: 60 seconds per sample
- Analysis Processing: 5-15 seconds per sample
- Report Generation: 2-5 seconds
- **Total Workflow**: 3-5 minutes end-to-end

## 🆘 Troubleshooting

### Common Issues

**SDR Discovery Fails**
```bash
# Check network connectivity
curl -I http://websdr.org
npm run sdr-discovery -- --verbose
```

**Audio Capture Issues**
```bash
# Verify ffmpeg installation
ffmpeg -version
# Check audio directory permissions
ls -la data/audio/
```

**Analysis Errors**
```bash
# Check memory usage
npm run debug-memory
# Validate captured audio files
npm run validate-audio
```

### Debug Mode

```bash
# Enable verbose logging
DEBUG=sparc:* npm start

# Check agent coordination
npm run status
npm run memory-dump
```

## 📄 License

MIT License - see LICENSE file for details.

## 🙏 Acknowledgments

- WebSDR.org and KiwiSDR networks for public access
- Amateur radio community for spectrum sharing
- SPARC methodology for systematic development
- Claude-flow for orchestration patterns

---

**Built with SPARC methodology** 🚀  
*Systematic, Parallel, Automated, Reliable, Coordinated*