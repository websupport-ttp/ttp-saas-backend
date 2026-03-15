// v1/utils/jwt.js
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { StatusCodes } = require('http-status-codes');
const { ApiError } = require('./apiError');
const logger = require('./logger');

/**
 * @function generateToken
 * @description Generates a JWT token with enhanced security features.
 * @param {object} payload - The payload to include in the token.
 * @param {string} secret - The secret key for signing the token.
 * @param {string} expiresIn - The expiration time for the token (e.g., '15m', '7d').
 * @param {object} options - Additional options for token generation.
 * @returns {string} The generated JWT token.
 */
const generateToken = (payload, secret, expiresIn, options = {}) => {
  const {
    issuer = 'travel-place-api',
    audience = 'travel-place-client',
    jwtid = crypto.randomUUID(),
    algorithm = 'HS256',
  } = options;

  const enhancedPayload = {
    ...payload,
    iat: Math.floor(Date.now() / 1000),
    jti: jwtid, // JWT ID for token tracking
  };

  return jwt.sign(enhancedPayload, secret, {
    expiresIn,
    algorithm,
    issuer,
    audience,
    // Don't pass jwtid here since we're already setting jti in the payload
  });
};

/**
 * @function verifyToken
 * @description Verifies a JWT token with enhanced security checks.
 * @param {string} token - The JWT token to verify.
 * @param {string} secret - The secret key for verifying the token.
 * @param {object} options - Additional verification options.
 * @returns {object} The decoded token payload.
 * @throws {ApiError} If the token is invalid or expired.
 */
const verifyToken = (token, secret, options = {}) => {
  const {
    issuer,
    audience,
    algorithms = ['HS256'],
    clockTolerance = 30, // 30 seconds tolerance for clock skew
    skipEnhancedChecks = false, // Allow skipping enhanced checks for backward compatibility
  } = options;

  try {
    const verifyOptions = {
      algorithms,
      clockTolerance,
    };

    // Only add issuer/audience if they were specified in the original token
    if (issuer) verifyOptions.issuer = issuer;
    if (audience) verifyOptions.audience = audience;

    const decoded = jwt.verify(token, secret, verifyOptions);

    // Additional security checks (skip for backward compatibility if needed)
    if (!skipEnhancedChecks && decoded.iss && !decoded.jti) {
      throw new ApiError('Token missing JWT ID', StatusCodes.UNAUTHORIZED);
    }

    return decoded;
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      throw new ApiError('Token expired', StatusCodes.UNAUTHORIZED);
    }
    if (error.name === 'JsonWebTokenError') {
      throw new ApiError('Invalid token', StatusCodes.UNAUTHORIZED);
    }
    if (error.name === 'NotBeforeError') {
      throw new ApiError('Token not active yet', StatusCodes.UNAUTHORIZED);
    }
    throw new ApiError('Token verification failed', StatusCodes.UNAUTHORIZED);
  }
};

/**
 * @function generateTokenPair
 * @description Generates a pair of access and refresh tokens with rotation support.
 * @param {object} user - The user object containing id and role.
 * @param {object} sessionInfo - Additional session information.
 * @returns {object} Object containing access and refresh tokens with metadata.
 */
const generateTokenPair = (user, sessionInfo = {}) => {
  const {
    ip,
    userAgent,
    deviceId,
    sessionId = crypto.randomUUID(),
  } = sessionInfo;

  const now = Math.floor(Date.now() / 1000);
  const accessTokenId = crypto.randomUUID();
  const refreshTokenId = crypto.randomUUID();

  // Access token payload
  const accessPayload = {
    userId: user._id,
    role: user.role,
    sessionId,
    tokenType: 'access',
    deviceId,
  };

  // Refresh token payload (includes additional security info)
  const refreshPayload = {
    userId: user._id,
    role: user.role,
    sessionId,
    tokenType: 'refresh',
    deviceId,
    ip: ip ? crypto.createHash('sha256').update(ip).digest('hex').substring(0, 16) : null,
    userAgent: userAgent ? crypto.createHash('sha256').update(userAgent).digest('hex').substring(0, 16) : null,
  };

  const accessToken = generateToken(
    accessPayload,
    process.env.JWT_ACCESS_SECRET,
    process.env.JWT_ACCESS_LIFETIME || '15m',
    { jwtid: accessTokenId }
  );

  const refreshToken = generateToken(
    refreshPayload,
    process.env.JWT_REFRESH_SECRET,
    process.env.JWT_REFRESH_LIFETIME || '7d',
    { jwtid: refreshTokenId }
  );

  return {
    accessToken,
    refreshToken,
    accessTokenId,
    refreshTokenId,
    sessionId,
    expiresAt: new Date((now + (15 * 60)) * 1000), // 15 minutes from now
    refreshExpiresAt: new Date((now + (7 * 24 * 60 * 60)) * 1000), // 7 days from now
  };
};

/**
 * @function attachCookiesToResponse
 * @description Attaches access and refresh tokens as HTTP-only cookies with enhanced security.
 * @param {object} res - The Express response object.
 * @param {object} user - The user object containing id and role.
 * @param {object} sessionInfo - Additional session information.
 */
const attachCookiesToResponse = (res, user, sessionInfo = {}) => {
  const tokenPair = generateTokenPair(user, sessionInfo);
  
  // Determine secure flag based on environment
  const isSecure = process.env.NODE_ENV === 'production';
  // Use 'None' for cross-domain cookies in production (frontend and backend on different subdomains)
  const sameSite = process.env.NODE_ENV === 'production' ? 'None' : 'Lax';

  // Access token cookie (shorter expiration)
  res.cookie('accessToken', tokenPair.accessToken, {
    httpOnly: true,
    secure: isSecure,
    signed: true,
    expires: tokenPair.expiresAt,
    sameSite,
    path: '/',
  });

  // Refresh token cookie (longer expiration, available on all API paths)
  res.cookie('refreshToken', tokenPair.refreshToken, {
    httpOnly: true,
    secure: isSecure,
    signed: true,
    expires: tokenPair.refreshExpiresAt,
    sameSite,
    path: '/', // Available on all paths for token rotation
  });

  // Session metadata cookie (for client-side session management)
  res.cookie('sessionInfo', JSON.stringify({
    sessionId: tokenPair.sessionId,
    expiresAt: tokenPair.expiresAt.toISOString(),
    userId: user._id,
    role: user.role,
  }), {
    httpOnly: false, // Allow client-side access for session management
    secure: isSecure,
    signed: false,
    expires: tokenPair.expiresAt,
    sameSite,
    path: '/',
  });

  return tokenPair;
};

/**
 * @function clearAuthCookies
 * @description Clears all authentication-related cookies.
 * @param {object} res - The Express response object.
 */
const clearAuthCookies = (res) => {
  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    signed: true,
    sameSite: process.env.NODE_ENV === 'production' ? 'None' : 'Lax',
  };

  res.clearCookie('accessToken', cookieOptions);
  res.clearCookie('refreshToken', { ...cookieOptions, path: '/' });
  res.clearCookie('sessionInfo', {
    ...cookieOptions,
    httpOnly: false,
    signed: false,
  });
};

/**
 * @function rotateRefreshToken
 * @description Rotates a refresh token and generates new token pair.
 * @param {string} oldRefreshToken - The current refresh token.
 * @param {object} sessionInfo - Session information for validation.
 * @returns {object} New token pair or null if rotation fails.
 */
const rotateRefreshToken = async (oldRefreshToken, sessionInfo = {}) => {
  try {
    // Verify the old refresh token
    const decoded = verifyToken(oldRefreshToken, process.env.JWT_REFRESH_SECRET);
    
    // Validate session information - log mismatches but don't fail
    // IP and User-Agent can change legitimately (network switch, browser update, etc.)
    const { ip, userAgent } = sessionInfo;
    if (decoded.ip && ip) {
      const hashedIP = crypto.createHash('sha256').update(ip).digest('hex').substring(0, 16);
      if (decoded.ip !== hashedIP) {
        logger.logSecurityEvent('TOKEN_ROTATION_IP_MISMATCH', {
          userId: decoded.userId,
          sessionId: decoded.sessionId,
          expectedIP: decoded.ip,
          actualIP: hashedIP,
        }, 'low'); // Changed from 'high' to 'low' - this is normal
      }
    }

    if (decoded.userAgent && userAgent) {
      const hashedUA = crypto.createHash('sha256').update(userAgent).digest('hex').substring(0, 16);
      if (decoded.userAgent !== hashedUA) {
        logger.logSecurityEvent('TOKEN_ROTATION_UA_MISMATCH', {
          userId: decoded.userId,
          sessionId: decoded.sessionId,
        }, 'low'); // Changed from 'medium' to 'low' - this is normal
      }
    }

    // Generate new token pair
    const user = { _id: decoded.userId, role: decoded.role };
    return generateTokenPair(user, {
      ...sessionInfo,
      sessionId: decoded.sessionId, // Maintain same session ID
      deviceId: decoded.deviceId,
    });

  } catch (error) {
    logger.logSecurityEvent('TOKEN_ROTATION_FAILED', {
      error: error.message,
      ...sessionInfo,
    }, 'medium');
    return null;
  }
};

/**
 * @function validateTokenFingerprint
 * @description Validates token against request fingerprint for additional security.
 * @param {object} tokenPayload - Decoded token payload.
 * @param {object} req - Express request object.
 * @returns {boolean} True if fingerprint matches.
 */
const validateTokenFingerprint = (tokenPayload, req) => {
  try {
    // Check IP address if stored in token
    if (tokenPayload.ip && req.ip) {
      const hashedIP = crypto.createHash('sha256').update(req.ip).digest('hex').substring(0, 16);
      if (tokenPayload.ip !== hashedIP) {
        return false;
      }
    }

    // Check User-Agent if stored in token
    if (tokenPayload.userAgent && req.get('User-Agent')) {
      const hashedUA = crypto.createHash('sha256').update(req.get('User-Agent')).digest('hex').substring(0, 16);
      if (tokenPayload.userAgent !== hashedUA) {
        return false;
      }
    }

    return true;
  } catch (error) {
    logger.warn('Token fingerprint validation error:', error.message);
    return false;
  }
};

/**
 * @function isTokenBlacklisted
 * @description Check if a token is blacklisted (for logout/revocation).
 * @param {string} jti - JWT ID to check.
 * @returns {Promise<boolean>} True if token is blacklisted.
 */
const isTokenBlacklisted = async (jti) => {
  try {
    const redisClient = require('../config/redis');
    if (!redisClient.isReady) {
      return false; // If Redis is down, allow token (graceful degradation)
    }

    const result = await redisClient.get(`blacklist:${jti}`);
    return result !== null;
  } catch (error) {
    logger.warn('Error checking token blacklist:', error.message);
    return false; // Graceful degradation
  }
};

/**
 * @function blacklistToken
 * @description Add a token to the blacklist.
 * @param {string} jti - JWT ID to blacklist.
 * @param {number} expiresIn - Seconds until token naturally expires.
 * @returns {Promise<boolean>} True if successfully blacklisted.
 */
const blacklistToken = async (jti, expiresIn) => {
  try {
    const redisClient = require('../config/redis');
    if (!redisClient.isReady) {
      return false;
    }

    await redisClient.setEx(`blacklist:${jti}`, expiresIn, 'revoked');
    return true;
  } catch (error) {
    logger.error('Error blacklisting token:', error.message);
    return false;
  }
};

module.exports = {
  generateToken,
  verifyToken,
  generateTokenPair,
  attachCookiesToResponse,
  clearAuthCookies,
  rotateRefreshToken,
  validateTokenFingerprint,
  isTokenBlacklisted,
  blacklistToken,
};