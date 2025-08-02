// v1/controllers/postController.js
const { StatusCodes } = require('http-status-codes');
const Post = require('../models/postModel');
const Category = require('../models/categoryModel');
const { ApiError } = require('../utils/apiError');
const asyncHandler = require('../middleware/asyncHandler');
const logger = require('../utils/logger');

/**
 * @function createPost
 * @description Create a new post (Article or Package)
 * @route POST /api/v1/posts
 * @access Private (Staff+)
 */
const createPost = asyncHandler(async (req, res) => {
  const postData = {
    ...req.body,
    author: req.user.userId,
  };

  // Validate categories exist if provided
  if (postData.categories && postData.categories.length > 0) {
    const existingCategories = await Category.find({
      _id: { $in: postData.categories },
      isActive: true,
    });

    if (existingCategories.length !== postData.categories.length) {
      throw new ApiError('One or more categories do not exist or are inactive', StatusCodes.BAD_REQUEST);
    }
  }

  // Convert availability dates to Date objects if provided
  if (postData.availability) {
    if (postData.availability.startDate) {
      postData.availability.startDate = new Date(postData.availability.startDate);
    }
    if (postData.availability.endDate) {
      postData.availability.endDate = new Date(postData.availability.endDate);
    }
  }

  const post = new Post(postData);
  await post.save();

  // Populate the post with author and category details
  await post.populate([
    { path: 'author', select: 'firstName lastName email' },
    { path: 'categories', select: 'name slug' },
  ]);

  logger.info(`Post created: ${post._id} by user: ${req.user.userId}`);

  res.status(StatusCodes.CREATED).json({
    success: true,
    message: 'Post created successfully',
    data: { post },
  });
});

/**
 * @function getAllPosts
 * @description Get all posts with filtering, pagination, and search
 * @route GET /api/v1/posts
 * @access Public (for published posts) / Private (for all posts)
 */
const getAllPosts = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 10,
    postType,
    status,
    category,
    tag,
    author,
    featured,
    search,
    sortBy = 'createdAt',
    sortOrder = 'desc',
  } = req.query;

  // Build query based on user role and filters
  const query = {};

  // If user is not authenticated or doesn't have staff+ role, only show published posts
  if (!req.user || !['Staff', 'Manager', 'Executive', 'Admin'].includes(req.user.role)) {
    query.status = 'Published';
    query.isActive = true;
  } else if (status) {
    query.status = status;
  }

  // Apply filters
  if (postType) query.postType = postType;
  if (category) query.categories = category;
  if (tag) query.tags = { $in: [tag] };
  if (author) query.author = author;
  if (featured !== undefined) query.isFeatured = featured;

  // Search functionality
  if (search) {
    query.$or = [
      { title: { $regex: search, $options: 'i' } },
      { content: { $regex: search, $options: 'i' } },
      { excerpt: { $regex: search, $options: 'i' } },
      { tags: { $in: [new RegExp(search, 'i')] } },
    ];
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

  logger.info(`Posts retrieved: ${posts.length} posts, page ${page} of ${totalPages}`);

  res.status(StatusCodes.OK).json({
    success: true,
    message: 'Posts retrieved successfully',
    data: {
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

/**
 * @function getPostById
 * @description Get a single post by ID
 * @route GET /api/v1/posts/:id
 * @access Public (for published posts) / Private (for all posts)
 */
const getPostById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const query = { _id: id };

  // If user is not authenticated or doesn't have staff+ role, only show published posts
  if (!req.user || !['Staff', 'Manager', 'Executive', 'Admin'].includes(req.user.role)) {
    query.status = 'Published';
    query.isActive = true;
  }

  const post = await Post.findOne(query)
    .populate('author', 'firstName lastName email')
    .populate('categories', 'name slug description');

  if (!post) {
    throw new ApiError('Post not found', StatusCodes.NOT_FOUND);
  }

  // Increment view count for published posts
  if (post.status === 'Published') {
    await Post.findByIdAndUpdate(id, { $inc: { viewCount: 1 } });
  }

  logger.info(`Post retrieved: ${post._id}`);

  res.status(StatusCodes.OK).json({
    success: true,
    message: 'Post retrieved successfully',
    data: { post },
  });
});

/**
 * @function getPostBySlug
 * @description Get a single post by slug
 * @route GET /api/v1/posts/slug/:slug
 * @access Public (for published posts) / Private (for all posts)
 */
const getPostBySlug = asyncHandler(async (req, res) => {
  const { slug } = req.params;

  const query = { slug };

  // If user is not authenticated or doesn't have staff+ role, only show published posts
  if (!req.user || !['Staff', 'Manager', 'Executive', 'Admin'].includes(req.user.role)) {
    query.status = 'Published';
    query.isActive = true;
  }

  const post = await Post.findOne(query)
    .populate('author', 'firstName lastName email')
    .populate('categories', 'name slug description');

  if (!post) {
    throw new ApiError('Post not found', StatusCodes.NOT_FOUND);
  }

  // Increment view count for published posts
  if (post.status === 'Published') {
    await Post.findOneAndUpdate({ slug }, { $inc: { viewCount: 1 } });
  }

  logger.info(`Post retrieved by slug: ${post.slug}`);

  res.status(StatusCodes.OK).json({
    success: true,
    message: 'Post retrieved successfully',
    data: { post },
  });
});

/**
 * @function updatePost
 * @description Update a post
 * @route PUT /api/v1/posts/:id
 * @access Private (Staff+ or Author)
 */
const updatePost = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updateData = req.body;

  const post = await Post.findById(id);

  if (!post) {
    throw new ApiError('Post not found', StatusCodes.NOT_FOUND);
  }

  // Check if user can update this post (author or staff+)
  const canUpdate = 
    post.author.toString() === req.user.userId ||
    ['Staff', 'Manager', 'Executive', 'Admin'].includes(req.user.role);

  if (!canUpdate) {
    throw new ApiError('Not authorized to update this post', StatusCodes.FORBIDDEN);
  }

  // Validate categories exist if provided
  if (updateData.categories && updateData.categories.length > 0) {
    const existingCategories = await Category.find({
      _id: { $in: updateData.categories },
      isActive: true,
    });

    if (existingCategories.length !== updateData.categories.length) {
      throw new ApiError('One or more categories do not exist or are inactive', StatusCodes.BAD_REQUEST);
    }
  }

  // Convert availability dates to Date objects if provided
  if (updateData.availability) {
    if (updateData.availability.startDate) {
      updateData.availability.startDate = new Date(updateData.availability.startDate);
    }
    if (updateData.availability.endDate) {
      updateData.availability.endDate = new Date(updateData.availability.endDate);
    }
  }

  // Update the post
  Object.assign(post, updateData);
  await post.save();

  // Populate the updated post
  await post.populate([
    { path: 'author', select: 'firstName lastName email' },
    { path: 'categories', select: 'name slug' },
  ]);

  logger.info(`Post updated: ${post._id} by user: ${req.user.userId}`);

  res.status(StatusCodes.OK).json({
    success: true,
    message: 'Post updated successfully',
    data: { post },
  });
});

/**
 * @function deletePost
 * @description Delete a post (soft delete by setting isActive to false)
 * @route DELETE /api/v1/posts/:id
 * @access Private (Staff+ or Author)
 */
const deletePost = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const post = await Post.findById(id);

  if (!post) {
    throw new ApiError('Post not found', StatusCodes.NOT_FOUND);
  }

  // Check if user can delete this post (author or staff+)
  const canDelete = 
    post.author.toString() === req.user.userId ||
    ['Staff', 'Manager', 'Executive', 'Admin'].includes(req.user.role);

  if (!canDelete) {
    throw new ApiError('Not authorized to delete this post', StatusCodes.FORBIDDEN);
  }

  // Soft delete by setting isActive to false
  post.isActive = false;
  post.status = 'Archived';
  await post.save();

  logger.info(`Post deleted: ${post._id} by user: ${req.user.userId}`);

  res.status(StatusCodes.OK).json({
    success: true,
    message: 'Post deleted successfully',
  });
});

/**
 * @function getFeaturedPosts
 * @description Get featured posts
 * @route GET /api/v1/posts/featured
 * @access Public
 */
const getFeaturedPosts = asyncHandler(async (req, res) => {
  const { postType, limit = 5 } = req.query;

  const posts = await Post.getFeaturedPosts(postType, parseInt(limit));

  logger.info(`Featured posts retrieved: ${posts.length} posts`);

  res.status(StatusCodes.OK).json({
    success: true,
    message: 'Featured posts retrieved successfully',
    data: { posts },
  });
});

/**
 * @function getAvailablePackages
 * @description Get available packages
 * @route GET /api/v1/posts/packages/available
 * @access Public
 */
const getAvailablePackages = asyncHandler(async (req, res) => {
  const { limit = 10, page = 1 } = req.query;
  const skip = (page - 1) * limit;

  const packages = await Post.getAvailablePackages(parseInt(limit), skip);

  logger.info(`Available packages retrieved: ${packages.length} packages`);

  res.status(StatusCodes.OK).json({
    success: true,
    message: 'Available packages retrieved successfully',
    data: { packages },
  });
});

module.exports = {
  createPost,
  getAllPosts,
  getPostById,
  getPostBySlug,
  updatePost,
  deletePost,
  getFeaturedPosts,
  getAvailablePackages,
};