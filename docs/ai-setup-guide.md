# AI Service Setup Guide

This guide explains how to configure AI services for the Shortwave Report Monitor. You have three options, with **OpenRouter being the recommended choice** for most users due to its free tier.

## 🌟 Option 1: OpenRouter (RECOMMENDED - Free Models Available)

OpenRouter provides access to multiple AI models, including several **completely free** options that work great for shortwave analysis.

### Why OpenRouter?
- ✅ **Free models available** - No credit card required
- ✅ **Multiple model choices** - Switch between models easily
- ✅ **Simple setup** - Just need an API key
- ✅ **Good for beginners** - No financial risk

### Setup Steps

1. **Create Account**
   - Go to [https://openrouter.ai/](https://openrouter.ai/)
   - Click "Sign Up" and create a free account
   - No credit card required for free models

2. **Get API Key**
   - After signing in, go to [API Keys](https://openrouter.ai/keys)
   - Click "Create Key"
   - Give it a name like "Shortwave Monitor"
   - Copy the generated key (starts with `sk-or-...`)

3. **Configure Environment**
   ```bash
   # Copy the example environment file
   cp .env.example .env
   
   # Edit .env file and add your OpenRouter key
   OPENROUTER_API_KEY=sk-or-your-actual-key-here
   AI_PROVIDER=openrouter
   AI_MODEL=meta-llama/llama-3.2-3b-instruct:free
   ```

4. **Test Configuration**
   ```bash
   # Start the system
   npm start
   
   # In another terminal, test AI service
   curl http://localhost:3000/ai/test
   ```

### Free Models Available

| Model | Description | Best For |
|-------|-------------|----------|
| `meta-llama/llama-3.2-3b-instruct:free` | ⭐ **Recommended** - Fast and efficient | General analysis, quick responses |
| `microsoft/phi-3-mini-128k-instruct:free` | Microsoft's compact model | Long context analysis |
| `huggingface/zephyr-7b-beta:free` | Helpful and harmless responses | Detailed explanations |
| `openchat/openchat-7b:free` | Optimized for conversations | Interactive analysis |
| `nousresearch/nous-capybara-7b:free` | Instruction following | Technical tasks |
| `gryphe/mythomist-7b:free` | Creative and detailed | Report generation |

### Free Tier Limitations
- Rate limits (usually 20-200 requests per minute)
- May have queuing during peak hours
- Some models may have daily usage limits

---

## 💰 Option 2: OpenAI (Paid Service)

OpenAI provides high-quality models but requires payment. Best for production deployments or when you need guaranteed performance.

### Setup Steps

1. **Create Account**
   - Go to [https://platform.openai.com/](https://platform.openai.com/)
   - Sign up and verify your account
   - Add a payment method (required)

2. **Get API Key**
   - Go to [API Keys](https://platform.openai.com/api-keys)
   - Click "Create new secret key"
   - Copy the key (starts with `sk-...`)

3. **Configure Environment**
   ```bash
   # Edit .env file
   OPENAI_API_KEY=sk-your-actual-openai-key-here
   AI_PROVIDER=openai
   AI_MODEL=gpt-4o-mini
   ```

### Recommended Models & Costs

| Model | Cost (per 1M tokens) | Best For |
|-------|---------------------|----------|
| `gpt-4o-mini` | $0.15 input / $0.60 output | ⭐ **Recommended** - Cost effective |
| `gpt-3.5-turbo` | $0.50 input / $1.50 output | Fast responses |
| `gpt-4o` | $2.50 input / $10.00 output | Highest quality |

**Estimated monthly costs for typical usage:**
- Light usage (100 analyses/day): $2-5/month
- Medium usage (500 analyses/day): $10-25/month  
- Heavy usage (2000 analyses/day): $50-100/month

---

## 🔧 Option 3: Local/Mock (Development Only)

For development or testing without any external API calls.

### Setup Steps

```bash
# Edit .env file
USE_LOCAL_AI=true
AI_PROVIDER=local
```

### What You Get
- ✅ **No API key needed**
- ✅ **Offline development**
- ✅ **No usage limits**
- ❌ **Mock responses only** - not suitable for production
- ❌ **Limited analysis quality**

---

## ⚙️ Advanced Configuration

### Environment Variables

```bash
# Required: Choose your provider
AI_PROVIDER=openrouter              # openrouter, openai, or local
OPENROUTER_API_KEY=your-key-here    # If using OpenRouter
OPENAI_API_KEY=your-key-here        # If using OpenAI

# Optional: Model settings
AI_MODEL=meta-llama/llama-3.2-3b-instruct:free  # Specific model to use
AI_TEMPERATURE=0.7                   # Creativity (0.0-2.0)
AI_MAX_TOKENS=1000                   # Max response length
AI_TIMEOUT=30000                     # Request timeout (ms)

# Optional: Feature flags
ENABLE_AI=true                       # Enable/disable AI features
AI_FALLBACK_TO_MOCK=true            # Use mock on API failure
AI_STRICT_MODE=false                # Require API key in production
```

### Rate Limiting Configuration

```bash
# AI service rate limits
AI_RATE_LIMIT_MAX=100               # Max requests per window
AI_RATE_LIMIT_WINDOW=3600000        # Window size (1 hour in ms)
```

---

## 🧪 Testing Your Setup

### 1. Check AI Service Status
```bash
curl http://localhost:3000/ai/status
```

Expected response:
```json
{
  "current": "OpenRouter",
  "id": "openrouter", 
  "authenticated": true,
  "available_models": ["meta-llama/llama-3.2-3b-instruct:free", "..."],
  "config": {
    "provider": "openrouter",
    "enableAI": true,
    "hasAPIKey": true
  }
}
```

### 2. Test AI Functionality
```bash
curl -X POST http://localhost:3000/ai/test
```

Expected response:
```json
{
  "success": true,
  "provider": "OpenRouter",
  "model": "meta-llama/llama-3.2-3b-instruct:free",
  "response_time": 1234
}
```

### 3. Test Audio Analysis
```bash
curl -X POST http://localhost:3000/ai/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Analyze this shortwave audio: 14.250 MHz USB voice communication",
    "options": {"temperature": 0.3, "maxTokens": 500}
  }'
```

---

## 🚨 Troubleshooting

### Common Issues

#### "No AI provider configured"
- **Cause**: Missing or invalid API key
- **Solution**: Check your `.env` file has the correct API key format
- **Check**: Run `curl http://localhost:3000/ai/status` to see current config

#### "Rate limit exceeded"
- **Cause**: Too many API requests
- **Solution**: Wait for rate limit reset or upgrade your plan
- **OpenRouter**: Check [usage dashboard](https://openrouter.ai/activity)
- **OpenAI**: Check [usage dashboard](https://platform.openai.com/usage)

#### "Model not available"
- **Cause**: Specified model doesn't exist or isn't accessible
- **Solution**: Check available models: `curl http://localhost:3000/ai/models`
- **OpenRouter**: Verify model is in free tier if using free account

#### "API timeout"
- **Cause**: Slow network or overloaded service
- **Solution**: Increase `AI_TIMEOUT` in `.env` file
- **Alternative**: Switch to faster model

#### "Invalid API key"
- **Cause**: Wrong key format or expired key
- **Solution**: Generate new key from provider dashboard
- **OpenRouter**: Key should start with `sk-or-`
- **OpenAI**: Key should start with `sk-`

### Getting Help

1. **Check Logs**: Look at application logs for detailed error messages
2. **Test Endpoints**: Use the `/ai/status` and `/ai/test` endpoints
3. **Provider Dashboards**: Check your usage and limits on provider websites
4. **GitHub Issues**: Report bugs at [project repository](https://github.com/shortwavereport/monitor/issues)

---

## 📊 Performance Comparison

| Provider | Speed | Quality | Cost | Setup Difficulty |
|----------|-------|---------|------|------------------|
| OpenRouter (Free) | ⭐⭐⭐ | ⭐⭐⭐⭐ | 🆓 **Free** | ⭐⭐⭐⭐⭐ Easy |
| OpenRouter (Paid) | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | 💰 Low | ⭐⭐⭐⭐⭐ Easy |
| OpenAI | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | 💰💰 Medium | ⭐⭐⭐⭐ Easy |
| Local/Mock | ⭐⭐⭐⭐⭐ | ⭐ | 🆓 **Free** | ⭐⭐⭐⭐⭐ Easy |

## 🎯 Recommendations

### For Beginners
👉 **Start with OpenRouter free tier**
- No financial risk
- Good quality results
- Easy to upgrade later

### For Production
👉 **OpenAI or OpenRouter paid**
- Guaranteed availability
- Higher rate limits
- Better support

### For Development
👉 **Local/Mock mode**
- No API dependencies
- Fast iteration
- Cost-free testing

---

## 🔗 Useful Links

- [OpenRouter Website](https://openrouter.ai/)
- [OpenRouter API Documentation](https://openrouter.ai/docs)
- [OpenAI Platform](https://platform.openai.com/)
- [OpenAI API Documentation](https://platform.openai.com/docs)
- [Project GitHub Repository](https://github.com/shortwavereport/monitor)

---

**Need help?** Check the troubleshooting section above or create an issue on GitHub.