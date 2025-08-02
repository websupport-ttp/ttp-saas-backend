// v1/middleware/cacheMiddleware.js
const redisClient = require('../config/redis');
const logger = require('../utils/logger');
const { StatusCodes } = require('http-status-codes');

/**
 * @description Redis caching middleware for analytics dashboard
 * Provides caching functionality with configurable TTL and cache invalidation
 */

/**
 * @function cacheMiddleware
 * @description Middleware to cache API responses in Redis
 * @param {number} ttl - Time to live in seconds (default: 3600 = 1 hour)
 * @param {string} keyPrefix - Prefix for cache keys (default: 'analytics')
 * @returns {Function} Express middleware function
 */
const cacheMiddleware = (ttl = 3600, keyPrefix = 'analytics') => {
  return async (req, res, next) => {
    try {
      // Generate cache key based on route, query params, and user role
      const cacheKey = generateCacheKey(req, keyPrefix);
      
      // Check if Redis client is connected
      if (!redisClient.isOpen) {
        logger.warn('Redis client not connected, skipping cache');
        return next();
      }

      // Try to get cached data
      const cachedData = await redisClient.get(cacheKey);
      
      if (cachedData) {
        logger.info(`Cache hit for key: ${cacheKey}`);
        const parsedData = JSON.parse(cachedData);
        
        // Add cache metadata to response
        parsedData.cached = true;
        parsedData.cacheKey = cacheKey;
        parsedData.cachedAt = parsedData.cachedAt || new Date().toISOString();
        
        return res.status(StatusCodes.OK).json(parsedData);
      }

      // Cache miss - continue to controller
      logger.info(`Cache miss for key: ${cacheKey}`);
      
      // Override res.json to cache the response
      const originalJson = res.json;
      res.json = function(data) {
        // Only cache successful responses
        if (res.statusCode === StatusCodes.OK && data.success) {
          // Add cache metadata
          data.cached = false;
          data.cacheKey = cacheKey;
          data.cachedAt = new Date().toISOString();
          
          // Cache the response
          redisClient.setEx(cacheKey, ttl, JSON.stringify(data))
            .then(() => {
              logger.info(`Data cached with key: ${cacheKey}, TTL: ${ttl}s`);
            })
            .catch((error) => {
              logger.error('Error caching data:', error);
            });
        }
        
        // Call original json method
        return originalJson.call(this, data);
      };

      next();
    } catch (error) {
      logger.error('Cache middleware error:', error);
      // Continue without caching on error
      next();
    }
  };
};

/**
 * @function generateCacheKey
 * @description Generate a unique cache key based on request parameters
 * @param {Object} req - Express request object
 * @param {string} keyPrefix - Prefix for the cache key
 * @returns {string} Generated cache key
 */
const generateCacheKey = (req, keyPrefix) => {
  const route = req.route.path;
  const method = req.method;
  const userRole = req.user?.role || 'anonymous';
  
  // Sort query parameters for consistent key generation
  const sortedQuery = Object.keys(req.query)
    .sort()
    .reduce((result, key) => {
      result[key] = req.query[key];
      return result;
    }, {});
  
  const queryString = Object.keys(sortedQuery).length > 0 
    ? JSON.stringify(sortedQuery) 
    : 'no-query';
  
  // Create hash-like key to avoid very long keys
  const keyComponents = [keyPrefix, method, route, userRole, queryString];
  const cacheKey = keyComponents.join(':').replace(/[^a-zA-Z0-9:_-]/g, '_');
  
  return cacheKey;
};

/**
 * @function invalidateCache
 * @description Middleware to invalidate cache patterns
 * @param {string|Array} patterns - Cache key patterns to invalidate
 * @returns {Function} Express middleware function
 */
const invalidateCache = (patterns) => {
  return async (req, res, next) => {
    try {
      if (!redisClient.isOpen) {
        logger.warn('Redis client not connected, skipping cache invalidation');
        return next();
      }

      const patternsArray = Array.isArray(patterns) ? patterns : [patterns];
      
      for (const pattern of patternsArray) {
        const keys = await redisClient.keys(pattern);
        if (keys.length > 0) {
          await redisClient.del(keys);
          logger.info(`Invalidated ${keys.length} cache keys matching pattern: ${pattern}`);
        }
      }
      
      next();
    } catch (error) {
      logger.error('Cache invalidation error:', error);
      next();
    }
  };
};

/**
 * @function clearAnalyticsCache
 * @description Clear all analytics-related cache entries
 * @param {string} category - Optional category to clear (e.g., 'revenue', 'customer')
 * @returns {Promise<number>} Number of keys deleted
 */
const clearAnalyticsCache = async (category = null) => {
  try {
    if (!redisClient.isOpen) {
      logger.warn('Redis client not connected, cannot clear cache');
      return 0;
    }

    let pattern = 'analytics:*';
    if (category) {
      pattern = `analytics:*${category}*`;
    }

    const keys = await redisClient.keys(pattern);
    if (keys.length > 0) {
      const deletedCount = await redisClient.del(keys);
      logger.info(`Cleared ${deletedCount} analytics cache entries`);
      return deletedCount;
    }

    return 0;
  } catch (error) {
    logger.error('Error clearing analytics cache:', error);
    throw error;
  }
};

/**
 * @function getCacheStats
 * @description Get cache statistics for monitoring
 * @returns {Promise<Object>} Cache statistics
 */
const getCacheStats = async () => {
  try {
    if (!redisClient.isOpen) {
      return { connected: false, error: 'Redis client not connected' };
    }

    const analyticsKeys = await redisClient.keys('analytics:*');
    const info = await redisClient.info('memory');
    
    return {
      connected: true,
      analyticsKeysCount: analyticsKeys.length,
      memoryInfo: info,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    logger.error('Error getting cache stats:', error);
    return { connected: false, error: error.message };
  }
};

/**
 * @function rateLimitByRole
 * @description Rate limiting middleware based on user role
 * @param {Object} limits - Rate limits by role (requests per minute)
 * @returns {Function} Express middleware function
 */
const rateLimitByRole = (limits = {}) => {
  const defaultLimits = {
    Manager: 100,
    Executive: 200,
    Admin: 500,
    default: 50
  };
  
  const roleLimits = { ...defaultLimits, ...limits };
  
  return async (req, res, next) => {
    try {
      if (!redisClient.isOpen) {
        logger.warn('Redis client not connected, skipping rate limiting');
        return next();
      }

      const userRole = req.user?.role || 'default';
      const userId = req.user?.userId || 'anonymous';
      const limit = roleLimits[userRole] || roleLimits.default;
      
      const key = `rate_limit:analytics:${userRole}:${userId}`;
      const current = await redisClient.get(key);
      
      if (current && parseInt(current) >= limit) {
        return res.status(StatusCodes.TOO_MANY_REQUESTS).json({
          success: false,
          message: `Rate limit exceeded. Maximum ${limit} requests per minute for ${userRole} role.`,
          error: 'RATE_LIMIT_EXCEEDED'
        });
      }
      
      // Increment counter
      const multi = redisClient.multi();
      multi.incr(key);
      multi.expire(key, 60); // 1 minute window
      await multi.exec();
      
      // Add rate limit headers
      res.set({
        'X-RateLimit-Limit': limit,
        'X-RateLimit-Remaining': Math.max(0, limit - (parseInt(current) || 0) - 1),
        'X-RateLimit-Reset': new Date(Date.now() + 60000).toISOString()
      });
      
      next();
    } catch (error) {
      logger.error('Rate limiting error:', error);
      next();
    }
  };
};

module.exports = {
  cacheMiddleware,
  invalidateCache,
  clearAnalyticsCache,
  getCacheStats,
  rateLimitByRole,
  generateCacheKey
};