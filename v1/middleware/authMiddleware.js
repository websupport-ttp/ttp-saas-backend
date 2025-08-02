// v1/middleware/authMiddleware.js
const { StatusCodes } = require('http-status-codes');
const { ApiError } = require('../utils/apiError');
const asyncHandler = require('./asyncHandler');
const { 
  verifyToken, 
  rotateRefreshToken, 
  attachCookiesToResponse, 
  clearAuthCookies,
  validateTokenFingerprint,
  isTokenBlacklisted 
} = require('../utils/jwt');
const User = require('../models/userModel');
const Token = require('../models/tokenModel');
const logger = require('../utils/logger');

/**
 * @function extractTokenFromRequest
 * @description Helper function to extract access token from request (header or cookie)
 */
const extractTokenFromRequest = (req) => {
  // First try to get token from Authorization header
  const authHeader = req.get('Authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  
  // Fallback to signed cookies
  return req.signedCookies.accessToken;
};

/**
 * @function authenticateUser
 * @description Enhanced middleware to authenticate users with improved security features.
 * Supports token rotation, fingerprinting, and blacklist checking.
 */
const authenticateUser = asyncHandler(async (req, res, next) => {
  const accessToken = extractTokenFromRequest(req);
  const { refreshToken } = req.signedCookies;

  // Log authentication attempt
  logger.logSecurityEvent('AUTHENTICATION_ATTEMPT', {
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    endpoint: req.originalUrl,
    hasAccessToken: !!accessToken,
    hasRefreshToken: !!refreshToken,
  }, 'low');

  if (!accessToken) {
    if (!refreshToken) {
      throw new ApiError('Authentication required: No tokens provided', StatusCodes.UNAUTHORIZED);
    }

    // Attempt token rotation with refresh token
    const sessionInfo = {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
    };

    const newTokenPair = await rotateRefreshToken(refreshToken, sessionInfo);
    
    if (!newTokenPair) {
      // Token rotation failed - clear cookies and require re-authentication
      clearAuthCookies(res);
      throw new ApiError('Authentication invalid: Token rotation failed', StatusCodes.UNAUTHORIZED);
    }

    // Extract user ID from the refresh token payload for user lookup
    const refreshPayload = verifyToken(refreshToken, process.env.JWT_REFRESH_SECRET, { skipEnhancedChecks: true });
    const user = await User.findById(refreshPayload.userId);
    if (!user) {
      clearAuthCookies(res);
      throw new ApiError('Authentication invalid: User not found', StatusCodes.UNAUTHORIZED);
    }

    // Update token in database
    const existingToken = await Token.findOne({ user: user._id });
    if (existingToken) {
      existingToken.refreshToken = newTokenPair.refreshToken;
      existingToken.isValid = true;
      existingToken.ip = req.ip;
      existingToken.userAgent = req.get('User-Agent');
      await existingToken.save();
    } else {
      await Token.create({
        refreshToken: newTokenPair.refreshToken,
        user: user._id,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
      });
    }

    // Set new cookies
    const tokenPair = attachCookiesToResponse(res, user, sessionInfo);

    // Attach user to request
    req.user = { 
      userId: user._id, 
      role: user.role, 
      email: user.email,
      sessionId: tokenPair.sessionId 
    };

    logger.logSecurityEvent('TOKEN_ROTATED', {
      userId: user._id,
      sessionId: newTokenPair.sessionId,
      ip: req.ip,
    }, 'low');

    return next();
  }

  try {
    // Verify access token with backward compatibility
    const payload = verifyToken(accessToken, process.env.JWT_ACCESS_SECRET, { skipEnhancedChecks: true });

    // Check if token is blacklisted (only if token has jti)
    if (payload.jti && await isTokenBlacklisted(payload.jti)) {
      clearAuthCookies(res);
      throw new ApiError('Authentication invalid: Token has been revoked', StatusCodes.UNAUTHORIZED);
    }

    // Validate token fingerprint for additional security
    if (!validateTokenFingerprint(payload, req)) {
      logger.logSecurityEvent('TOKEN_FINGERPRINT_MISMATCH', {
        userId: payload.userId,
        sessionId: payload.sessionId,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
      }, 'high');
      
      clearAuthCookies(res);
      throw new ApiError('Authentication invalid: Token fingerprint mismatch', StatusCodes.UNAUTHORIZED);
    }

    // Verify user still exists and is active
    const user = await User.findById(payload.userId);
    if (!user) {
      clearAuthCookies(res);
      throw new ApiError('Authentication invalid: User not found', StatusCodes.UNAUTHORIZED);
    }

    // Update user's last login activity
    if (user.lastLoginAt < Date.now() - (5 * 60 * 1000)) { // Only update if last login was more than 5 minutes ago
      user.updateLoginActivity().catch(error => {
        logger.warn('Failed to update login activity:', error.message);
      });
    }

    // Attach user to request with additional session info
    req.user = { 
      userId: user._id, 
      role: user.role, 
      email: user.email,
      sessionId: payload.sessionId,
      tokenId: payload.jti 
    };

    next();
  } catch (error) {
    // Clear cookies on authentication failure
    clearAuthCookies(res);
    
    logger.logSecurityEvent('AUTHENTICATION_FAILED', {
      error: error.message,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      endpoint: req.originalUrl,
    }, 'medium');

    throw new ApiError('Authentication invalid: ' + error.message, StatusCodes.UNAUTHORIZED);
  }
});

/**
 * @function authorizeRoles
 * @description Enhanced middleware to restrict access based on user roles with audit logging.
 * @param {...string} roles - A list of roles that are allowed to access the route.
 * @returns {Function} An Express middleware function.
 */
const authorizeRoles = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !req.user.role) {
      throw new ApiError('Authorization failed: No user role found', StatusCodes.FORBIDDEN);
    }

    if (!roles.includes(req.user.role)) {
      logger.logSecurityEvent('AUTHORIZATION_FAILED', {
        userId: req.user.userId,
        userRole: req.user.role,
        requiredRoles: roles,
        endpoint: req.originalUrl,
        method: req.method,
        ip: req.ip,
      }, 'medium');

      throw new ApiError(
        `Unauthorized: User role (${req.user.role}) is not authorized to access this route`,
        StatusCodes.FORBIDDEN
      );
    }

    // Log successful authorization for sensitive roles
    if (['admin', 'manager'].includes(req.user.role)) {
      logger.logSecurityEvent('PRIVILEGED_ACCESS', {
        userId: req.user.userId,
        userRole: req.user.role,
        endpoint: req.originalUrl,
        method: req.method,
        ip: req.ip,
      }, 'low');
    }

    next();
  };
};

/**
 * @function optionalAuthenticateUser
 * @description Enhanced optional authentication with improved error handling.
 */
const optionalAuthenticateUser = asyncHandler(async (req, res, next) => {
  try {
    const { accessToken } = req.signedCookies;

    if (!accessToken) {
      return next();
    }

    // Verify access token with backward compatibility
    const payload = verifyToken(accessToken, process.env.JWT_ACCESS_SECRET, { skipEnhancedChecks: true });

    // Check if token is blacklisted (only if token has jti)
    if (payload.jti && await isTokenBlacklisted(payload.jti)) {
      clearAuthCookies(res);
      return next();
    }

    // Validate token fingerprint
    if (!validateTokenFingerprint(payload, req)) {
      clearAuthCookies(res);
      return next();
    }

    // Fetch user from database
    const user = await User.findById(payload.userId);
    if (!user) {
      clearAuthCookies(res);
      return next();
    }

    // Attach user to request
    req.user = { 
      userId: user._id, 
      role: user.role, 
      email: user.email,
      sessionId: payload.sessionId 
    };

    next();
  } catch (error) {
    // Authentication failed, continue as guest but clear invalid cookies
    logger.warn('Optional authentication failed:', error.message);
    clearAuthCookies(res);
    next();
  }
});

/**
 * @function requireEmailVerification
 * @description Middleware to require email verification for certain operations.
 */
const requireEmailVerification = asyncHandler(async (req, res, next) => {
  if (!req.user || !req.user.userId) {
    throw new ApiError('Authentication required', StatusCodes.UNAUTHORIZED);
  }

  const user = await User.findById(req.user.userId);
  if (!user) {
    throw new ApiError('User not found', StatusCodes.NOT_FOUND);
  }

  if (!user.isEmailVerified && user.email) {
    throw new ApiError('Email verification required to access this resource', StatusCodes.FORBIDDEN);
  }

  next();
});

/**
 * @function requirePhoneVerification
 * @description Middleware to require phone verification for certain operations.
 */
const requirePhoneVerification = asyncHandler(async (req, res, next) => {
  if (!req.user || !req.user.userId) {
    throw new ApiError('Authentication required', StatusCodes.UNAUTHORIZED);
  }

  const user = await User.findById(req.user.userId);
  if (!user) {
    throw new ApiError('User not found', StatusCodes.NOT_FOUND);
  }

  if (!user.isPhoneVerified && user.phoneNumber) {
    throw new ApiError('Phone verification required to access this resource', StatusCodes.FORBIDDEN);
  }

  next();
});

/**
 * @function preventConcurrentSessions
 * @description Middleware to prevent concurrent sessions (optional security feature).
 */
const preventConcurrentSessions = asyncHandler(async (req, res, next) => {
  if (!req.user || !req.user.userId) {
    return next();
  }

  // Check if there are multiple active sessions for this user
  const activeSessions = await Token.countDocuments({ 
    user: req.user.userId, 
    isValid: true 
  });

  if (activeSessions > 1) {
    logger.logSecurityEvent('CONCURRENT_SESSIONS_DETECTED', {
      userId: req.user.userId,
      activeSessionCount: activeSessions,
      currentSessionId: req.user.sessionId,
      ip: req.ip,
    }, 'medium');

    // Optionally invalidate all other sessions
    await Token.updateMany(
      { 
        user: req.user.userId, 
        isValid: true,
        refreshToken: { $ne: req.signedCookies.refreshToken }
      },
      { isValid: false }
    );
  }

  next();
});

module.exports = { 
  authenticateUser, 
  authorizeRoles, 
  optionalAuthenticateUser,
  requireEmailVerification,
  requirePhoneVerification,
  preventConcurrentSessions,
};