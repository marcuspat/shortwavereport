/**
 * Input Validation Utility for Shortwave Monitor
 * Provides comprehensive validation schemas and functions
 */

import Joi from 'joi';

export const schemas = {
  // SDR URL validation
  sdrUrl: Joi.string()
    .uri({ scheme: ['http', 'https'] })
    .max(200)
    .pattern(/^https?:\/\/[a-zA-Z0-9.-]+:[0-9]{1,5}\/?/)
    .required(),
  
  // Location validation
  location: Joi.string()
    .pattern(/^[a-zA-Z0-9\s,.-]+$/)
    .min(1)
    .max(100)
    .trim()
    .required(),
  
  // Frequency validation (in Hz)
  frequency: Joi.number()
    .integer()
    .min(100000)    // 100 kHz minimum
    .max(30000000)  // 30 MHz maximum
    .required(),
  
  // Filename validation
  filename: Joi.string()
    .pattern(/^[a-zA-Z0-9._-]+$/)
    .min(1)
    .max(255)
    .required(),
  
  // Quality score validation
  qualityScore: Joi.number()
    .integer()
    .min(0)
    .max(100)
    .default(0),
  
  // Audio configuration validation
  audioConfig: Joi.object({
    frequency: Joi.number().integer().min(100000).max(30000000).required(),
    mode: Joi.string().valid('am', 'fm', 'usb', 'lsb', 'cw').required(),
    bandwidth: Joi.number().integer().min(100).max(10000).required(),
    type: Joi.string().valid('hf_voice', 'broadcast', 'cw_digital', 'utility').required(),
    description: Joi.string().max(200).optional()
  }),

  // SDR object validation
  sdr: Joi.object({
    url: Joi.string().uri({ scheme: ['http', 'https'] }).required(),
    location: Joi.string().pattern(/^[a-zA-Z0-9\s,.-]+$/).max(100).required(),
    frequencies: Joi.array().items(Joi.string().max(50)).min(1).max(20),
    quality_score: Joi.number().integer().min(0).max(100).default(0),
    last_checked: Joi.string().isoDate(),
    network: Joi.string().valid('WebSDR', 'KiwiSDR', 'OpenWebRX').required(),
    status: Joi.string().valid('online', 'offline', 'unknown').default('unknown'),
    response_time: Joi.number().integer().min(0).max(60000).optional()
  }),

  // Audio sample validation
  audioSample: Joi.object({
    id: Joi.string().pattern(/^[a-zA-Z0-9_-]+$/).required(),
    filename: Joi.string().pattern(/^[a-zA-Z0-9._-]+$/).required(),
    filepath: Joi.string().required(),
    sdr: Joi.object().required(),
    config: Joi.object().required(),
    metadata: Joi.object({
      frequency: Joi.number().integer().min(100000).max(30000000).required(),
      mode: Joi.string().valid('am', 'fm', 'usb', 'lsb', 'cw').required(),
      bandwidth: Joi.number().integer().min(100).max(10000).required(),
      duration: Joi.number().integer().min(1).max(300).required(),
      sampleRate: Joi.number().integer().min(8000).max(48000).required(),
      timestamp: Joi.string().isoDate().required(),
      quality_estimate: Joi.number().integer().min(0).max(100).required()
    })
  }),

  // Station callsign validation
  callsign: Joi.string()
    .pattern(/^[A-Z0-9\/\-]{1,20}$/)
    .uppercase()
    .required(),

  // Language validation
  language: Joi.string()
    .valid('english', 'spanish', 'french', 'german', 'italian', 'portuguese', 'russian', 'chinese', 'japanese', 'arabic', 'unknown')
    .default('unknown'),

  // Content type validation
  contentType: Joi.string()
    .valid('voice', 'broadcast', 'cw', 'digital', 'utility', 'unknown')
    .default('unknown'),

  // User input validation
  userCredentials: Joi.object({
    username: Joi.string()
      .pattern(/^[a-zA-Z0-9_-]+$/)
      .min(3)
      .max(30)
      .required(),
    password: Joi.string()
      .min(8)
      .max(128)
      .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
      .required()
      .messages({
        'string.pattern.base': 'Password must contain at least one lowercase letter, one uppercase letter, one number, and one special character'
      })
  }),

  // API request validation
  apiRequest: Joi.object({
    limit: Joi.number().integer().min(1).max(100).default(10),
    offset: Joi.number().integer().min(0).default(0),
    sortBy: Joi.string().valid('timestamp', 'quality', 'frequency', 'location').default('timestamp'),
    sortOrder: Joi.string().valid('asc', 'desc').default('desc'),
    filter: Joi.object({
      network: Joi.string().valid('WebSDR', 'KiwiSDR', 'OpenWebRX').optional(),
      minQuality: Joi.number().integer().min(0).max(100).optional(),
      maxQuality: Joi.number().integer().min(0).max(100).optional(),
      location: Joi.string().max(100).optional()
    }).optional()
  })
};

/**
 * Validate input against a schema
 */
export function validateInput(data, schema) {
  const { error, value } = schema.validate(data, {
    abortEarly: false,
    stripUnknown: true,
    convert: true
  });
  
  if (error) {
    const errors = error.details.map(detail => detail.message);
    throw new Error(`Validation failed: ${errors.join(', ')}`);
  }
  
  return value;
}

/**
 * Validate multiple inputs
 */
export function validateMultiple(validations) {
  const results = [];
  const errors = [];
  
  for (const { data, schema, name } of validations) {
    try {
      const result = validateInput(data, schema);
      results.push({ name, result, valid: true });
    } catch (error) {
      results.push({ name, error: error.message, valid: false });
      errors.push(`${name}: ${error.message}`);
    }
  }
  
  if (errors.length > 0) {
    throw new Error(`Multiple validation errors: ${errors.join('; ')}`);
  }
  
  return results;
}

/**
 * Sanitize and validate SDR data
 */
export function validateSDRData(sdrData) {
  if (!Array.isArray(sdrData)) {
    sdrData = [sdrData];
  }
  
  const validSDRs = [];
  const errors = [];
  
  for (let i = 0; i < sdrData.length; i++) {
    try {
      const validSDR = validateInput(sdrData[i], schemas.sdr);
      validSDRs.push(validSDR);
    } catch (error) {
      errors.push(`SDR ${i}: ${error.message}`);
    }
  }
  
  if (errors.length > 0) {
    console.warn(`SDR validation warnings: ${errors.join('; ')}`);
  }
  
  return validSDRs;
}

/**
 * Validate and sanitize frequency value
 */
export function validateFrequency(frequency) {
  try {
    return validateInput(frequency, schemas.frequency);
  } catch (error) {
    throw new Error(`Invalid frequency: ${error.message}`);
  }
}

/**
 * Validate audio configuration
 */
export function validateAudioConfig(config) {
  try {
    return validateInput(config, schemas.audioConfig);
  } catch (error) {
    throw new Error(`Invalid audio configuration: ${error.message}`);
  }
}

/**
 * Create validation middleware for Express
 */
export function createValidationMiddleware(schema) {
  return (req, res, next) => {
    try {
      req.validatedData = validateInput(req.body, schema);
      next();
    } catch (error) {
      res.status(400).json({
        error: 'Validation failed',
        details: error.message,
        timestamp: new Date().toISOString()
      });
    }
  };
}

/**
 * Validate query parameters
 */
export function validateQueryParams(req, res, next) {
  try {
    req.validatedQuery = validateInput(req.query, schemas.apiRequest);
    next();
  } catch (error) {
    res.status(400).json({
      error: 'Invalid query parameters',
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * Custom validation functions
 */
export const customValidators = {
  /**
   * Validate URL is from allowed domains
   */
  isAllowedDomain(url, allowedDomains = []) {
    try {
      const urlObj = new URL(url);
      const domain = urlObj.hostname.toLowerCase();
      
      // If no allowed domains specified, allow all
      if (allowedDomains.length === 0) {
        return true;
      }
      
      return allowedDomains.some(allowed => 
        domain === allowed || domain.endsWith(`.${allowed}`)
      );
    } catch {
      return false;
    }
  },

  /**
   * Validate timestamp is recent
   */
  isRecentTimestamp(timestamp, maxAgeMs = 24 * 60 * 60 * 1000) {
    try {
      const date = new Date(timestamp);
      const now = new Date();
      return (now - date) <= maxAgeMs;
    } catch {
      return false;
    }
  },

  /**
   * Validate file extension
   */
  hasValidExtension(filename, allowedExtensions = ['.wav', '.mp3']) {
    if (!filename || typeof filename !== 'string') {
      return false;
    }
    
    const ext = filename.toLowerCase().substring(filename.lastIndexOf('.'));
    return allowedExtensions.includes(ext);
  }
};

export default {
  schemas,
  validateInput,
  validateMultiple,
  validateSDRData,
  validateFrequency,
  validateAudioConfig,
  createValidationMiddleware,
  validateQueryParams,
  customValidators
};