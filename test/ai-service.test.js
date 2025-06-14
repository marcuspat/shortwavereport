/**
 * AI Service Integration Tests
 * Tests OpenRouter, OpenAI, and fallback functionality
 */

import { strict as assert } from 'assert';
import { test, describe, before, after } from 'node:test';
import aiService, { AIServiceManager } from '../src/utils/ai-service.js';
import aiConfig, { AIConfig } from '../src/config/ai-config.js';

describe('AI Service Integration Tests', () => {
  let testAIService;

  before(() => {
    // Create test instance with mock configuration
    testAIService = new AIServiceManager();
    
    // Set environment variables for testing
    process.env.USE_LOCAL_AI = 'true';
    process.env.AI_PROVIDER = 'local';
  });

  after(() => {
    // Clean up environment
    delete process.env.USE_LOCAL_AI;
    delete process.env.AI_PROVIDER;
  });

  describe('AI Configuration', () => {
    test('should load configuration from environment', () => {
      const config = new AIConfig();
      const summary = config.getConfigSummary();
      
      assert.ok(summary.provider);
      assert.ok(typeof summary.enableAI === 'boolean');
      assert.ok(typeof summary.settings === 'object');
    });

    test('should provide free model recommendations', () => {
      const config = new AIConfig();
      const freeModels = config.getFreeModels();
      
      assert.ok(Array.isArray(freeModels));
      assert.ok(freeModels.length > 0);
      assert.ok(freeModels.some(model => model.recommended));
    });

    test('should provide setup instructions', () => {
      const config = new AIConfig();
      const instructions = config.getSetupInstructions();
      
      assert.ok(instructions.openrouter);
      assert.ok(instructions.openai);
      assert.ok(instructions.local);
      assert.ok(Array.isArray(instructions.openrouter.steps));
    });

    test('should auto-detect best setup', () => {
      const config = new AIConfig();
      const detection = config.autoDetectBestSetup();
      
      assert.ok(detection.provider);
      assert.ok(detection.status);
      assert.ok(detection.message);
    });
  });

  describe('AI Service Manager', () => {
    test('should initialize with providers', () => {
      assert.ok(testAIService.providers.size > 0);
      assert.ok(testAIService.providers.has('openrouter'));
      assert.ok(testAIService.providers.has('openai'));
      assert.ok(testAIService.providers.has('local'));
    });

    test('should set provider correctly', () => {
      testAIService.setProvider('local');
      
      assert.equal(testAIService.currentProvider.id, 'local');
      assert.equal(testAIService.currentProvider.name, 'Local Mock');
    });

    test('should get provider status', () => {
      testAIService.setProvider('local');
      const status = testAIService.getProviderStatus();
      
      assert.equal(status.current, 'Local Mock');
      assert.equal(status.id, 'local');
      assert.ok(Array.isArray(status.available_models));
    });

    test('should get available models', () => {
      testAIService.setProvider('local');
      const models = testAIService.getAvailableModels();
      
      assert.ok(Array.isArray(models));
      assert.ok(models.includes('mock-model'));
    });
  });

  describe('AI Generation Functions', () => {
    test('should generate completion with local mock', async () => {
      testAIService.setProvider('local');
      
      const result = await testAIService.generateCompletion('Test prompt');
      
      assert.ok(result.text);
      assert.equal(result.provider, 'local');
      assert.equal(result.model, 'mock-model');
      assert.ok(result.usage);
    });

    test('should analyze audio metadata', async () => {
      testAIService.setProvider('local');
      
      const audioMetadata = {
        frequency: 14250000,
        mode: 'usb',
        duration: 60,
        sampleRate: 16000,
        location: 'Test Location',
        timestamp: new Date().toISOString()
      };

      const analysis = await testAIService.analyzeAudio(audioMetadata, 'test.wav');
      
      assert.ok(analysis);
      assert.ok(analysis.signal_type || analysis.error);
    });

    test('should generate monitoring report', async () => {
      testAIService.setProvider('local');
      
      const monitoringData = {
        sdrs: [{ url: 'test.com', location: 'Test' }],
        samples: [{ id: 'test', frequency: 14250000 }],
        analyses: [{ signal_type: 'voice' }],
        period: '1 hour',
        bands: ['20m', '40m']
      };

      const report = await testAIService.generateReport(monitoringData);
      
      assert.ok(report.content);
      assert.ok(report.generated_by);
      assert.ok(report.timestamp);
    });

    test('should handle generation errors gracefully', async () => {
      testAIService.setProvider('local');
      
      // Mock a failure
      const originalCall = testAIService.callLocalMock;
      testAIService.callLocalMock = async () => {
        throw new Error('Mock failure');
      };

      const result = await testAIService.generateCompletion('Test prompt');
      
      assert.ok(result.text.includes('AI Service Unavailable'));
      assert.equal(result.provider, 'fallback');
      
      // Restore original method
      testAIService.callLocalMock = originalCall;
    });

    test('should parse structured responses', () => {
      const mockText = `Signal Type: voice
Language: english
Quality: good
Classification: amateur radio`;

      const metadata = { frequency: 14250000 };
      const parsed = testAIService.parseStructuredResponse(mockText, metadata);
      
      assert.equal(parsed.signal_type, 'voice');
      assert.equal(parsed.language, 'english');
      assert.equal(parsed.quality, 'good');
    });
  });

  describe('Provider-Specific Tests', () => {
    test('should handle OpenRouter configuration', () => {
      const provider = testAIService.providers.get('openrouter');
      
      assert.equal(provider.name, 'OpenRouter');
      assert.equal(provider.baseUrl, 'https://openrouter.ai/api/v1');
      assert.ok(Array.isArray(provider.freeModels));
      assert.ok(provider.freeModels.includes('meta-llama/llama-3.2-3b-instruct:free'));
    });

    test('should handle OpenAI configuration', () => {
      const provider = testAIService.providers.get('openai');
      
      assert.equal(provider.name, 'OpenAI');
      assert.equal(provider.baseUrl, 'https://api.openai.com/v1');
      assert.ok(Array.isArray(provider.models));
      assert.ok(provider.models.includes('gpt-4o-mini'));
    });

    test('should simulate different response patterns', async () => {
      testAIService.setProvider('local');
      
      // Test audio analysis response
      const audioResult = await testAIService.generateCompletion('analyze this audio sample');
      assert.ok(audioResult.text.includes('audio') || audioResult.text.includes('voice'));
      
      // Test SDR analysis response
      const sdrResult = await testAIService.generateCompletion('analyze SDR reception');
      assert.ok(sdrResult.text.includes('SDR') || sdrResult.text.includes('frequency'));
      
      // Test report generation response
      const reportResult = await testAIService.generateCompletion('generate shortwave report');
      assert.ok(reportResult.text.includes('report') || reportResult.text.includes('stations'));
    });
  });

  describe('Error Handling and Resilience', () => {
    test('should handle provider switching', () => {
      // Test switching between providers
      testAIService.setProvider('local');
      assert.equal(testAIService.currentProvider.id, 'local');
      
      testAIService.setProvider('openrouter', 'test-key');
      assert.equal(testAIService.currentProvider.id, 'openrouter');
      assert.equal(testAIService.currentProvider.apiKey, 'test-key');
    });

    test('should handle unknown provider gracefully', () => {
      assert.throws(() => {
        testAIService.setProvider('unknown-provider');
      }, /Unknown AI provider/);
    });

    test('should handle missing provider gracefully', async () => {
      // Temporarily clear current provider
      const originalProvider = testAIService.currentProvider;
      testAIService.currentProvider = null;
      
      try {
        await testAIService.generateCompletion('test');
        assert.fail('Should have thrown error');
      } catch (error) {
        assert.ok(error.message.includes('No AI provider configured'));
      }
      
      // Restore provider
      testAIService.currentProvider = originalProvider;
    });

    test('should provide fallback responses', async () => {
      const fallback = await testAIService.fallbackResponse('test prompt', new Error('Test error'));
      
      assert.ok(fallback.text.includes('AI Service Unavailable'));
      assert.equal(fallback.provider, 'fallback');
      assert.ok(fallback.error);
    });
  });

  describe('Integration with Configuration', () => {
    test('should respect environment configuration', () => {
      // Test with different environment settings
      const originalEnv = process.env.AI_TEMPERATURE;
      process.env.AI_TEMPERATURE = '0.5';
      
      const config = new AIConfig();
      assert.equal(config.config.temperature, 0.5);
      
      // Restore
      if (originalEnv !== undefined) {
        process.env.AI_TEMPERATURE = originalEnv;
      } else {
        delete process.env.AI_TEMPERATURE;
      }
    });

    test('should validate configuration properly', () => {
      const config = new AIConfig();
      
      // Test invalid temperature
      assert.throws(() => {
        config.updateConfig({ temperature: 5.0 });
      }, /temperature must be between/);
      
      // Test invalid max tokens
      assert.throws(() => {
        config.updateConfig({ maxTokens: 10000 });
      }, /max tokens must be between/);
    });
  });

  describe('Real-world Usage Patterns', () => {
    test('should handle typical audio analysis workflow', async () => {
      testAIService.setProvider('local');
      
      const audioSample = {
        frequency: 14250000,
        mode: 'usb',
        duration: 60,
        sampleRate: 16000,
        location: 'University of Twente, Netherlands',
        timestamp: new Date().toISOString()
      };

      // Simulate complete workflow
      const analysis = await testAIService.analyzeAudio(audioSample, 'sample.wav');
      assert.ok(analysis);
      
      // Generate report based on analysis
      const reportData = {
        sdrs: [{ url: 'test.websdr.org', location: 'Test' }],
        samples: [audioSample],
        analyses: [analysis],
        period: '1 hour'
      };
      
      const report = await testAIService.generateReport(reportData);
      assert.ok(report.content);
    });

    test('should handle batch processing', async () => {
      testAIService.setProvider('local');
      
      const prompts = [
        'Analyze frequency 14.230 MHz',
        'Analyze frequency 21.150 MHz',
        'Analyze frequency 7.125 MHz'
      ];

      const results = await Promise.all(
        prompts.map(prompt => testAIService.generateCompletion(prompt, { maxTokens: 100 }))
      );

      assert.equal(results.length, 3);
      results.forEach(result => {
        assert.ok(result.text);
        assert.equal(result.provider, 'local');
      });
    });
  });
});

// Helper function to run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('🤖 Running AI Service Integration Tests...');
  console.log('━'.repeat(80));
}