/**
 * SDR Discovery Agent - SPARC Phase 1
 * Identifies and monitors WebSDR/KiwiSDR receivers
 * Enhanced with resilience mechanisms: retry logic, circuit breakers, rate limiting
 */

import fetch from 'node-fetch';
import { load } from 'cheerio';
import MemoryManager from '../memory/memory-manager.js';
import ResilienceManager from '../utils/resilience-manager.js';

class SDRDiscoveryAgent {
  constructor() {
    this.memory = new MemoryManager();
    this.resilience = new ResilienceManager();
    this.discoveredSDRs = [];
    this.maxConcurrentChecks = 5;
  }

  /**
   * Main discovery workflow
   */
  async execute() {
    console.log('🔍 Starting SDR Discovery Phase...');
    
    return await this.resilience.executeResilientOperation({
      operationId: 'sdr_discovery_main',
      serviceType: 'sdr_discovery',
      operation: async () => {
        // Parallel discovery of SDR networks with resilience
        const discoveryOperations = [
          {
            operationId: 'discover_websdr',
            serviceType: 'sdr_discovery',
            operation: () => this.discoverWebSDRs()
          },
          {
            operationId: 'discover_kiwisdr',
            serviceType: 'sdr_discovery', 
            operation: () => this.discoverKiwiSDRs()
          },
          {
            operationId: 'discover_openwebrx',
            serviceType: 'sdr_discovery',
            operation: () => this.discoverOpenWebRX()
          }
        ];

        const discoveries = await this.resilience.executeMultipleResilient(discoveryOperations);

        console.log('📡 Discovery results:');
        const networks = ['WebSDR', 'KiwiSDR', 'OpenWebRX'];
        discoveries.forEach((result, index) => {
          if (result.status === 'fulfilled') {
            console.log(`✅ ${networks[index]}: ${result.value.length} receivers found`);
            this.discoveredSDRs.push(...result.value);
          } else {
            console.log(`❌ ${networks[index]}: Discovery failed - ${result.reason.message}`);
          }
        });

        // Score and rank SDRs with resilience
        await this.resilience.executeResilientOperation({
          operationId: 'score_sdrs',
          serviceType: 'sdr_discovery',
          operation: () => this.scoreSDRs()
        });
        
        // Store results in memory
        await this.memory.store('active_sdrs', this.discoveredSDRs);
        await this.memory.signal('sdr_ready', { 
          count: this.discoveredSDRs.length,
          timestamp: new Date().toISOString()
        });

        console.log(`🎯 Discovery complete: ${this.discoveredSDRs.length} active SDRs found`);
        return this.discoveredSDRs;
      }
    });
  }

  /**
   * Discover WebSDR network receivers
   */
  async discoverWebSDRs() {
    console.log('🌐 Scanning WebSDR.org network...');
    
    return await this.resilience.executeResilientOperation({
      operationId: 'websdr_discovery',
      serviceType: 'websdr_connection',
      operation: async () => {
        const response = await fetch('http://websdr.org/', {
          timeout: 10000,
          headers: { 'User-Agent': 'Shortwave-Monitor/1.0' }
        });
        
        if (!response.ok) {
          throw new Error(`WebSDR fetch failed: ${response.status}`);
        }

        const html = await response.text();
        const $ = load(html);
        const sdrs = [];

        // Parse WebSDR list - looking for active receivers
        $('a[href*="websdr"]').each((index, element) => {
          const url = $(element).attr('href');
          const text = $(element).text().trim();
          
          if (url && url.includes('websdr') && !url.includes('websdr.org')) {
            sdrs.push({
              url: url,
              location: this.extractLocation(text),
              frequencies: this.getDefaultHFBands(),
              quality_score: 0,
              last_checked: new Date().toISOString(),
              network: 'WebSDR'
            });
          }
        });

        // Add known reliable WebSDRs
        sdrs.push(
          {
            url: 'http://websdr.ewi.utwente.nl:8901/',
            location: 'University of Twente, Netherlands',
            frequencies: ['80m', '40m', '20m', '15m', '10m'],
            quality_score: 0,
            last_checked: new Date().toISOString(),
            network: 'WebSDR'
          },
          {
            url: 'http://rx.linkfanel.net/',
            location: 'Hungary',
            frequencies: ['80m', '40m', '20m', '15m', '10m'],
            quality_score: 0,
            last_checked: new Date().toISOString(),
            network: 'WebSDR'
          }
        );

        return sdrs;
      },
      operationConfig: { sdrUrl: 'http://websdr.org/' }
    });
  }

  /**
   * Discover KiwiSDR network receivers
   */
  async discoverKiwiSDRs() {
    console.log('🥝 Scanning KiwiSDR network...');
    
    try {
      const response = await fetch('http://kiwisdr.com/public/', {
        timeout: 10000,
        headers: { 'User-Agent': 'Shortwave-Monitor/1.0' }
      });

      if (!response.ok) {
        throw new Error(`KiwiSDR fetch failed: ${response.status}`);
      }

      const html = await response.text();
      const $ = load(html);
      const sdrs = [];

      // Parse KiwiSDR public list
      $('tr').each((index, element) => {
        const cells = $(element).find('td');
        if (cells.length >= 3) {
          const url = $(cells[1]).find('a').attr('href');
          const location = $(cells[0]).text().trim();
          
          if (url && location) {
            sdrs.push({
              url: url,
              location: location,
              frequencies: this.getDefaultHFBands(),
              quality_score: 0,
              last_checked: new Date().toISOString(),
              network: 'KiwiSDR'
            });
          }
        }
      });

      return sdrs.slice(0, 20); // Limit to top 20
    } catch (error) {
      console.error('KiwiSDR discovery error:', error);
      return [];
    }
  }

  /**
   * Discover OpenWebRX instances
   */
  async discoverOpenWebRX() {
    console.log('📻 Scanning OpenWebRX instances...');
    
    // Known OpenWebRX instances
    const knownInstances = [
      {
        url: 'http://openwebrx.de/',
        location: 'Germany',
        frequencies: this.getDefaultHFBands(),
        quality_score: 0,
        last_checked: new Date().toISOString(),
        network: 'OpenWebRX'
      }
    ];

    return knownInstances;
  }

  /**
   * Score SDRs based on accessibility and quality
   */
  async scoreSDRs() {
    console.log('⚡ Scoring SDR accessibility...');
    
    const scoringPromises = this.discoveredSDRs.map(async (sdr) => {
      try {
        const startTime = Date.now();
        const response = await fetch(sdr.url, {
          timeout: 5000,
          headers: { 'User-Agent': 'Shortwave-Monitor/1.0' }
        });
        
        const responseTime = Date.now() - startTime;
        
        // Calculate quality score
        let score = 0;
        if (response.ok) score += 40;
        if (responseTime < 2000) score += 30;
        if (responseTime < 1000) score += 20;
        if (sdr.network === 'WebSDR') score += 10; // Preference for WebSDR
        
        sdr.quality_score = score;
        sdr.response_time = responseTime;
        sdr.status = response.ok ? 'online' : 'offline';
        
      } catch (error) {
        sdr.quality_score = 0;
        sdr.status = 'offline';
        sdr.error = error.message;
      }
    });

    await Promise.allSettled(scoringPromises);
    
    // Filter and sort by quality score
    this.discoveredSDRs = this.discoveredSDRs
      .filter(sdr => sdr.quality_score > 30)
      .sort((a, b) => b.quality_score - a.quality_score)
      .slice(0, 10); // Keep top 10 SDRs
  }

  /**
   * Helper methods
   */
  extractLocation(text) {
    // Simple location extraction from text
    const locationPatterns = [
      /([A-Z][a-z]+,?\s*[A-Z][a-z]+)/,
      /([A-Z][a-z]+)/
    ];
    
    for (const pattern of locationPatterns) {
      const match = text.match(pattern);
      if (match) return match[1];
    }
    
    return 'Unknown';
  }

  getDefaultHFBands() {
    return [
      '80m (3.5-4.0 MHz)',
      '40m (7.0-7.3 MHz)', 
      '20m (14.0-14.35 MHz)',
      '15m (21.0-21.45 MHz)',
      '10m (28.0-29.7 MHz)'
    ];
  }
}

// Allow standalone execution
if (import.meta.url === `file://${process.argv[1]}`) {
  const agent = new SDRDiscoveryAgent();
  agent.execute().catch(console.error);
}

export default SDRDiscoveryAgent;