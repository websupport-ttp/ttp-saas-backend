// v1/routes/postRoutes.js
const express = require('express');
const {
  createPost,
  getAllPosts,
  getPostById,
  getPostBySlug,
  updatePost,
  deletePost,
  getFeaturedPosts,
  getAvailablePackages,
} = require('../controllers/postController');
const { authenticateUser, authorizeRoles } = require('../middleware/authMiddleware');
const { UserRoles } = require('../utils/constants');
const { validate } = require('../middleware/validationMiddleware');
const {
  validatePostType,
  validateCategoryReferences,
  validateSlugUniqueness,
  validatePublishingRights,
  validatePostOwnership,
} = require('../middleware/contentValidationMiddleware');
const {
  logContentActivity,
} = require('../middleware/contentWorkflowMiddleware');
const {
  createPostSchema,
  updatePostSchema,
  getPostsQuerySchema,
  mongoIdParamSchema,
  bulkPostOperationSchema,
  contentSchedulingSchema,
  duplicatePostSchema,
} = require('../utils/validationSchemas');

const router = express.Router();

/**
 * @openapi
 * /posts:
 *   get:
 *     summary: Get all posts with filtering and pagination
 *     tags: [Posts]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number for pagination
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 10
 *         description: Number of posts per page
 *       - in: query
 *         name: postType
 *         schema:
 *           type: string
 *           enum: [Articles, Packages]
 *         description: Filter by post type
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [Draft, Published, Archived]
 *         description: Filter by post status (requires authentication)
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *         description: Filter by category ID
 *       - in: query
 *         name: tag
 *         schema:
 *           type: string
 *         description: Filter by tag
 *       - in: query
 *         name: author
 *         schema:
 *           type: string
 *         description: Filter by author ID
 *       - in: query
 *         name: featured
 *         schema:
 *           type: boolean
 *         description: Filter by featured status
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search in title, content, excerpt, and tags
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [createdAt, publishedAt, title, viewCount]
 *           default: createdAt
 *         description: Sort field
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *         description: Sort order
 *     responses:
 *       200:
 *         description: Posts retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     posts:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Post'
 *                     pagination:
 *                       $ref: '#/components/schemas/Pagination'
 *   post:
 *     summary: Create a new post
 *     tags: [Posts]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreatePostRequest'
 *     responses:
 *       201:
 *         description: Post created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     post:
 *                       $ref: '#/components/schemas/Post'
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (insufficient role)
 */
router.route('/')
  .get(validate(getPostsQuerySchema), getAllPosts)
  .post(
    authenticateUser,
    authorizeRoles(UserRoles.STAFF, UserRoles.MANAGER, UserRoles.EXECUTIVE, UserRoles.ADMIN),
    validate(createPostSchema),
    validatePostType(),
    validateCategoryReferences(),
    validateSlugUniqueness('Post'),
    validatePublishingRights(),
    logContentActivity('create_post'),
    createPost
  );

/**
 * @openapi
 * /posts/featured:
 *   get:
 *     summary: Get featured posts
 *     tags: [Posts]
 *     parameters:
 *       - in: query
 *         name: postType
 *         schema:
 *           type: string
 *           enum: [Articles, Packages]
 *         description: Filter by post type
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 20
 *           default: 5
 *         description: Number of featured posts to return
 *     responses:
 *       200:
 *         description: Featured posts retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     posts:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Post'
 */
router.get('/featured', getFeaturedPosts);

/**
 * @openapi
 * /posts/my-posts:
 *   get:
 *     summary: Get current user's posts
 *     tags: [Posts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number for pagination
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 50
 *           default: 10
 *         description: Number of posts per page
 *       - in: query
 *         name: postType
 *         schema:
 *           type: string
 *           enum: [Articles, Packages]
 *         description: Filter by post type
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [Draft, Published, Archived]
 *         description: Filter by post status
 *     responses:
 *       200:
 *         description: User posts retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     posts:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Post'
 *                     pagination:
 *                       $ref: '#/components/schemas/Pagination'
 */
router.get('/my-posts', authenticateUser, getAllPosts);

/**
 * @openapi
 * /posts/packages/available:
 *   get:
 *     summary: Get available packages
 *     tags: [Posts]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number for pagination
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 50
 *           default: 10
 *         description: Number of packages per page
 *     responses:
 *       200:
 *         description: Available packages retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     packages:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Post'
 */
router.get('/packages/available', getAvailablePackages);



/**
 * @openapi
 * /posts/slug/{slug}:
 *   get:
 *     summary: Get a post by slug
 *     tags: [Posts]
 *     parameters:
 *       - in: path
 *         name: slug
 *         required: true
 *         schema:
 *           type: string
 *         description: Post slug
 *     responses:
 *       200:
 *         description: Post retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     post:
 *                       $ref: '#/components/schemas/Post'
 *       404:
 *         description: Post not found
 */
router.get('/slug/:slug', getPostBySlug);

/**
 * @openapi
 * /posts/{id}:
 *   get:
 *     summary: Get a post by ID
 *     tags: [Posts]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Post ID
 *     responses:
 *       200:
 *         description: Post retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     post:
 *                       $ref: '#/components/schemas/Post'
 *       404:
 *         description: Post not found
 *   put:
 *     summary: Update a post
 *     tags: [Posts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Post ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdatePostRequest'
 *     responses:
 *       200:
 *         description: Post updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     post:
 *                       $ref: '#/components/schemas/Post'
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (not author or insufficient role)
 *       404:
 *         description: Post not found
 *   delete:
 *     summary: Delete a post
 *     tags: [Posts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Post ID
 *     responses:
 *       200:
 *         description: Post deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (not author or insufficient role)
 *       404:
 *         description: Post not found
 */
router.route('/:id')
  .get(validate(mongoIdParamSchema), validatePostOwnership('read'), getPostById)
  .put(
    authenticateUser,
    validate(updatePostSchema),
    validatePostOwnership('write'),
    validatePostType(),
    validateCategoryReferences(),
    validateSlugUniqueness('Post'),
    validatePublishingRights(),
    logContentActivity('update_post'),
    updatePost
  )
  .delete(
    authenticateUser,
    validate(mongoIdParamSchema),
    validatePostOwnership('delete'),
    logContentActivity('delete_post'),
    deletePost
  );

module.exports = router;