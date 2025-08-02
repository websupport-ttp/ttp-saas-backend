// v1/middleware/contentWorkflowMiddleware.js
const asyncHandler = require('./asyncHandler');
const { ApiError } = require('../utils/apiError');
const { StatusCodes } = require('http-status-codes');
const Post = require('../models/postModel');
const logger = require('../utils/logger');

/**
 * @function validateBulkOperations
 * @description Middleware to validate bulk operations on posts
 * @param {string} operation - The operation being performed ('publish', 'archive', 'delete')
 * @returns {Function} An Express middleware function
 */
const validateBulkOperations = (operation) =>
  asyncHandler(async (req, res, next) => {
    const { postIds } = req.body;

    if (!postIds || !Array.isArray(postIds) || postIds.length === 0) {
      throw new ApiError('Post IDs array is required for bulk operations', StatusCodes.BAD_REQUEST);
    }

    if (postIds.length > 50) {
      throw new ApiError('Bulk operations are limited to 50 posts at a time', StatusCodes.BAD_REQUEST);
    }

    // Validate that all IDs are valid MongoDB ObjectIds
    const invalidIds = postIds.filter(id => !/^[0-9a-fA-F]{24}$/.test(id));
    if (invalidIds.length > 0) {
      throw new ApiError(`Invalid post IDs: ${invalidIds.join(', ')}`, StatusCodes.BAD_REQUEST);
    }

    // Check if all posts exist and user has permission to perform the operation
    const posts = await Post.find({ _id: { $in: postIds } });
    
    if (posts.length !== postIds.length) {
      const foundIds = posts.map(post => post._id.toString());
      const missingIds = postIds.filter(id => !foundIds.includes(id));
      throw new ApiError(`Posts not found: ${missingIds.join(', ')}`, StatusCodes.NOT_FOUND);
    }

    // Check permissions based on operation and user role
    const isStaffOrAbove = ['Staff', 'Manager', 'Executive', 'Admin'].includes(req.user.role);
    const userPosts = posts.filter(post => post.author.toString() === req.user.userId);

    if (!isStaffOrAbove && userPosts.length !== posts.length) {
      throw new ApiError('You can only perform bulk operations on your own posts', StatusCodes.FORBIDDEN);
    }

    // Operation-specific validations
    switch (operation) {
      case 'publish':
        const canPublish = ['Manager', 'Executive', 'Admin'].includes(req.user.role);
        if (!canPublish) {
          throw new ApiError('Insufficient permissions to publish posts', StatusCodes.FORBIDDEN);
        }
        
        const unpublishablePosts = posts.filter(post => {
          if (post.postType === 'Packages') {
            return !post.price || post.price <= 0 || !post.metadata?.duration || !post.metadata?.location;
          }
          return false;
        });

        if (unpublishablePosts.length > 0) {
          const invalidTitles = unpublishablePosts.map(post => post.title);
          throw new ApiError(
            `Cannot publish packages without required fields: ${invalidTitles.join(', ')}`,
            StatusCodes.BAD_REQUEST
          );
        }
        break;

      case 'delete':
        const publishedPosts = posts.filter(post => post.status === 'Published');
        if (publishedPosts.length > 0 && !['Manager', 'Executive', 'Admin'].includes(req.user.role)) {
          throw new ApiError('Only managers and above can delete published posts', StatusCodes.FORBIDDEN);
        }
        break;
    }

    req.validatedPosts = posts;
    next();
  });

/**
 * @function validateContentScheduling
 * @description Middleware to validate content scheduling operations
 * @returns {Function} An Express middleware function
 */
const validateContentScheduling = () =>
  asyncHandler(async (req, res, next) => {
    const { publishAt, archiveAt } = req.body;

    if (publishAt) {
      const publishDate = new Date(publishAt);
      
      if (isNaN(publishDate.getTime())) {
        throw new ApiError('Invalid publish date format', StatusCodes.BAD_REQUEST);
      }

      if (publishDate <= new Date()) {
        throw new ApiError('Publish date must be in the future', StatusCodes.BAD_REQUEST);
      }

      // Check if user has publishing rights
      const canSchedulePublish = ['Manager', 'Executive', 'Admin'].includes(req.user.role);
      if (!canSchedulePublish) {
        throw new ApiError('Insufficient permissions to schedule publishing', StatusCodes.FORBIDDEN);
      }
    }

    if (archiveAt) {
      const archiveDate = new Date(archiveAt);
      
      if (isNaN(archiveDate.getTime())) {
        throw new ApiError('Invalid archive date format', StatusCodes.BAD_REQUEST);
      }

      if (publishAt && archiveDate <= new Date(publishAt)) {
        throw new ApiError('Archive date must be after publish date', StatusCodes.BAD_REQUEST);
      }
    }

    next();
  });

/**
 * @function logContentActivity
 * @description Middleware to log content management activities
 * @param {string} action - The action being performed
 * @returns {Function} An Express middleware function
 */
const logContentActivity = (action) =>
  asyncHandler(async (req, res, next) => {
    const originalSend = res.send;
    
    res.send = function(data) {
      // Log the activity after successful response
      if (res.statusCode >= 200 && res.statusCode < 300) {
        const logData = {
          action,
          userId: req.user?.userId,
          userRole: req.user?.role,
          postId: req.params?.id,
          postIds: req.body?.postIds,
          timestamp: new Date(),
          ip: req.ip,
          userAgent: req.get('User-Agent'),
        };

        logger.info(`Content Management Activity: ${action}`, logData);
      }
      
      originalSend.call(this, data);
    };

    next();
  });

/**
 * @function validateContentDuplication
 * @description Middleware to validate content duplication operations
 * @returns {Function} An Express middleware function
 */
const validateContentDuplication = () =>
  asyncHandler(async (req, res, next) => {
    const { sourcePostId, newTitle, newSlug } = req.body;

    if (!sourcePostId) {
      throw new ApiError('Source post ID is required for duplication', StatusCodes.BAD_REQUEST);
    }

    // Check if source post exists
    const sourcePost = await Post.findById(sourcePostId);
    if (!sourcePost) {
      throw new ApiError('Source post not found', StatusCodes.NOT_FOUND);
    }

    // Check if user can access the source post
    const isAuthor = sourcePost.author.toString() === req.user.userId;
    const isStaffOrAbove = ['Staff', 'Manager', 'Executive', 'Admin'].includes(req.user.role);

    if (!isAuthor && !isStaffOrAbove) {
      throw new ApiError('Not authorized to duplicate this post', StatusCodes.FORBIDDEN);
    }

    // Validate new title and slug if provided
    if (newTitle && newTitle.trim().length === 0) {
      throw new ApiError('New title cannot be empty', StatusCodes.BAD_REQUEST);
    }

    if (newSlug) {
      const existingPost = await Post.findOne({ slug: newSlug });
      if (existingPost) {
        throw new ApiError('A post with this slug already exists', StatusCodes.CONFLICT);
      }
    }

    req.sourcePost = sourcePost;
    next();
  });

module.exports = {
  validateBulkOperations,
  validateContentScheduling,
  logContentActivity,
  validateContentDuplication,
};