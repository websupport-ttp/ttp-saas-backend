// v1/test/content.test.js
const request = require('supertest');
const app = require('../../app');
const mongoose = require('mongoose');
const User = require('../models/userModel');
const Post = require('../models/postModel');
const Category = require('../models/categoryModel');
const { StatusCodes } = require('http-status-codes');

// Mock external services
jest.mock('../utils/emailService', () => ({
  sendEmail: jest.fn(),
}));
jest.mock('../utils/smsService', () => ({
  sendSMS: jest.fn(),
}));

jest.mock('../utils/whatsappService', () => ({
  sendWhatsAppMessage: jest.fn(),
}));

describe('Content Management Endpoints', () => {
  let staffUser, managerUser, regularUser;
  let staffToken, managerToken, regularToken;
  let testCategory, testPost;

  beforeAll(async () => {
    // Use test database
    process.env.MONGO_URI = process.env.MONGO_TEST_URI || 'mongodb://localhost:27017/ttp_test_db';
    process.env.JWT_ACCESS_SECRET = 'test_access_secret';
    process.env.JWT_REFRESH_SECRET = 'test_refresh_secret';

    // Connect to MongoDB if not already connected
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGO_URI);
    }

    // Clear test data
    await User.deleteMany({});
    await Post.deleteMany({});
    await Category.deleteMany({});
  });

  beforeEach(async () => {
    // Create test users
    staffUser = await User.create({
      firstName: 'Staff',
      lastName: 'User',
      email: 'staff@test.com',
      phoneNumber: '+1234567890',
      password: 'Password123!',
      role: 'Staff',
      isEmailVerified: true,
      isPhoneVerified: true,
    });

    managerUser = await User.create({
      firstName: 'Manager',
      lastName: 'User',
      email: 'manager@test.com',
      phoneNumber: '+1234567891',
      password: 'Password123!',
      role: 'Manager',
      isEmailVerified: true,
      isPhoneVerified: true,
    });

    regularUser = await User.create({
      firstName: 'Regular',
      lastName: 'User',
      email: 'user@test.com',
      phoneNumber: '+1234567892',
      password: 'Password123!',
      role: 'User',
      isEmailVerified: true,
      isPhoneVerified: true,
    });

    // Create mock authentication headers for testing
    staffToken = { 'x-test-user': JSON.stringify({ userId: staffUser._id, role: 'Staff' }) };
    managerToken = { 'x-test-user': JSON.stringify({ userId: managerUser._id, role: 'Manager' }) };
    regularToken = { 'x-test-user': JSON.stringify({ userId: regularUser._id, role: 'User' }) };

    // Create test category
    testCategory = await Category.create({
      name: 'Test Category',
      slug: 'test-category',
      description: 'A test category',
    });
  });

  afterEach(async () => {
    // Clean up test data
    await User.deleteMany({});
    await Post.deleteMany({});
    await Category.deleteMany({});
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  describe('Category Endpoints', () => {
    describe('GET /api/v1/categories', () => {
      it('should get all categories for public access', async () => {
        const response = await request(app)
          .get('/api/v1/categories')
          .expect(StatusCodes.OK);

        expect(response.body.success).toBe(true);
        expect(response.body.data.categories).toHaveLength(1);
        expect(response.body.data.categories[0].name).toBe('Test Category');
      });
    });

    describe('POST /api/v1/categories', () => {
      it('should create a category with staff role', async () => {
        const categoryData = {
          name: 'New Category',
          description: 'A new test category',
        };

        const response = await request(app)
          .post('/api/v1/categories')
          .set(staffToken)
          .send(categoryData)
          .expect(StatusCodes.CREATED);

        expect(response.body.success).toBe(true);
        expect(response.body.data.category.name).toBe('New Category');
        expect(response.body.data.category.slug).toBe('new-category');
      });

      it('should reject category creation for regular user', async () => {
        const categoryData = {
          name: 'Unauthorized Category',
          description: 'Should not be created',
        };

        await request(app)
          .post('/api/v1/categories')
          .set(regularToken)
          .send(categoryData)
          .expect(StatusCodes.FORBIDDEN);
      });

      it('should reject category creation without authentication', async () => {
        const categoryData = {
          name: 'Unauthenticated Category',
          description: 'Should not be created',
        };

        await request(app)
          .post('/api/v1/categories')
          .send(categoryData)
          .expect(StatusCodes.UNAUTHORIZED);
      });
    });
  });

  describe('Post Endpoints', () => {
    describe('GET /api/v1/posts', () => {
      beforeEach(async () => {
        // Create test posts
        await Post.create({
          title: 'Published Article',
          slug: 'published-article',
          content: 'This is a published article',
          postType: 'Articles',
          author: staffUser._id,
          status: 'Published',
          categories: [testCategory._id],
        });

        await Post.create({
          title: 'Draft Article',
          slug: 'draft-article',
          content: 'This is a draft article',
          postType: 'Articles',
          author: staffUser._id,
          status: 'Draft',
          categories: [testCategory._id],
        });
      });

      it('should get only published posts for public access', async () => {
        const response = await request(app)
          .get('/api/v1/posts')
          .expect(StatusCodes.OK);

        expect(response.body.success).toBe(true);
        expect(response.body.data.posts).toHaveLength(1);
        expect(response.body.data.posts[0].title).toBe('Published Article');
      });

      it('should get all posts for staff user', async () => {
        const response = await request(app)
          .get('/api/v1/posts/my-posts')
          .set(staffToken)
          .expect(StatusCodes.OK);

        expect(response.body.success).toBe(true);
        expect(response.body.data.posts).toHaveLength(2);
      });
    });

    describe('POST /api/v1/posts', () => {
      it('should create an article with staff role', async () => {
        const postData = {
          title: 'New Article',
          slug: 'new-article',
          content: 'This is a new article content',
          postType: 'Articles',
          categories: [testCategory._id.toString()],
          tags: ['test', 'article'],
        };

        const response = await request(app)
          .post('/api/v1/posts')
          .set(staffToken)
          .send(postData);
        
        if (response.status !== StatusCodes.CREATED) {
          console.log('Post creation error:', response.body);
        }
        
        expect(response.status).toBe(StatusCodes.CREATED);

        expect(response.body.success).toBe(true);
        expect(response.body.data.post.title).toBe('New Article');
        expect(response.body.data.post.slug).toBe('new-article');
        expect(response.body.data.post.postType).toBe('Articles');
      });

      it('should create a package with required fields', async () => {
        const packageData = {
          title: 'New Package',
          slug: 'new-package',
          content: 'This is a new package content',
          postType: 'Packages',
          price: 1000,
          currency: 'NGN',
          categories: [testCategory._id.toString()],
          metadata: {
            duration: '7 days',
            location: 'Lagos, Nigeria',
            maxParticipants: 10,
            difficulty: 'Easy',
            inclusions: ['Accommodation', 'Meals'],
            exclusions: ['Flight'],
          },
          availability: {
            startDate: '2025-08-01',
            endDate: '2025-12-31',
            isAvailable: true,
          },
        };

        const response = await request(app)
          .post('/api/v1/posts')
          .set(staffToken)
          .send(packageData);
        
        if (response.status !== StatusCodes.CREATED) {
          console.log('Package creation error:', response.body);
        }
        
        expect(response.status).toBe(StatusCodes.CREATED);

        expect(response.body.success).toBe(true);
        expect(response.body.data.post.title).toBe('New Package');
        expect(response.body.data.post.postType).toBe('Packages');
        expect(response.body.data.post.price).toBe(1000);
      });

      it('should reject package creation without required fields', async () => {
        const invalidPackageData = {
          title: 'Invalid Package',
          content: 'This package is missing required fields',
          postType: 'Packages',
          // Missing price and metadata
        };

        await request(app)
          .post('/api/v1/posts')
          .set(staffToken)
          .send(invalidPackageData)
          .expect(StatusCodes.BAD_REQUEST);
      });

      it('should reject post creation for regular user', async () => {
        const postData = {
          title: 'Unauthorized Post',
          content: 'Should not be created',
          postType: 'Articles',
        };

        await request(app)
          .post('/api/v1/posts')
          .set(regularToken)
          .send(postData)
          .expect(StatusCodes.FORBIDDEN);
      });
    });
  });

  describe('Featured Posts', () => {
    beforeEach(async () => {
      await Post.create({
        title: 'Featured Article',
        slug: 'featured-article',
        content: 'This is a featured article',
        postType: 'Articles',
        author: staffUser._id,
        status: 'Published',
        isFeatured: true,
        categories: [testCategory._id],
      });
    });

    it('should get featured posts', async () => {
      const response = await request(app)
        .get('/api/v1/posts/featured')
        .expect(StatusCodes.OK);

      expect(response.body.success).toBe(true);
      expect(response.body.data.posts).toHaveLength(1);
      expect(response.body.data.posts[0].isFeatured).toBe(true);
    });
  });

  describe('Content Publishing Workflows', () => {
    let draftPost;

    beforeEach(async () => {
      draftPost = await Post.create({
        title: 'Draft Post for Publishing',
        slug: 'draft-post-for-publishing',
        content: 'This is a draft post that will be published',
        postType: 'Articles',
        author: staffUser._id,
        status: 'Draft',
        categories: [testCategory._id],
      });
    });

    it('should update post status from Draft to Published with manager role', async () => {
      const updateData = {
        status: 'Published',
        title: 'Draft Post for Publishing', // Include required fields
        content: 'This is a draft post that will be published',
        postType: 'Articles',
      };

      const response = await request(app)
        .put(`/api/v1/posts/${draftPost._id}`)
        .set(managerToken)
        .send(updateData)
        .expect(StatusCodes.OK);

      expect(response.body.success).toBe(true);
      expect(response.body.data.post.status).toBe('Published');
      expect(response.body.data.post.publishedAt).toBeDefined();
    });

    it('should update post status from Published to Archived', async () => {
      // First publish the post
      await Post.findByIdAndUpdate(draftPost._id, { 
        status: 'Published', 
        publishedAt: new Date() 
      });

      const updateData = {
        status: 'Archived',
      };

      const response = await request(app)
        .put(`/api/v1/posts/${draftPost._id}`)
        .set(staffToken)
        .send(updateData)
        .expect(StatusCodes.OK);

      expect(response.body.success).toBe(true);
      expect(response.body.data.post.status).toBe('Archived');
    });

    it('should allow manager to publish posts', async () => {
      const updateData = {
        status: 'Published',
      };

      const response = await request(app)
        .put(`/api/v1/posts/${draftPost._id}`)
        .set(managerToken)
        .send(updateData)
        .expect(StatusCodes.OK);

      expect(response.body.success).toBe(true);
      expect(response.body.data.post.status).toBe('Published');
    });

    it('should prevent regular users from publishing posts', async () => {
      const updateData = {
        status: 'Published',
      };

      await request(app)
        .put(`/api/v1/posts/${draftPost._id}`)
        .set(regularToken)
        .send(updateData)
        .expect(StatusCodes.FORBIDDEN);
    });
  });

  describe('Category Management', () => {
    describe('GET /api/v1/categories/:id', () => {
      it('should get a specific category by ID', async () => {
        const response = await request(app)
          .get(`/api/v1/categories/${testCategory._id}`)
          .expect(StatusCodes.OK);

        expect(response.body.success).toBe(true);
        expect(response.body.data.category.name).toBe('Test Category');
        expect(response.body.data.category.slug).toBe('test-category');
      });

      it('should return 404 for non-existent category', async () => {
        const nonExistentId = '507f1f77bcf86cd799439011';
        await request(app)
          .get(`/api/v1/categories/${nonExistentId}`)
          .expect(StatusCodes.NOT_FOUND);
      });
    });

    describe('PUT /api/v1/categories/:id', () => {
      it('should update a category with staff role', async () => {
        const updateData = {
          name: 'Updated Category Name',
          description: 'Updated description',
        };

        const response = await request(app)
          .put(`/api/v1/categories/${testCategory._id}`)
          .set(staffToken)
          .send(updateData)
          .expect(StatusCodes.OK);

        expect(response.body.success).toBe(true);
        expect(response.body.data.category.name).toBe('Updated Category Name');
        expect(response.body.data.category.description).toBe('Updated description');
      });

      it('should prevent regular users from updating categories', async () => {
        const updateData = {
          name: 'Unauthorized Update',
        };

        await request(app)
          .put(`/api/v1/categories/${testCategory._id}`)
          .set(regularToken)
          .send(updateData)
          .expect(StatusCodes.FORBIDDEN);
      });
    });

    describe('DELETE /api/v1/categories/:id', () => {
      it('should delete a category with manager role', async () => {
        const response = await request(app)
          .delete(`/api/v1/categories/${testCategory._id}`)
          .set(managerToken)
          .expect(StatusCodes.OK);

        expect(response.body.success).toBe(true);
        expect(response.body.message).toContain('deleted');
      });

      it('should prevent regular users from deleting categories', async () => {
        await request(app)
          .delete(`/api/v1/categories/${testCategory._id}`)
          .set(regularToken)
          .expect(StatusCodes.FORBIDDEN);
      });
    });

    describe('Hierarchical Categories', () => {
      let parentCategory, childCategory;

      beforeEach(async () => {
        parentCategory = await Category.create({
          name: 'Parent Category',
          slug: 'parent-category',
          description: 'A parent category',
        });

        childCategory = await Category.create({
          name: 'Child Category',
          slug: 'child-category',
          description: 'A child category',
          parentCategory: parentCategory._id,
        });
      });

      it('should create category with parent relationship', async () => {
        const categoryData = {
          name: 'Another Child Category',
          description: 'Another child category',
          parentCategory: parentCategory._id.toString(),
        };

        const response = await request(app)
          .post('/api/v1/categories')
          .set(staffToken)
          .send(categoryData)
          .expect(StatusCodes.CREATED);

        expect(response.body.success).toBe(true);
        // The parentCategory might be populated as an object or returned as a string ID
        const returnedParentCategory = response.body.data.category.parentCategory;
        if (typeof returnedParentCategory === 'object') {
          expect(returnedParentCategory._id).toBe(parentCategory._id.toString());
        } else {
          expect(returnedParentCategory).toBe(parentCategory._id.toString());
        }
      });

      it('should get category tree structure', async () => {
        const response = await request(app)
          .get('/api/v1/categories/tree')
          .expect(StatusCodes.OK);

        expect(response.body.success).toBe(true);
        expect(response.body.data.categories).toBeDefined();
        // Should have hierarchical structure
        const parentInTree = response.body.data.categories.find(cat => cat.name === 'Parent Category');
        expect(parentInTree).toBeDefined();
      });
    });
  });

  describe('Package-Specific Tests', () => {
    let packagePost;

    beforeEach(async () => {
      packagePost = await Post.create({
        title: 'Test Package',
        slug: 'test-package',
        content: 'This is a test package',
        postType: 'Packages',
        price: 2000,
        currency: 'NGN',
        author: staffUser._id,
        status: 'Published',
        categories: [testCategory._id],
        metadata: {
          duration: '5 days',
          location: 'Abuja, Nigeria',
          maxParticipants: 15,
          difficulty: 'Moderate',
          inclusions: ['Hotel', 'Transport'],
          exclusions: ['Meals'],
        },
        availability: {
          startDate: '2025-07-01', // Past date to ensure it's currently available
          endDate: '2025-12-31',   // Future date to ensure it's still available
          isAvailable: true,
        },
      });
    });

    it('should get available packages', async () => {
      const response = await request(app)
        .get('/api/v1/posts/packages/available')
        .expect(StatusCodes.OK);

      expect(response.body.success).toBe(true);
      expect(response.body.data.packages).toHaveLength(1);
      expect(response.body.data.packages[0].postType).toBe('Packages');
      expect(response.body.data.packages[0].price).toBe(2000);
    });

    it('should filter posts by package type', async () => {
      const response = await request(app)
        .get('/api/v1/posts?postType=Packages')
        .expect(StatusCodes.OK);

      expect(response.body.success).toBe(true);
      expect(response.body.data.posts).toHaveLength(1);
      expect(response.body.data.posts[0].postType).toBe('Packages');
    });

    it('should validate package pricing requirements', async () => {
      const invalidPackageData = {
        title: 'Invalid Package',
        slug: 'invalid-package',
        content: 'This package has invalid pricing',
        postType: 'Packages',
        price: -100, // Invalid negative price
        categories: [testCategory._id.toString()],
        metadata: {
          duration: '3 days',
          location: 'Lagos, Nigeria',
          maxParticipants: 8,
          difficulty: 'Easy',
        },
        availability: {
          startDate: '2025-10-01',
          endDate: '2025-10-31',
          isAvailable: true,
        },
      };

      await request(app)
        .post('/api/v1/posts')
        .set(staffToken)
        .send(invalidPackageData)
        .expect(StatusCodes.BAD_REQUEST);
    });
  });
});