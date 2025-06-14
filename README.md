# Shortwave Monitor

A sophisticated AI-powered shortwave radio intelligence system that automatically discovers WebSDR/KiwiSDR receivers worldwide, captures audio samples across HF frequencies, analyzes content using AI, and generates interactive intelligence reports.

## Features

- **Global SDR Discovery**: Automatically finds and monitors WebSDR, KiwiSDR, and OpenWebRX receivers
- **Multi-Band Audio Capture**: Captures across HF voice, broadcast, CW/digital, and utility bands
- **AI-Powered Analysis**: Speech-to-text, language detection, station identification, and CW decoding
- **Interactive Dashboard**: Real-time web interface with geographic visualization and audio playback
- **SPARC Methodology**: Built with systematic Test-Driven Development using claude-flow orchestration

## Quick Start

### Prerequisites

- Node.js 18+ 
- FFmpeg (for audio processing)
- Internet connection (for SDR access)

### Installation

```bash
git clone <repository-url>
cd shortwavereport
npm install
```

### Run Demo (with mock data)

```bash
npm run demo
```

### Run Full System

```bash
npm start
```

The system will:
1. Discover active SDR receivers worldwide
2. Capture audio samples from selected receivers
3. Analyze content using AI
4. Generate interactive dashboard at http://localhost:3000

## System Architecture

The system uses a 4-agent architecture coordinated by a SPARC orchestrator:

- **SDR Discovery Agent**: Finds and scores available receivers
- **Audio Capture Agent**: Records samples from multiple frequency bands
- **Audio Analysis Agent**: Processes audio for intelligence extraction
- **Report Generator Agent**: Creates interactive web dashboard

## Documentation

- [API Reference](docs/api-reference.md) - Complete API documentation with OpenAPI specs
- [Deployment Guide](docs/deployment.md) - Docker and manual deployment instructions  
- [Architecture](docs/architecture.md) - Detailed system architecture and components
- [Troubleshooting](docs/troubleshooting.md) - Common issues and solutions
- [Performance Tuning](docs/performance.md) - Optimization and scaling guidelines

## Testing

```bash
# Run all tests
npm test

# Run specific test suites
npm run test:unit
npm run test:integration
npm run test:e2e
```

## SPARC Development

This project uses SPARC methodology for systematic development:

```bash
# Run SPARC modes
npx claude-flow sparc modes

# Execute TDD workflow
npx claude-flow sparc tdd "feature description"

# Get mode information
npx claude-flow sparc info <mode>
```

## License

MIT License - see LICENSE file for details

## Contributing

1. Fork the repository
2. Create feature branch using SPARC methodology
3. Follow TDD approach with comprehensive tests
4. Submit pull request with documentation updates

## Security & Privacy

- All processing is done locally
- No cloud dependencies
- Audio files are temporary and automatically cleaned
- Only accesses public SDR instances
- No personal information collected

## Support

For issues and feature requests, please create an issue in the repository.