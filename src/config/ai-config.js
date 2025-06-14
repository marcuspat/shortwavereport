/**
 * AI Service Configuration Manager
 * Handles environment-based AI provider configuration with validation
 */

export class AIConfig {
  constructor() {
    this.loadConfig();
  }

  /**
   * Load configuration from environment variables
   */
  loadConfig() {
    this.config = {
      // Provider selection
      provider: process.env.AI_PROVIDER || 'openrouter',
      
      // API Keys
      openRouterKey: process.env.OPENROUTER_API_KEY,
      openAIKey: process.env.OPENAI_API_KEY,
      
      // Model settings
      model: process.env.AI_MODEL || 'meta-llama/llama-3.2-3b-instruct:free',
      temperature: parseFloat(process.env.AI_TEMPERATURE) || 0.7,
      maxTokens: parseInt(process.env.AI_MAX_TOKENS) || 1000,
      timeout: parseInt(process.env.AI_TIMEOUT) || 30000,
      
      // Feature flags
      useLocalAI: process.env.USE_LOCAL_AI === 'true',
      enableAI: process.env.ENABLE_AI !== 'false', // Enabled by default
      
      // Rate limiting for AI calls
      aiRateLimit: {
        maxRequests: parseInt(process.env.AI_RATE_LIMIT_MAX) || 100,
        windowMs: parseInt(process.env.AI_RATE_LIMIT_WINDOW) || 3600000 // 1 hour
      },
      
      // Fallback behavior
      fallbackToMock: process.env.AI_FALLBACK_TO_MOCK !== 'false',
      strictMode: process.env.AI_STRICT_MODE === 'true'
    };
    
    this.validateConfig();
  }

  /**
   * Validate configuration
   */
  validateConfig() {
    const errors = [];

    // Check if any API key is available
    if (this.config.enableAI && !this.config.useLocalAI) {
      if (!this.config.openRouterKey && !this.config.openAIKey) {
        if (this.config.strictMode) {
          errors.push('No AI API key configured and strict mode is enabled');
        } else {
          console.warn('⚠️ No AI API key configured. Using local mock responses.');
          this.config.useLocalAI = true;
        }
      }
    }

    // Validate numeric values
    if (this.config.temperature < 0 || this.config.temperature > 2) {
      errors.push('AI temperature must be between 0 and 2');
    }

    if (this.config.maxTokens < 1 || this.config.maxTokens > 4000) {
      errors.push('AI max tokens must be between 1 and 4000');
    }

    if (this.config.timeout < 1000 || this.config.timeout > 120000) {
      errors.push('AI timeout must be between 1000ms and 120000ms');
    }

    // Validate provider
    if (!['openrouter', 'openai', 'local'].includes(this.config.provider)) {
      errors.push('Invalid AI provider. Must be: openrouter, openai, or local');
    }

    if (errors.length > 0) {
      throw new Error(`AI Configuration errors:\n${errors.join('\n')}`);
    }
  }

  /**
   * Get configuration for specific provider
   */
  getProviderConfig(providerId = null) {
    const provider = providerId || this.config.provider;
    
    const baseConfig = {
      model: this.config.model,
      temperature: this.config.temperature,
      maxTokens: this.config.maxTokens,
      timeout: this.config.timeout
    };

    switch (provider) {
      case 'openrouter':
        return {
          ...baseConfig,
          apiKey: this.config.openRouterKey,
          baseUrl: 'https://openrouter.ai/api/v1',
          headers: {
            'HTTP-Referer': 'https://github.com/shortwavereport/monitor',
            'X-Title': 'Shortwave Report Monitor'
          }
        };

      case 'openai':
        return {
          ...baseConfig,
          apiKey: this.config.openAIKey,
          baseUrl: 'https://api.openai.com/v1',
          model: this.config.model.includes('llama') ? 'gpt-4o-mini' : this.config.model
        };

      case 'local':
        return {
          ...baseConfig,
          baseUrl: 'http://localhost:11434/v1',
          model: 'mock-model'
        };

      default:
        throw new Error(`Unknown AI provider: ${provider}`);
    }
  }

  /**
   * Get recommended free models for OpenRouter
   */
  getFreeModels() {
    return [
      {
        id: 'meta-llama/llama-3.2-3b-instruct:free',
        name: 'Llama 3.2 3B Instruct (Free)',
        description: 'Fast and efficient model for general tasks',
        recommended: true
      },
      {
        id: 'microsoft/phi-3-mini-128k-instruct:free',
        name: 'Phi-3 Mini 128K (Free)',
        description: 'Microsoft\'s compact model with long context'
      },
      {
        id: 'huggingface/zephyr-7b-beta:free',
        name: 'Zephyr 7B Beta (Free)',
        description: 'Fine-tuned for helpful and harmless responses'
      },
      {
        id: 'openchat/openchat-7b:free',
        name: 'OpenChat 7B (Free)',
        description: 'Optimized for conversational tasks'
      },
      {
        id: 'nousresearch/nous-capybara-7b:free',
        name: 'Nous Capybara 7B (Free)',
        description: 'Trained for instruction following'
      },
      {
        id: 'gryphe/mythomist-7b:free',
        name: 'Mythomist 7B (Free)',
        description: 'Creative and detailed responses'
      }
    ];
  }

  /**
   * Get setup instructions for users
   */
  getSetupInstructions() {
    return {
      openrouter: {
        title: 'OpenRouter Setup (RECOMMENDED - Free models available)',
        steps: [
          '1. Go to https://openrouter.ai/',
          '2. Sign up for a free account',
          '3. Navigate to API Keys section',
          '4. Create a new API key',
          '5. Add to .env file: OPENROUTER_API_KEY=your-key-here',
          '6. Set AI_PROVIDER=openrouter',
          '7. Choose a free model: AI_MODEL=meta-llama/llama-3.2-3b-instruct:free'
        ],
        cost: 'FREE for many models',
        pros: ['Free tier available', 'Multiple model options', 'No credit card required for free models'],
        cons: ['Rate limits on free tier', 'May have queuing during high usage']
      },
      openai: {
        title: 'OpenAI Setup (Paid service)',
        steps: [
          '1. Go to https://platform.openai.com/',
          '2. Sign up and add payment method',
          '3. Generate API key in API keys section',
          '4. Add to .env file: OPENAI_API_KEY=your-key-here',
          '5. Set AI_PROVIDER=openai',
          '6. Set AI_MODEL=gpt-4o-mini (recommended for cost)'
        ],
        cost: 'PAID - Usage-based pricing',
        pros: ['High quality responses', 'Reliable service', 'Fast response times'],
        cons: ['Requires payment', 'Can be expensive for high usage']
      },
      local: {
        title: 'Local/Mock Setup (Development only)',
        steps: [
          '1. Set USE_LOCAL_AI=true in .env file',
          '2. Set AI_PROVIDER=local',
          '3. Mock responses will be used for testing'
        ],
        cost: 'FREE',
        pros: ['No API key needed', 'Offline development', 'No usage limits'],
        cons: ['Mock responses only', 'Not suitable for production']
      }
    };
  }

  /**
   * Auto-detect best configuration
   */
  autoDetectBestSetup() {
    if (this.config.openRouterKey) {
      return {
        provider: 'openrouter',
        status: 'ready',
        message: 'OpenRouter API key detected - using free models'
      };
    }
    
    if (this.config.openAIKey) {
      return {
        provider: 'openai',
        status: 'ready',
        message: 'OpenAI API key detected - paid service'
      };
    }
    
    return {
      provider: 'local',
      status: 'fallback',
      message: 'No API keys found - using mock responses. See setup instructions.'
    };
  }

  /**
   * Get current configuration summary
   */
  getConfigSummary() {
    const detection = this.autoDetectBestSetup();
    
    return {
      provider: this.config.provider,
      model: this.config.model,
      enableAI: this.config.enableAI,
      hasAPIKey: !!(this.config.openRouterKey || this.config.openAIKey),
      useLocalAI: this.config.useLocalAI,
      detection,
      rateLimits: this.config.aiRateLimit,
      settings: {
        temperature: this.config.temperature,
        maxTokens: this.config.maxTokens,
        timeout: this.config.timeout
      }
    };
  }

  /**
   * Update configuration at runtime
   */
  updateConfig(updates) {
    Object.assign(this.config, updates);
    this.validateConfig();
    return this.getConfigSummary();
  }
}

// Export singleton instance
export const aiConfig = new AIConfig();
export default aiConfig;