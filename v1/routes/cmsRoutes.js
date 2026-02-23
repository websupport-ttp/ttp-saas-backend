const express = require('express');
const {
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
} = require('../controllers/cmsController');
const { authenticateUser, authorizeRoles } = require('../middleware/authMiddleware');

const router = express.Router();

// Hero Slides (Public GET, Admin CUD)
router.get('/hero-slides', getHeroSlides);
router.post('/hero-slides', authenticateUser, authorizeRoles('Admin', 'Manager'), createHeroSlide);
router.put('/hero-slides/:id', authenticateUser, authorizeRoles('Admin', 'Manager'), updateHeroSlide);
router.delete('/hero-slides/:id', authenticateUser, authorizeRoles('Admin'), deleteHeroSlide);

// Hot Deals (Public GET, Admin CUD)
router.get('/hot-deals', getHotDeals);
router.post('/hot-deals', authenticateUser, authorizeRoles('Admin', 'Manager'), createHotDeal);
router.put('/hot-deals/:id', authenticateUser, authorizeRoles('Admin', 'Manager'), updateHotDeal);
router.delete('/hot-deals/:id', authenticateUser, authorizeRoles('Admin'), deleteHotDeal);

// Articles (Public GET, Admin/Manager CUD)
router.get('/articles', getArticles);
router.get('/articles/:slug', getArticleBySlug);
router.post('/articles', authenticateUser, authorizeRoles('Admin', 'Manager'), createArticle);
router.put('/articles/:id', authenticateUser, authorizeRoles('Admin', 'Manager'), updateArticle);
router.delete('/articles/:id', authenticateUser, authorizeRoles('Admin'), deleteArticle);

// Google Reviews (Public GET)
router.get('/google-reviews', getGoogleReviews);

module.exports = router;
