// v1/controllers/categoryController.js
const { StatusCodes } = require('http-status-codes');
const Category = require('../models/categoryModel');
const Post = require('../models/postModel');
const { ApiError } = require('../utils/apiError');
const asyncHandler = require('../middleware/asyncHandler');
const logger = require('../utils/logger');

/**
 * @function createCategory
 * @description Create a new category
 * @route POST /api/v1/categories
 * @access Private (Staff+)
 */
const createCategory = asyncHandler(async (req, res) => {
  const categoryData = req.body;

  // Check if parent category exists if provided
  if (categoryData.parentCategory) {
    const parentExists = await Category.findById(categoryData.parentCategory);
    if (!parentExists) {
      throw new ApiError('Parent category not found', StatusCodes.BAD_REQUEST);
    }
  }

  const category = new Category(categoryData);
  await category.save();

  // Populate parent category if exists
  if (category.parentCategory) {
    await category.populate('parentCategory', 'name slug');
  }

  logger.info(`Category created: ${category._id} by user: ${req.user.userId}`);

  res.status(StatusCodes.CREATED).json({
    success: true,
    message: 'Category created successfully',
    data: { category },
  });
});

/**
 * @function getAllCategories
 * @description Get all categories with optional filtering
 * @route GET /api/v1/categories
 * @access Public
 */
const getAllCategories = asyncHandler(async (req, res) => {
  const { includeInactive = 'false', parentOnly = 'false' } = req.query;

  const query = {};

  // Filter by active status
  if (includeInactive !== 'true') {
    query.isActive = true;
  }

  // Filter for parent categories only
  if (parentOnly === 'true') {
    query.parentCategory = null;
  }

  const categories = await Category.find(query)
    .populate('parentCategory', 'name slug')
    .sort({ sortOrder: 1, name: 1 })
    .lean();

  logger.info(`Categories retrieved: ${categories.length} categories`);

  res.status(StatusCodes.OK).json({
    success: true,
    message: 'Categories retrieved successfully',
    data: { categories },
  });
});

/**
 * @function getCategoryTree
 * @description Get hierarchical category tree
 * @route GET /api/v1/categories/tree
 * @access Public
 */
const getCategoryTree = asyncHandler(async (req, res) => {
  const categoryTree = await Category.getCategoryTree();

  logger.info(`Category tree retrieved with ${categoryTree.length} root categories`);

  res.status(StatusCodes.OK).json({
    success: true,
    message: 'Category tree retrieved successfully',
    data: { categories: categoryTree },
  });
});

/**
 * @function getCategoryById
 * @description Get a single category by ID
 * @route GET /api/v1/categories/:id
 * @access Public
 */
const getCategoryById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const category = await Category.findById(id)
    .populate('parentCategory', 'name slug description');

  if (!category) {
    throw new ApiError('Category not found', StatusCodes.NOT_FOUND);
  }

  // Get child categories
  const children = await Category.find({ parentCategory: id, isActive: true })
    .select('name slug description')
    .sort({ sortOrder: 1, name: 1 });

  // Get posts count in this category
  const postsCount = await Post.countDocuments({
    categories: id,
    status: 'Published',
    isActive: true,
  });

  const categoryWithDetails = {
    ...category.toObject(),
    children,
    postsCount,
  };

  logger.info(`Category retrieved: ${category._id}`);

  res.status(StatusCodes.OK).json({
    success: true,
    message: 'Category retrieved successfully',
    data: { category: categoryWithDetails },
  });
});

/**
 * @function getCategoryBySlug
 * @description Get a single category by slug
 * @route GET /api/v1/categories/slug/:slug
 * @access Public
 */
const getCategoryBySlug = asyncHandler(async (req, res) => {
  const { slug } = req.params;

  const category = await Category.findOne({ slug })
    .populate('parentCategory', 'name slug description');

  if (!category) {
    throw new ApiError('Category not found', StatusCodes.NOT_FOUND);
  }

  // Get child categories
  const children = await Category.find({ parentCategory: category._id, isActive: true })
    .select('name slug description')
    .sort({ sortOrder: 1, name: 1 });

  // Get posts count in this category
  const postsCount = await Post.countDocuments({
    categories: category._id,
    status: 'Published',
    isActive: true,
  });

  const categoryWithDetails = {
    ...category.toObject(),
    children,
    postsCount,
  };

  logger.info(`Category retrieved by slug: ${category.slug}`);

  res.status(StatusCodes.OK).json({
    success: true,
    message: 'Category retrieved successfully',
    data: { category: categoryWithDetails },
  });
});

/**
 * @function updateCategory
 * @description Update a category
 * @route PUT /api/v1/categories/:id
 * @access Private (Staff+)
 */
const updateCategory = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updateData = req.body;

  const category = await Category.findById(id);

  if (!category) {
    throw new ApiError('Category not found', StatusCodes.NOT_FOUND);
  }

  // Check if parent category exists if provided
  if (updateData.parentCategory && updateData.parentCategory !== category.parentCategory?.toString()) {
    const parentExists = await Category.findById(updateData.parentCategory);
    if (!parentExists) {
      throw new ApiError('Parent category not found', StatusCodes.BAD_REQUEST);
    }

    // Prevent setting self as parent
    if (updateData.parentCategory === id) {
      throw new ApiError('Category cannot be its own parent', StatusCodes.BAD_REQUEST);
    }
  }

  // Update the category
  Object.assign(category, updateData);
  await category.save();

  // Populate parent category if exists
  if (category.parentCategory) {
    await category.populate('parentCategory', 'name slug');
  }

  logger.info(`Category updated: ${category._id} by user: ${req.user.userId}`);

  res.status(StatusCodes.OK).json({
    success: true,
    message: 'Category updated successfully',
    data: { category },
  });
});

/**
 * @function deleteCategory
 * @description Delete a category (soft delete by setting isActive to false)
 * @route DELETE /api/v1/categories/:id
 * @access Private (Manager+)
 */
const deleteCategory = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const category = await Category.findById(id);

  if (!category) {
    throw new ApiError('Category not found', StatusCodes.NOT_FOUND);
  }

  // Check if category has child categories
  const childCategories = await Category.find({ parentCategory: id, isActive: true });
  if (childCategories.length > 0) {
    throw new ApiError('Cannot delete category with active child categories', StatusCodes.BAD_REQUEST);
  }

  // Check if category has posts
  const postsCount = await Post.countDocuments({
    categories: id,
    status: { $in: ['Published', 'Draft'] },
    isActive: true,
  });

  if (postsCount > 0) {
    throw new ApiError('Cannot delete category with associated posts', StatusCodes.BAD_REQUEST);
  }

  // Soft delete by setting isActive to false
  category.isActive = false;
  await category.save();

  logger.info(`Category deleted: ${category._id} by user: ${req.user.userId}`);

  res.status(StatusCodes.OK).json({
    success: true,
    message: 'Category deleted successfully',
  });
});

/**
 * @function getCategoryPosts
 * @description Get posts in a specific category
 * @route GET /api/v1/categories/:id/posts
 * @access Public
 */
const getCategoryPosts = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { 
    page = 1, 
    limit = 10, 
    postType, 
    includeChildren = 'false',
    sortBy = 'publishedAt',
    sortOrder = 'desc'
  } = req.query;

  // Verify category exists
  const category = await Category.findById(id);
  if (!category) {
    throw new ApiError('Category not found', StatusCodes.NOT_FOUND);
  }

  // Build category filter
  let categoryFilter = [id];

  // Include child categories if requested
  if (includeChildren === 'true') {
    const descendants = await Category.getDescendants(id);
    categoryFilter = categoryFilter.concat(descendants.map(cat => cat._id));
  }

  // Build query
  const query = {
    categories: { $in: categoryFilter },
    status: 'Published',
    isActive: true,
  };

  if (postType) {
    query.postType = postType;
  }

  // Build sort object
  const sort = {};
  sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

  // Calculate pagination
  const skip = (page - 1) * limit;

  // Execute query
  const [posts, totalPosts] = await Promise.all([
    Post.find(query)
      .populate('author', 'firstName lastName email')
      .populate('categories', 'name slug')
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit))
      .lean(),
    Post.countDocuments(query),
  ]);

  const totalPages = Math.ceil(totalPosts / limit);

  logger.info(`Category posts retrieved: ${posts.length} posts for category ${id}`);

  res.status(StatusCodes.OK).json({
    success: true,
    message: 'Category posts retrieved successfully',
    data: {
      category: {
        _id: category._id,
        name: category.name,
        slug: category.slug,
      },
      posts,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalPosts,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    },
  });
});

module.exports = {
  createCategory,
  getAllCategories,
  getCategoryTree,
  getCategoryById,
  getCategoryBySlug,
  updateCategory,
  deleteCategory,
  getCategoryPosts,
};