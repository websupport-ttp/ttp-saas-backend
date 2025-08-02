// v1/middleware/contentValidationMiddleware.js
const asyncHandler = require('./asyncHandler');
const { ApiError } = require('../utils/apiError');
const { StatusCodes } = require('http-status-codes');
const Post = require('../models/postModel');
const Category = require('../models/categoryModel');

/**
 * @function validatePostOwnership
 * @description Middleware to validate that user can access/modify a post
 * @param {string} action - The action being performed ('read', 'write', 'delete')
 * @returns {Function} An Express middleware function
 */
const validatePostOwnership = (action = 'read') =>
  asyncHandler(async (req, res, next) => {
    const { id } = req.params;

    const post = await Post.findById(id);
    if (!post) {
      throw new ApiError('Post not found', StatusCodes.NOT_FOUND);
    }

    // For read operations on published posts, allow public access
    if (action === 'read' && post.status === 'Published' && post.isActive) {
      req.post = post;
      return next();
    }

    // For all other operations, require authentication
    if (!req.user) {
      throw new ApiError('Authentication required', StatusCodes.UNAUTHORIZED);
    }

    // Check permissions based on action and user role
    const isAuthor = post.author.toString() === req.user.userId;
    const isStaffOrAbove = ['Staff', 'Manager', 'Executive', 'Admin'].includes(req.user.role);

    switch (action) {
      case 'read':
        // Authors can read their own posts, staff+ can read all posts
        if (!isAuthor && !isStaffOrAbove) {
          throw new ApiError('Not authorized to access this post', StatusCodes.FORBIDDEN);
        }
        break;

      case 'write':
        // Authors can edit their own posts, staff+ can edit all posts
        if (!isAuthor && !isStaffOrAbove) {
          throw new ApiError('Not authorized to modify this post', StatusCodes.FORBIDDEN);
        }
        break;

      case 'delete':
        // Authors can delete their own posts, staff+ can delete all posts
        if (!isAuthor && !isStaffOrAbove) {
          throw new ApiError('Not authorized to delete this post', StatusCodes.FORBIDDEN);
        }
        break;

      default:
        throw new ApiError('Invalid action specified', StatusCodes.INTERNAL_SERVER_ERROR);
    }

    req.post = post;
    next();
  });

/**
 * @function validateCategoryHierarchy
 * @description Middleware to validate category hierarchy and prevent circular references
 * @returns {Function} An Express middleware function
 */
const validateCategoryHierarchy = () =>
  asyncHandler(async (req, res, next) => {
    const { parentCategory } = req.body;
    const { id } = req.params;

    if (!parentCategory) {
      return next();
    }

    // Check if parent category exists
    const parent = await Category.findById(parentCategory);
    if (!parent) {
      throw new ApiError('Parent category not found', StatusCodes.BAD_REQUEST);
    }

    // Prevent self-reference
    if (id && parentCategory === id) {
      throw new ApiError('Category cannot be its own parent', StatusCodes.BAD_REQUEST);
    }

    // Check for circular reference by traversing up the parent chain
    if (id) {
      let currentParent = parentCategory;
      const visitedIds = new Set([id]);

      while (currentParent) {
        if (visitedIds.has(currentParent)) {
          throw new ApiError('Circular reference detected in category hierarchy', StatusCodes.BAD_REQUEST);
        }

        visitedIds.add(currentParent);

        const parentCategory = await Category.findById(currentParent);
        if (!parentCategory) break;

        currentParent = parentCategory.parentCategory?.toString();
      }
    }

    next();
  });

/**
 * @function validatePostType
 * @description Middleware to validate post type specific requirements
 * @returns {Function} An Express middleware function
 */
const validatePostType = () =>
  asyncHandler(async (req, res, next) => {
    const { postType, price, metadata, availability } = req.body;

    if (postType === 'Packages') {
      // Validate required fields for packages
      if (price === undefined || price === null) {
        throw new ApiError('Price is required for Packages', StatusCodes.BAD_REQUEST);
      }

      if (price < 0) {
        throw new ApiError('Price cannot be negative', StatusCodes.BAD_REQUEST);
      }

      // Validate package-specific metadata
      if (metadata) {
        const requiredFields = ['duration', 'location', 'maxParticipants', 'difficulty'];
        const missingFields = requiredFields.filter(field => !metadata[field]);

        if (missingFields.length > 0) {
          throw new ApiError(
            `Missing required package metadata: ${missingFields.join(', ')}`,
            StatusCodes.BAD_REQUEST
          );
        }

        if (metadata.maxParticipants && metadata.maxParticipants < 1) {
          throw new ApiError('Max participants must be at least 1', StatusCodes.BAD_REQUEST);
        }
      }

      // Validate availability dates for packages
      if (availability && availability.startDate && availability.endDate) {
        const startDate = new Date(availability.startDate);
        const endDate = new Date(availability.endDate);

        if (startDate >= endDate) {
          throw new ApiError('End date must be after start date', StatusCodes.BAD_REQUEST);
        }

        if (startDate < new Date()) {
          throw new ApiError('Start date cannot be in the past', StatusCodes.BAD_REQUEST);
        }
      }
    }

    next();
  });

/**
 * @function validateCategoryReferences
 * @description Middleware to validate that referenced categories exist and are active
 * @returns {Function} An Express middleware function
 */
const validateCategoryReferences = () =>
  asyncHandler(async (req, res, next) => {
    const { categories } = req.body;

    if (!categories || !Array.isArray(categories) || categories.length === 0) {
      return next();
    }

    // Check if all referenced categories exist and are active
    const existingCategories = await Category.find({
      _id: { $in: categories },
      isActive: true,
    });

    if (existingCategories.length !== categories.length) {
      const existingIds = existingCategories.map(cat => cat._id.toString());
      const missingIds = categories.filter(id => !existingIds.includes(id));

      throw new ApiError(
        `One or more categories do not exist or are inactive: ${missingIds.join(', ')}`,
        StatusCodes.BAD_REQUEST
      );
    }

    next();
  });

/**
 * @function validateSlugUniqueness
 * @description Middleware to validate slug uniqueness for posts and categories
 * @param {string} model - The model to check ('Post' or 'Category')
 * @returns {Function} An Express middleware function
 */
const validateSlugUniqueness = (model) =>
  asyncHandler(async (req, res, next) => {
    const { slug } = req.body;
    const { id } = req.params;

    if (!slug) {
      return next();
    }

    const Model = model === 'Post' ? Post : Category;
    const query = { slug };

    // Exclude current document if updating
    if (id) {
      query._id = { $ne: id };
    }

    const existingDocument = await Model.findOne(query);

    if (existingDocument) {
      throw new ApiError(`${model} with this slug already exists`, StatusCodes.CONFLICT);
    }

    next();
  });

/**
 * @function validatePublishingRights
 * @description Middleware to validate user rights to publish content
 * @returns {Function} An Express middleware function
 */
const validatePublishingRights = () =>
  asyncHandler(async (req, res, next) => {
    const { status } = req.body;

    // If not trying to publish, allow
    if (status !== 'Published') {
      return next();
    }

    // Check if user has publishing rights
    const canPublish = ['Manager', 'Executive', 'Admin'].includes(req.user.role);

    if (!canPublish) {
      throw new ApiError('Insufficient permissions to publish content', StatusCodes.FORBIDDEN);
    }

    next();
  });

module.exports = {
  validatePostOwnership,
  validateCategoryHierarchy,
  validatePostType,
  validateCategoryReferences,
  validateSlugUniqueness,
  validatePublishingRights,
};