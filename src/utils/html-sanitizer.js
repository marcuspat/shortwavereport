/**
 * HTML Sanitization Utility for Shortwave Monitor
 * Prevents XSS attacks by properly escaping HTML content
 */

import { escape, unescape } from 'html-escaper';

export class HTMLSanitizer {
  /**
   * Escape HTML special characters to prevent XSS
   */
  static escapeHtml(text) {
    if (text === null || text === undefined) {
      return '';
    }
    
    if (typeof text === 'number') {
      return String(text);
    }
    
    if (typeof text !== 'string') {
      return escape(String(text));
    }
    
    return escape(text);
  }

  /**
   * Unescape HTML (use with caution, only for trusted content)
   */
  static unescapeHtml(text) {
    if (!text || typeof text !== 'string') {
      return '';
    }
    return unescape(text);
  }

  /**
   * Sanitize data recursively for safe display
   */
  static sanitizeForDisplay(data) {
    if (data === null || data === undefined) {
      return '';
    }
    
    if (typeof data === 'string') {
      return this.escapeHtml(data);
    }
    
    if (typeof data === 'number' || typeof data === 'boolean') {
      return data;
    }
    
    if (Array.isArray(data)) {
      return data.map(item => this.sanitizeForDisplay(item));
    }
    
    if (typeof data === 'object') {
      const sanitized = {};
      for (const [key, value] of Object.entries(data)) {
        sanitized[key] = this.sanitizeForDisplay(value);
      }
      return sanitized;
    }
    
    return this.escapeHtml(String(data));
  }

  /**
   * Sanitize specific fields that are safe to display as-is
   */
  static sanitizeWithWhitelist(data, safeFields = []) {
    if (typeof data !== 'object' || data === null) {
      return this.escapeHtml(data);
    }

    const sanitized = {};
    for (const [key, value] of Object.entries(data)) {
      if (safeFields.includes(key) && typeof value === 'number') {
        // Numbers are safe to display without escaping
        sanitized[key] = value;
      } else {
        sanitized[key] = this.sanitizeForDisplay(value);
      }
    }
    return sanitized;
  }

  /**
   * Create safe HTML attributes
   */
  static createSafeAttributes(attributes) {
    const safe = {};
    for (const [key, value] of Object.entries(attributes)) {
      // Only allow known safe attributes
      const safeAttributes = ['class', 'id', 'data-*', 'aria-*'];
      const isSafeAttribute = safeAttributes.some(attr => 
        key === attr || (attr.endsWith('*') && key.startsWith(attr.slice(0, -1)))
      );
      
      if (isSafeAttribute) {
        safe[key] = this.escapeHtml(value);
      }
    }
    return safe;
  }

  /**
   * Sanitize URLs to prevent javascript: and data: URIs
   */
  static sanitizeUrl(url) {
    if (!url || typeof url !== 'string') {
      return '';
    }

    // Remove dangerous protocols
    const dangerousProtocols = /^(javascript:|data:|vbscript:|file:|ftp:)/i;
    if (dangerousProtocols.test(url.trim())) {
      return '';
    }

    // Allow only http, https, and relative URLs
    const allowedProtocols = /^(https?:\/\/|\/)/i;
    if (!allowedProtocols.test(url.trim()) && !url.startsWith('#')) {
      return '';
    }

    return this.escapeHtml(url);
  }

  /**
   * Create safe template literals
   */
  static safeTemplate(strings, ...values) {
    let result = strings[0];
    
    for (let i = 0; i < values.length; i++) {
      result += this.escapeHtml(values[i]) + strings[i + 1];
    }
    
    return result;
  }

  /**
   * Validate and sanitize frequency values
   */
  static sanitizeFrequency(frequency) {
    const freq = parseFloat(frequency);
    if (isNaN(freq) || freq < 0 || freq > 30000000) {
      return 0;
    }
    return Math.round(freq);
  }

  /**
   * Sanitize quality scores (0-100)
   */
  static sanitizeQualityScore(score) {
    const quality = parseInt(score);
    if (isNaN(quality)) {
      return 0;
    }
    return Math.max(0, Math.min(100, quality));
  }

  /**
   * Sanitize station callsigns
   */
  static sanitizeCallsign(callsign) {
    if (!callsign || typeof callsign !== 'string') {
      return '';
    }
    
    // Allow only alphanumeric characters and common callsign symbols
    return callsign.replace(/[^a-zA-Z0-9\/\-]/g, '').substring(0, 20);
  }
}

export default HTMLSanitizer;