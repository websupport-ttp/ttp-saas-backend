// v1/routes/categoryRoutes.js
const express = require('express');
const {
  createCategory,
  getAllCategories,
  getCategoryTree,
  getCategoryById,
  getCategoryBySlug,
  updateCategory,
  deleteCategory,
  getCategoryPosts,
} = require('../controllers/categoryController');
const { authenticateUser, authorizeRoles } = require('../middleware/authMiddleware');
const { UserRoles } = require('../utils/constants');
const { validate } = require('../middleware/validationMiddleware');
const {
  validateCategoryHierarchy,
  validateSlugUniqueness,
} = require('../middleware/contentValidationMiddleware');
const {
  logContentActivity,
} = require('../middleware/contentWorkflowMiddleware');
const {
  createCategorySchema,
  updateCategorySchema,
  mongoIdParamSchema,
} = require('../utils/validationSchemas');

const router = express.Router();

/**
 * @openapi
 * /categories:
 *   get:
 *     summary: Get all categories
 *     tags: [Categories]
 *     parameters:
 *       - in: query
 *         name: includeInactive
 *         schema:
 *           type: boolean
 *           default: false
 *         description: Include inactive categories (requires authentication)
 *       - in: query
 *         name: parentOnly
 *         schema:
 *           type: boolean
 *           default: false
 *         description: Return only parent categories (no children)
 *     responses:
 *       200:
 *         description: Categories retrieved successfully
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
 *                     categories:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Category'
 *   post:
 *     summary: Create a new category
 *     tags: [Categories]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateCategoryRequest'
 *     responses:
 *       201:
 *         description: Category created successfully
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
 *                     category:
 *                       $ref: '#/components/schemas/Category'
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (insufficient role)
 */
router.route('/')
  .get(getAllCategories)
  .post(
    authenticateUser,
    authorizeRoles(UserRoles.STAFF, UserRoles.MANAGER, UserRoles.EXECUTIVE, UserRoles.ADMIN),
    validate(createCategorySchema),
    validateCategoryHierarchy(),
    validateSlugUniqueness('Category'),
    logContentActivity('create_category'),
    createCategory
  );

/**
 * @openapi
 * /categories/tree:
 *   get:
 *     summary: Get hierarchical category tree
 *     tags: [Categories]
 *     responses:
 *       200:
 *         description: Category tree retrieved successfully
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
 *                     categories:
 *                       type: array
 *                       items:
 *                         allOf:
 *                           - $ref: '#/components/schemas/Category'
 *                           - type: object
 *                             properties:
 *                               children:
 *                                 type: array
 *                                 items:
 *                                   $ref: '#/components/schemas/Category'
 */
router.get('/tree', getCategoryTree);

/**
 * @openapi
 * /categories/slug/{slug}:
 *   get:
 *     summary: Get a category by slug
 *     tags: [Categories]
 *     parameters:
 *       - in: path
 *         name: slug
 *         required: true
 *         schema:
 *           type: string
 *         description: Category slug
 *     responses:
 *       200:
 *         description: Category retrieved successfully
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
 *                     category:
 *                       allOf:
 *                         - $ref: '#/components/schemas/Category'
 *                         - type: object
 *                           properties:
 *                             children:
 *                               type: array
 *                               items:
 *                                 $ref: '#/components/schemas/Category'
 *                             postsCount:
 *                               type: integer
 *       404:
 *         description: Category not found
 */
router.get('/slug/:slug', getCategoryBySlug);

/**
 * @openapi
 * /categories/{id}:
 *   get:
 *     summary: Get a category by ID
 *     tags: [Categories]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Category ID
 *     responses:
 *       200:
 *         description: Category retrieved successfully
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
 *                     category:
 *                       allOf:
 *                         - $ref: '#/components/schemas/Category'
 *                         - type: object
 *                           properties:
 *                             children:
 *                               type: array
 *                               items:
 *                                 $ref: '#/components/schemas/Category'
 *                             postsCount:
 *                               type: integer
 *       404:
 *         description: Category not found
 *   put:
 *     summary: Update a category
 *     tags: [Categories]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Category ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateCategoryRequest'
 *     responses:
 *       200:
 *         description: Category updated successfully
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
 *                     category:
 *                       $ref: '#/components/schemas/Category'
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (insufficient role)
 *       404:
 *         description: Category not found
 *   delete:
 *     summary: Delete a category
 *     tags: [Categories]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Category ID
 *     responses:
 *       200:
 *         description: Category deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       400:
 *         description: Cannot delete category with children or posts
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (insufficient role)
 *       404:
 *         description: Category not found
 */
router.route('/:id')
  .get(validate(mongoIdParamSchema), getCategoryById)
  .put(
    authenticateUser,
    authorizeRoles(UserRoles.STAFF, UserRoles.MANAGER, UserRoles.EXECUTIVE, UserRoles.ADMIN),
    validate(updateCategorySchema),
    validateCategoryHierarchy(),
    validateSlugUniqueness('Category'),
    logContentActivity('update_category'),
    updateCategory
  )
  .delete(
    authenticateUser,
    authorizeRoles(UserRoles.MANAGER, UserRoles.EXECUTIVE, UserRoles.ADMIN),
    validate(mongoIdParamSchema),
    logContentActivity('delete_category'),
    deleteCategory
  );

/**
 * @openapi
 * /categories/{id}/posts:
 *   get:
 *     summary: Get posts in a specific category
 *     tags: [Categories]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Category ID
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
 *         name: includeChildren
 *         schema:
 *           type: boolean
 *           default: false
 *         description: Include posts from child categories
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [createdAt, publishedAt, title, viewCount]
 *           default: publishedAt
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
 *         description: Category posts retrieved successfully
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
 *                     category:
 *                       type: object
 *                       properties:
 *                         _id:
 *                           type: string
 *                         name:
 *                           type: string
 *                         slug:
 *                           type: string
 *                     posts:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Post'
 *                     pagination:
 *                       $ref: '#/components/schemas/Pagination'
 *       404:
 *         description: Category not found
 */
router.get('/:id/posts', validate(mongoIdParamSchema), getCategoryPosts);

module.exports = router;