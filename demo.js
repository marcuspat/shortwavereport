/**
 * Demo Script for Shortwave Monitor System
 * Shows the system working with mock data
 */

import MemoryManager from './src/memory/memory-manager.js';
import ReportGeneratorAgent from './src/agents/report-generator.js';

async function runDemo() {
  console.log('🎬 Starting Shortwave Monitor Demo');
  console.log('━'.repeat(50));

  const memory = new MemoryManager();
  
  // Set up mock data for demo
  console.log('📊 Setting up mock data...');
  
  // Mock SDR discovery results
  const mockSDRs = [
    {
      url: 'http://websdr.ewi.utwente.nl:8901/',
      location: 'University of Twente, Netherlands',
      frequencies: ['80m', '40m', '20m', '15m', '10m'],
      quality_score: 95,
      last_checked: new Date().toISOString(),
      network: 'WebSDR',
      status: 'online',
      response_time: 850
    },
    {
      url: 'http://rx.linkfanel.net/',
      location: 'Hungary',
      frequencies: ['80m', '40m', '20m', '15m', '10m'],
      quality_score: 88,
      last_checked: new Date().toISOString(),
      network: 'WebSDR',
      status: 'online',
      response_time: 1200
    },
    {
      url: 'http://kiwisdr.example.com:8073/',
      location: 'California, USA',
      frequencies: ['80m', '40m', '20m', '15m', '10m'],
      quality_score: 82,
      last_checked: new Date().toISOString(),
      network: 'KiwiSDR',
      status: 'online',
      response_time: 750
    }
  ];

  // Mock audio samples
  const mockSamples = [
    {
      id: 'hf_voice_netherlands_2024',
      filename: 'hf_voice_netherlands_2024.wav',
      filepath: '/data/audio/hf_voice_netherlands_2024.wav',
      sdr: mockSDRs[0],
      config: { frequency: 14250000, mode: 'usb', type: 'hf_voice' },
      metadata: {
        frequency: 14250000,
        mode: 'usb',
        bandwidth: 3000,
        duration: 60,
        sampleRate: 16000,
        timestamp: new Date().toISOString(),
        quality_estimate: 85
      },
      processed: true
    },
    {
      id: 'broadcast_hungary_2024',
      filename: 'broadcast_hungary_2024.wav',
      filepath: '/data/audio/broadcast_hungary_2024.wav',
      sdr: mockSDRs[1],
      config: { frequency: 9500000, mode: 'am', type: 'broadcast' },
      metadata: {
        frequency: 9500000,
        mode: 'am',
        bandwidth: 5000,
        duration: 60,
        sampleRate: 16000,
        timestamp: new Date().toISOString(),
        quality_estimate: 78
      },
      processed: true
    },
    {
      id: 'cw_digital_usa_2024',
      filename: 'cw_digital_usa_2024.wav',
      filepath: '/data/audio/cw_digital_usa_2024.wav',
      sdr: mockSDRs[2],
      config: { frequency: 14030000, mode: 'cw', type: 'cw_digital' },
      metadata: {
        frequency: 14030000,
        mode: 'cw',
        bandwidth: 500,
        duration: 60,
        sampleRate: 16000,
        timestamp: new Date().toISOString(),
        quality_estimate: 92
      },
      processed: true
    }
  ];

  // Mock analysis results
  const mockAnalyses = [
    {
      sample_id: 'hf_voice_netherlands_2024',
      filename: 'hf_voice_netherlands_2024.wav',
      metadata: mockSamples[0].metadata,
      analysis_results: {
        content_type: 'voice',
        language: 'english',
        transcription: 'CQ CQ CQ de W1ABC W1ABC calling CQ and standing by',
        stations: ['W1ABC'],
        quality_score: 85,
        timestamp: new Date().toISOString(),
        confidence: 88
      }
    },
    {
      sample_id: 'broadcast_hungary_2024',
      filename: 'broadcast_hungary_2024.wav',
      metadata: mockSamples[1].metadata,
      analysis_results: {
        content_type: 'broadcast',
        language: 'english',
        transcription: 'This is BBC World Service broadcasting from London with news and current affairs',
        stations: ['BBC World Service'],
        quality_score: 78,
        timestamp: new Date().toISOString(),
        confidence: 95
      }
    },
    {
      sample_id: 'cw_digital_usa_2024',
      filename: 'cw_digital_usa_2024.wav',
      metadata: mockSamples[2].metadata,
      analysis_results: {
        content_type: 'cw',
        language: 'unknown',
        transcription: 'QRT QRT DE K6XYZ K6XYZ 73',
        stations: ['K6XYZ'],
        quality_score: 92,
        timestamp: new Date().toISOString(),
        confidence: 82
      }
    }
  ];

  // Store mock data in memory
  await memory.store('active_sdrs', mockSDRs);
  await memory.store('audio_samples', mockSamples);
  await memory.store('analysis_results', mockAnalyses);
  
  // Signal completion of all phases
  await memory.signal('sdr_ready', { count: mockSDRs.length });
  await memory.signal('capture_complete', { count: mockSamples.length });
  await memory.signal('analysis_complete', { count: mockAnalyses.length });

  console.log('✅ Mock data setup complete');
  console.log(`   📡 SDRs: ${mockSDRs.length}`);
  console.log(`   🎵 Samples: ${mockSamples.length}`);
  console.log(`   🔬 Analyses: ${mockAnalyses.length}`);

  // Generate report with mock data
  console.log('\n📊 Generating intelligence report...');
  const reportGenerator = new ReportGeneratorAgent();
  
  try {
    const result = await reportGenerator.execute();
    
    console.log('\n🎯 Demo completed successfully!');
    console.log('━'.repeat(50));
    console.log(`📊 Dashboard URL: ${result.url}`);
    console.log('📈 Report Summary:');
    console.log(`   📡 Active SDRs: ${result.data.summary.totalSDRs}`);
    console.log(`   🎵 Audio Samples: ${result.data.summary.totalSamples}`);
    console.log(`   🔬 Analyses: ${result.data.summary.totalAnalyses}`);
    console.log(`   🌍 Coverage Areas: ${result.data.summary.coverageAreas.length}`);
    console.log(`   🗣️ Languages: ${result.data.summary.detectedLanguages.join(', ')}`);
    console.log(`   📻 Stations: ${result.data.summary.stationCount}`);
    console.log('━'.repeat(50));
    console.log('🎬 Demo complete! Check the dashboard at the URL above.');
    
    // Keep server running for demo
    console.log('\n💡 Press Ctrl+C to stop the demo server');
    
  } catch (error) {
    console.error('❌ Demo failed:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Demo stopping...');
  process.exit(0);
});

// Run demo
runDemo().catch(console.error);