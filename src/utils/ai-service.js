/**
 * AI Service Abstraction
 * Supports OpenAI API, OpenRouter API, and other LLM providers
 * Allows users to use free OpenRouter keys instead of paid ChatGPT API
 */

import fetch from 'node-fetch';
import { validateInput, schemas } from './validation.js';

export class AIServiceManager {
  constructor() {
    this.providers = new Map();
    this.currentProvider = null;
    this.initializeProviders();
  }

  /**
   * Initialize available AI providers
   */
  initializeProviders() {
    // OpenRouter provider (supports many free models)
    this.providers.set('openrouter', {
      name: 'OpenRouter',
      baseUrl: 'https://openrouter.ai/api/v1',
      requiresAuth: true,
      freeModels: [
        'meta-llama/llama-3.2-3b-instruct:free',
        'microsoft/phi-3-mini-128k-instruct:free',
        'huggingface/zephyr-7b-beta:free',
        'openchat/openchat-7b:free',
        'gryphe/mythomist-7b:free',
        'nousresearch/nous-capybara-7b:free'
      ],
      defaultModel: 'meta-llama/llama-3.2-3b-instruct:free'
    });

    // OpenAI provider
    this.providers.set('openai', {
      name: 'OpenAI',
      baseUrl: 'https://api.openai.com/v1',
      requiresAuth: true,
      models: [
        'gpt-4o-mini',
        'gpt-4o',
        'gpt-3.5-turbo',
        'gpt-4'
      ],
      defaultModel: 'gpt-4o-mini'
    });

    // Local/Offline provider (for development)
    this.providers.set('local', {
      name: 'Local Mock',
      baseUrl: 'http://localhost:11434/v1',
      requiresAuth: false,
      models: ['mock-model'],
      defaultModel: 'mock-model'
    });

    // Auto-detect and configure provider
    this.autoConfigureProvider();
  }

  /**
   * Auto-configure provider based on available API keys
   */
  autoConfigureProvider() {
    const openRouterKey = process.env.OPENROUTER_API_KEY;
    const openAIKey = process.env.OPENAI_API_KEY;
    const useLocal = process.env.USE_LOCAL_AI === 'true';

    if (openRouterKey) {
      this.setProvider('openrouter', openRouterKey);
      console.log('🤖 Using OpenRouter AI service');
    } else if (openAIKey) {
      this.setProvider('openai', openAIKey);
      console.log('🤖 Using OpenAI service');
    } else if (useLocal) {
      this.setProvider('local');
      console.log('🤖 Using local AI service (mock)');
    } else {
      console.warn('⚠️ No AI API key configured. Using fallback mock responses.');
      this.setProvider('local');
    }
  }

  /**
   * Set active AI provider
   */
  setProvider(providerId, apiKey = null) {
    const provider = this.providers.get(providerId);
    if (!provider) {
      throw new Error(`Unknown AI provider: ${providerId}`);
    }

    this.currentProvider = {
      ...provider,
      id: providerId,
      apiKey: apiKey || this.currentProvider?.apiKey
    };

    console.log(`🔧 AI provider set to: ${provider.name}`);
  }

  /**
   * Generate completion using current provider
   */
  async generateCompletion(prompt, options = {}) {
    if (!this.currentProvider) {
      throw new Error('No AI provider configured');
    }

    const requestOptions = {
      model: options.model || this.currentProvider.defaultModel,
      temperature: options.temperature || 0.7,
      maxTokens: options.maxTokens || 1000,
      stream: false,
      ...options
    };

    try {
      switch (this.currentProvider.id) {
        case 'openrouter':
          return await this.callOpenRouter(prompt, requestOptions);
        case 'openai':
          return await this.callOpenAI(prompt, requestOptions);
        case 'local':
          return await this.callLocalMock(prompt, requestOptions);
        default:
          throw new Error(`Unsupported provider: ${this.currentProvider.id}`);
      }
    } catch (error) {
      console.error(`❌ AI service error: ${error.message}`);
      return await this.fallbackResponse(prompt, error);
    }
  }

  /**
   * Call OpenRouter API
   */
  async callOpenRouter(prompt, options) {
    const response = await fetch(`${this.currentProvider.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.currentProvider.apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://github.com/shortwavereport/monitor',
        'X-Title': 'Shortwave Report Monitor'
      },
      body: JSON.stringify({
        model: options.model,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: options.temperature,
        max_tokens: options.maxTokens,
        stream: false
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenRouter API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    return {
      text: data.choices[0].message.content,
      usage: data.usage,
      model: data.model,
      provider: 'openrouter'
    };
  }

  /**
   * Call OpenAI API
   */
  async callOpenAI(prompt, options) {
    const response = await fetch(`${this.currentProvider.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.currentProvider.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: options.model,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: options.temperature,
        max_tokens: options.maxTokens
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    return {
      text: data.choices[0].message.content,
      usage: data.usage,
      model: data.model,
      provider: 'openai'
    };
  }

  /**
   * Local mock for development/testing
   */
  async callLocalMock(prompt, options) {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 1000));

    // Generate mock response based on prompt keywords
    let mockResponse = 'Mock AI response';
    
    if (prompt.toLowerCase().includes('audio')) {
      mockResponse = 'The audio sample contains voice communications on 14.250 MHz USB. Signal quality is good with minimal interference. Detected language: English. Estimated mode: Amateur radio voice communication.';
    } else if (prompt.toLowerCase().includes('sdr')) {
      mockResponse = 'SDR analysis shows optimal reception conditions. Recommended frequency ranges: 14.000-14.350 MHz for amateur radio, 9.400-9.900 MHz for shortwave broadcast. Signal propagation conditions: Good to Excellent.';
    } else if (prompt.toLowerCase().includes('report')) {
      mockResponse = 'Generated shortwave monitoring report summary: 15 active stations detected, 8 voice communications, 4 digital modes, 3 CW transmissions. Band conditions favorable for long-distance communication.';
    }

    return {
      text: mockResponse,
      usage: { prompt_tokens: prompt.length / 4, completion_tokens: mockResponse.length / 4 },
      model: 'mock-model',
      provider: 'local'
    };
  }

  /**
   * Fallback response when AI service fails
   */
  async fallbackResponse(prompt, error) {
    console.warn('🔄 Using fallback response due to AI service failure');
    
    return {
      text: `[AI Service Unavailable] Automated analysis could not be completed. Manual review required. Error: ${error.message}`,
      usage: { prompt_tokens: 0, completion_tokens: 0 },
      model: 'fallback',
      provider: 'fallback',
      error: error.message
    };
  }

  /**
   * Analyze audio content with AI
   */
  async analyzeAudio(audioMetadata, audioPath) {
    const prompt = `Analyze this audio sample captured from shortwave radio:

Frequency: ${audioMetadata.frequency / 1000000} MHz
Mode: ${audioMetadata.mode.toUpperCase()}
Duration: ${audioMetadata.duration} seconds
Sample Rate: ${audioMetadata.sampleRate} Hz
Location: ${audioMetadata.location || 'Unknown'}
Timestamp: ${audioMetadata.timestamp}

Please provide:
1. Signal type identification (voice, data, CW, broadcast, etc.)
2. Language detection (if voice)
3. Content classification (amateur radio, broadcast, utility, etc.)
4. Signal quality assessment
5. Any notable characteristics

Respond in JSON format with structured analysis.`;

    try {
      const result = await this.generateCompletion(prompt, {
        temperature: 0.3,
        maxTokens: 800
      });

      // Try to parse JSON response, fallback to structured text
      try {
        return JSON.parse(result.text);
      } catch (parseError) {
        return this.parseStructuredResponse(result.text, audioMetadata);
      }
    } catch (error) {
      return {
        signal_type: 'unknown',
        language: 'unknown',
        classification: 'unclassified',
        quality: 'unknown',
        confidence: 0.1,
        error: error.message,
        analysis_method: 'fallback'
      };
    }
  }

  /**
   * Generate shortwave monitoring report with AI
   */
  async generateReport(monitoringData) {
    const prompt = `Generate a comprehensive shortwave monitoring report based on this data:

SDRs Monitored: ${monitoringData.sdrs?.length || 0}
Audio Samples: ${monitoringData.samples?.length || 0}
Analysis Results: ${monitoringData.analyses?.length || 0}
Monitoring Period: ${monitoringData.period || 'Unknown'}
Frequency Bands: ${monitoringData.bands?.join(', ') || 'Various HF bands'}

Sample Data:
${JSON.stringify(monitoringData, null, 2).substring(0, 2000)}

Please provide:
1. Executive Summary
2. Band Conditions Assessment
3. Notable Signals and Communications
4. Technical Analysis
5. Recommendations for Further Monitoring

Format as a professional technical report.`;

    try {
      const result = await this.generateCompletion(prompt, {
        temperature: 0.5,
        maxTokens: 2000
      });

      return {
        content: result.text,
        generated_by: result.provider,
        model: result.model,
        timestamp: new Date().toISOString(),
        tokens_used: result.usage
      };
    } catch (error) {
      return {
        content: `# Shortwave Monitoring Report\n\n**Status:** Report generation failed due to AI service unavailability.\n\n**Error:** ${error.message}\n\n**Data Summary:**\n- SDRs: ${monitoringData.sdrs?.length || 0}\n- Samples: ${monitoringData.samples?.length || 0}\n- Period: ${monitoringData.period || 'Unknown'}\n\nManual analysis required.`,
        generated_by: 'fallback',
        model: 'none',
        timestamp: new Date().toISOString(),
        error: error.message
      };
    }
  }

  /**
   * Parse structured response when JSON parsing fails
   */
  parseStructuredResponse(text, metadata) {
    const response = {
      signal_type: 'unknown',
      language: 'unknown', 
      classification: 'unclassified',
      quality: 'unknown',
      confidence: 0.5,
      raw_analysis: text
    };

    // Extract information using regex patterns
    const signalMatch = text.match(/signal[^:]*:\s*([^\n,]+)/i);
    if (signalMatch) response.signal_type = signalMatch[1].trim().toLowerCase();

    const languageMatch = text.match(/language[^:]*:\s*([^\n,]+)/i);
    if (languageMatch) response.language = languageMatch[1].trim().toLowerCase();

    const qualityMatch = text.match(/quality[^:]*:\s*([^\n,]+)/i);
    if (qualityMatch) response.quality = qualityMatch[1].trim().toLowerCase();

    return response;
  }

  /**
   * Get available models for current provider
   */
  getAvailableModels() {
    if (!this.currentProvider) return [];
    
    return this.currentProvider.freeModels || this.currentProvider.models || [];
  }

  /**
   * Get provider status
   */
  getProviderStatus() {
    return {
      current: this.currentProvider?.name || 'None',
      id: this.currentProvider?.id || 'none',
      authenticated: !!this.currentProvider?.apiKey,
      available_models: this.getAvailableModels(),
      requires_auth: this.currentProvider?.requiresAuth || false
    };
  }

  /**
   * Test provider connectivity
   */
  async testProvider() {
    if (!this.currentProvider) {
      throw new Error('No provider configured');
    }

    try {
      const result = await this.generateCompletion('Test message: respond with "OK"', {
        maxTokens: 10,
        temperature: 0
      });

      return {
        success: true,
        provider: this.currentProvider.name,
        model: result.model,
        response_time: Date.now(),
        usage: result.usage
      };
    } catch (error) {
      return {
        success: false,
        provider: this.currentProvider.name,
        error: error.message
      };
    }
  }
}

// Export singleton instance
export const aiService = new AIServiceManager();
export default aiService;