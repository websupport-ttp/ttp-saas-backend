const asyncHandler = require('../middleware/asyncHandler');
const HeroSlide = require('../models/heroSlideModel');
const HotDeal = require('../models/hotDealModel');
const Article = require('../models/articleModel');
const GoogleReview = require('../models/googleReviewModel');
const { StatusCodes } = require('http-status-codes');
const ApiResponse = require('../utils/apiResponse');
const { ApiError } = require('../utils/apiError');

// Hero Slides
const getHeroSlides = asyncHandler(async (req, res) => {
  const { active } = req.query;
  const query = active === 'true' ? { isActive: true } : {};
  
  const slides = await HeroSlide.find(query).sort({ order: 1 });
  
  ApiResponse.success(res, StatusCodes.OK, 'Hero slides retrieved successfully', slides);
});

const createHeroSlide = asyncHandler(async (req, res) => {
  const slide = await HeroSlide.create(req.body);
  
  ApiResponse.success(res, StatusCodes.CREATED, 'Hero slide created successfully', slide);
});

const updateHeroSlide = asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  const slide = await HeroSlide.findByIdAndUpdate(id, req.body, { new: true });
  
  if (!slide) {
    throw new ApiError('Hero slide not found', StatusCodes.NOT_FOUND);
  }
  
  ApiResponse.success(res, StatusCodes.OK, 'Hero slide updated successfully', slide);
});

const deleteHeroSlide = asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  const slide = await HeroSlide.findByIdAndDelete(id);
  
  if (!slide) {
    throw new ApiError('Hero slide not found', StatusCodes.NOT_FOUND);
  }
  
  ApiResponse.success(res, StatusCodes.OK, 'Hero slide deleted successfully');
});

// Hot Deals
const getHotDeals = asyncHandler(async (req, res) => {
  const { active, category } = req.query;
  const query = {};
  
  if (active === 'true') {
    query.isActive = true;
    query.validUntil = { $gte: new Date() };
  }
  
  if (category) {
    query.category = category;
  }
  
  const deals = await HotDeal.find(query).sort({ featured: -1, createdAt: -1 });
  
  ApiResponse.success(res, StatusCodes.OK, 'Hot deals retrieved successfully', deals);
});

const createHotDeal = asyncHandler(async (req, res) => {
  const deal = await HotDeal.create(req.body);
  
  ApiResponse.success(res, StatusCodes.CREATED, 'Hot deal created successfully', deal);
});

const updateHotDeal = asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  const deal = await HotDeal.findByIdAndUpdate(id, req.body, { new: true });
  
  if (!deal) {
    throw new ApiError('Hot deal not found', StatusCodes.NOT_FOUND);
  }
  
  ApiResponse.success(res, StatusCodes.OK, 'Hot deal updated successfully', deal);
});

const deleteHotDeal = asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  const deal = await HotDeal.findByIdAndDelete(id);
  
  if (!deal) {
    throw new ApiError('Hot deal not found', StatusCodes.NOT_FOUND);
  }
  
  ApiResponse.success(res, StatusCodes.OK, 'Hot deal deleted successfully');
});

// Articles
const getArticles = asyncHandler(async (req, res) => {
  const { published, category, featured } = req.query;
  const query = {};
  
  if (published === 'true') {
    query.isPublished = true;
  }
  
  if (category) {
    query.category = category;
  }
  
  if (featured === 'true') {
    query.featured = true;
  }
  
  const articles = await Article.find(query)
    .populate('author', 'firstName lastName')
    .sort({ publishedAt: -1 });
  
  ApiResponse.success(res, StatusCodes.OK, 'Articles retrieved successfully', articles);
});

const getArticleBySlug = asyncHandler(async (req, res) => {
  const { slug } = req.params;
  
  const article = await Article.findOne({ slug, isPublished: true })
    .populate('author', 'firstName lastName');
  
  if (!article) {
    throw new ApiError('Article not found', StatusCodes.NOT_FOUND);
  }
  
  // Increment view count
  article.viewCount += 1;
  await article.save();
  
  ApiResponse.success(res, StatusCodes.OK, 'Article retrieved successfully', article);
});

const createArticle = asyncHandler(async (req, res) => {
  const article = await Article.create({
    ...req.body,
    author: req.user._id,
  });
  
  ApiResponse.success(res, StatusCodes.CREATED, 'Article created successfully', article);
});

const updateArticle = asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  const article = await Article.findByIdAndUpdate(id, req.body, { new: true });
  
  if (!article) {
    throw new ApiError('Article not found', StatusCodes.NOT_FOUND);
  }
  
  ApiResponse.success(res, StatusCodes.OK, 'Article updated successfully', article);
});

const deleteArticle = asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  const article = await Article.findByIdAndDelete(id);
  
  if (!article) {
    throw new ApiError('Article not found', StatusCodes.NOT_FOUND);
  }
  
  ApiResponse.success(res, StatusCodes.OK, 'Article deleted successfully');
});

// Google Reviews
const getGoogleReviews = asyncHandler(async (req, res) => {
  const reviews = await GoogleReview.find({ isVisible: true })
    .sort({ time: -1 })
    .limit(10);
  
  ApiResponse.success(res, StatusCodes.OK, 'Google reviews retrieved successfully', reviews);
});

module.exports = {
  getHeroSlides,
  createHeroSlide,
  updateHeroSlide,
  deleteHeroSlide,
  getHotDeals,
  createHotDeal,
  updateHotDeal,
  deleteHotDeal,
  getArticles,
  getArticleBySlug,
  createArticle,
  updateArticle,
  deleteArticle,
  getGoogleReviews,
};
