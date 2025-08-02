// v1/utils/securityConfig.js
const crypto = require('crypto');

/**
 * @description Security configuration constants and utilities
 */
const SecurityConfig = {
  // Password requirements
  PASSWORD: {
    MIN_LENGTH: 8,
    MAX_LENGTH: 128,
    REQUIRE_UPPERCASE: true,
    REQUIRE_LOWERCASE: true,
    REQUIRE_NUMBERS: true,
    REQUIRE_SPECIAL_CHARS: true,
    SPECIAL_CHARS: '!@#$%^&*()_+-=[]{}|;:,.<>?',
    COMMON_PASSWORDS: [
      'password', '123456', '123456789', 'qwerty', 'abc123',
      'password123', 'admin', 'letmein', 'welcome', 'monkey'
    ],
  },

  // Session management
  SESSION: {
    MAX_CONCURRENT_SESSIONS: 3,
    IDLE_TIMEOUT: 30 * 60 * 1000, // 30 minutes
    ABSOLUTE_TIMEOUT: 8 * 60 * 60 * 1000, // 8 hours
    ROTATION_INTERVAL: 15 * 60 * 1000, // 15 minutes
  },

  // Rate limiting
  RATE_LIMITS: {
    GLOBAL: { windowMs: 15 * 60 * 1000, max: 1000 },
    AUTH: { windowMs: 15 * 60 * 1000, max: 10 },
    STRICT_AUTH: { windowMs: 60 * 60 * 1000, max: 3 },
    PAYMENT: { windowMs: 10 * 60 * 1000, max: 5 },
    UPLOAD: { windowMs: 5 * 60 * 1000, max: 10 },
  },

  // File upload restrictions
  UPLOAD: {
    MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
    ALLOWED_IMAGE_TYPES: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
    ALLOWED_DOCUMENT_TYPES: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    BLOCKED_EXTENSIONS: ['.exe', '.bat', '.cmd', '.com', '.pif', '.scr', '.vbs', '.js', '.jar', '.php', '.asp', '.jsp'],
  },

  // Security headers
  HEADERS: {
    HSTS_MAX_AGE: 31536000, // 1 year
    CSP_DIRECTIVES: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      imgSrc: ["'self'", 'data:', 'https:', 'blob:'],
      scriptSrc: ["'self'"],
      objectSrc: ["'none'"],
    },
  },

  // Audit logging
  AUDIT: {
    RETENTION_DAYS: 365,
    HIGH_RISK_RETENTION_DAYS: 2555, // 7 years
    CATEGORIES: {
      AUTH: 'Authentication operations',
      USER_MANAGEMENT: 'User management operations',
      FINANCIAL: 'Financial transactions',
      CONTENT: 'Content management',
      ADMIN: 'Administrative operations',
    },
  },

  // Encryption
  ENCRYPTION: {
    ALGORITHM: 'aes-256-gcm',
    KEY_LENGTH: 32,
    IV_LENGTH: 16,
    TAG_LENGTH: 16,
  },
};

/**
 * @function validatePassword
 * @description Validates password against security requirements
 * @param {string} password - Password to validate
 * @returns {object} Validation result with isValid and errors
 */
const validatePassword = (password) => {
  const errors = [];
  const config = SecurityConfig.PASSWORD;

  if (!password || typeof password !== 'string') {
    return { isValid: false, errors: ['Password is required'] };
  }

  if (password.length < config.MIN_LENGTH) {
    errors.push(`Password must be at least ${config.MIN_LENGTH} characters long`);
  }

  if (password.length > config.MAX_LENGTH) {
    errors.push(`Password must not exceed ${config.MAX_LENGTH} characters`);
  }

  if (config.REQUIRE_UPPERCASE && !/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }

  if (config.REQUIRE_LOWERCASE && !/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }

  if (config.REQUIRE_NUMBERS && !/\d/.test(password)) {
    errors.push('Password must contain at least one number');
  }

  if (config.REQUIRE_SPECIAL_CHARS) {
    const specialCharsRegex = new RegExp(`[${config.SPECIAL_CHARS.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}]`);
    if (!specialCharsRegex.test(password)) {
      errors.push('Password must contain at least one special character');
    }
  }

  // Check against common passwords
  if (config.COMMON_PASSWORDS.includes(password.toLowerCase())) {
    errors.push('Password is too common, please choose a more secure password');
  }

  // Check for repeated characters
  if (/(.)\1{2,}/.test(password)) {
    errors.push('Password should not contain repeated characters');
  }

  return {
    isValid: errors.length === 0,
    errors,
    strength: calculatePasswordStrength(password),
  };
};

/**
 * @function calculatePasswordStrength
 * @description Calculates password strength score
 * @param {string} password - Password to analyze
 * @returns {object} Strength analysis
 */
const calculatePasswordStrength = (password) => {
  let score = 0;
  const feedback = [];

  // Length bonus
  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  if (password.length >= 16) score += 1;

  // Character variety
  if (/[a-z]/.test(password)) score += 1;
  if (/[A-Z]/.test(password)) score += 1;
  if (/\d/.test(password)) score += 1;
  if (/[^a-zA-Z\d]/.test(password)) score += 1;

  // Patterns (negative points)
  if (/(.)\1{2,}/.test(password)) {
    score -= 1;
    feedback.push('Avoid repeated characters');
  }

  if (/123|abc|qwe/i.test(password)) {
    score -= 1;
    feedback.push('Avoid sequential characters');
  }

  const strength = score <= 2 ? 'weak' : score <= 4 ? 'medium' : score <= 6 ? 'strong' : 'very-strong';

  return { score, strength, feedback };
};

/**
 * @function generateSecureToken
 * @description Generates a cryptographically secure random token
 * @param {number} length - Token length in bytes
 * @returns {string} Hex-encoded token
 */
const generateSecureToken = (length = 32) => {
  return crypto.randomBytes(length).toString('hex');
};

/**
 * @function hashSensitiveData
 * @description Hashes sensitive data for storage/comparison
 * @param {string} data - Data to hash
 * @param {string} salt - Optional salt (generated if not provided)
 * @returns {object} Hash and salt
 */
const hashSensitiveData = (data, salt = null) => {
  if (!salt) {
    salt = crypto.randomBytes(16).toString('hex');
  }
  
  const hash = crypto.pbkdf2Sync(data, salt, 100000, 64, 'sha512').toString('hex');
  
  return { hash, salt };
};

/**
 * @function verifySensitiveData
 * @description Verifies sensitive data against stored hash
 * @param {string} data - Data to verify
 * @param {string} hash - Stored hash
 * @param {string} salt - Stored salt
 * @returns {boolean} True if data matches
 */
const verifySensitiveData = (data, hash, salt) => {
  const verifyHash = crypto.pbkdf2Sync(data, salt, 100000, 64, 'sha512').toString('hex');
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(verifyHash, 'hex'));
};

/**
 * @function encryptData
 * @description Encrypts data using AES-256-GCM
 * @param {string} data - Data to encrypt
 * @param {string} key - Encryption key (hex)
 * @returns {object} Encrypted data with IV and tag
 */
const encryptData = (data, key) => {
  const config = SecurityConfig.ENCRYPTION;
  const keyBuffer = Buffer.from(key, 'hex');
  const iv = crypto.randomBytes(config.IV_LENGTH);
  
  const cipher = crypto.createCipher(config.ALGORITHM, keyBuffer);
  cipher.setAAD(Buffer.from('additional-data'));
  
  let encrypted = cipher.update(data, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const tag = cipher.getAuthTag();
  
  return {
    encrypted,
    iv: iv.toString('hex'),
    tag: tag.toString('hex'),
  };
};

/**
 * @function decryptData
 * @description Decrypts data using AES-256-GCM
 * @param {object} encryptedData - Object with encrypted, iv, and tag
 * @param {string} key - Decryption key (hex)
 * @returns {string} Decrypted data
 */
const decryptData = (encryptedData, key) => {
  const config = SecurityConfig.ENCRYPTION;
  const keyBuffer = Buffer.from(key, 'hex');
  const iv = Buffer.from(encryptedData.iv, 'hex');
  const tag = Buffer.from(encryptedData.tag, 'hex');
  
  const decipher = crypto.createDecipher(config.ALGORITHM, keyBuffer);
  decipher.setAAD(Buffer.from('additional-data'));
  decipher.setAuthTag(tag);
  
  let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
};

/**
 * @function sanitizeForLogging
 * @description Sanitizes sensitive data for logging
 * @param {any} data - Data to sanitize
 * @param {Array} sensitiveFields - Fields to mask
 * @returns {any} Sanitized data
 */
const sanitizeForLogging = (data, sensitiveFields = ['password', 'token', 'secret', 'key']) => {
  if (!data || typeof data !== 'object') {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map(item => sanitizeForLogging(item, sensitiveFields));
  }

  const sanitized = {};
  for (const [key, value] of Object.entries(data)) {
    const lowerKey = key.toLowerCase();
    const isSensitive = sensitiveFields.some(field => lowerKey.includes(field.toLowerCase()));

    if (isSensitive) {
      sanitized[key] = typeof value === 'string' && value.length > 0 
        ? `${value.substring(0, 2)}***${value.substring(value.length - 2)}`
        : '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeForLogging(value, sensitiveFields);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
};

/**
 * @function isValidOrigin
 * @description Validates request origin against allowed origins
 * @param {string} origin - Request origin
 * @param {Array} allowedOrigins - List of allowed origins
 * @returns {boolean} True if origin is allowed
 */
const isValidOrigin = (origin, allowedOrigins = []) => {
  if (!origin) return true; // Allow requests with no origin (mobile apps, etc.)
  
  return allowedOrigins.some(allowed => {
    if (allowed === '*') return true;
    if (allowed.startsWith('*.')) {
      const domain = allowed.substring(2);
      return origin.endsWith(domain);
    }
    return origin === allowed;
  });
};

module.exports = {
  SecurityConfig,
  validatePassword,
  calculatePasswordStrength,
  generateSecureToken,
  hashSensitiveData,
  verifySensitiveData,
  encryptData,
  decryptData,
  sanitizeForLogging,
  isValidOrigin,
};