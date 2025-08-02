// v1/test/models/postModel.test.js
const mongoose = require('mongoose');
const Post = require('../../models/postModel');
const Category = require('../../models/categoryModel');
const User = require('../../models/userModel');

describe('Post Model', () => {
  let testUser;
  let testCategory;

  beforeAll(async () => {
    // Ensure test environment is set up
    process.env.NODE_ENV = 'test';
    process.env.JWT_ACCESS_SECRET = 'test_access_secret';
    process.env.JWT_REFRESH_SECRET = 'test_refresh_secret';
  });

  beforeEach(async () => {
    // Create test user
    testUser = new User({
      firstName: 'Test',
      lastName: 'Author',
      email: 'author@test.com',
      password: 'password123',
    });
    await testUser.save();

    // Create test category
    testCategory = new Category({
      name: 'Travel Tips',
    });
    await testCategory.save();
  });

  describe('Article Creation', () => {
    it('should create a valid article', async () => {
      const articleData = {
        title: 'Top 10 Travel Tips',
        content: 'Here are some amazing travel tips...',
        postType: 'Articles',
        author: testUser._id,
        categories: [testCategory._id],
        tags: ['travel', 'tips'],
      };

      const article = new Post(articleData);
      const savedArticle = await article.save();

      expect(savedArticle.title).toBe(articleData.title);
      expect(savedArticle.postType).toBe('Articles');
      expect(savedArticle.slug).toBe('top-10-travel-tips');
      expect(savedArticle.status).toBe('Draft');
      expect(savedArticle.isActive).toBe(true);
      expect(savedArticle.metadata.readingTime).toBeGreaterThan(0);
      expect(savedArticle.metadata.wordCount).toBeGreaterThan(0);
    });

    it('should not require price for articles', async () => {
      const article = new Post({
        title: 'Travel Guide',
        content: 'Content here...',
        postType: 'Articles',
        author: testUser._id,
      });

      const savedArticle = await article.save();
      expect(savedArticle.price).toBeUndefined();
    });

    it('should calculate reading time automatically', async () => {
      const longContent = 'word '.repeat(400); // 400 words
      const article = new Post({
        title: 'Long Article',
        content: longContent,
        postType: 'Articles',
        author: testUser._id,
      });

      const savedArticle = await article.save();
      expect(savedArticle.metadata.readingTime).toBe(2); // 400 words / 200 wpm = 2 minutes
      expect(savedArticle.metadata.wordCount).toBe(400);
    });
  });

  describe('Package Creation', () => {
    it('should create a valid package', async () => {
      const packageData = {
        title: 'Bali Adventure Package',
        content: 'Amazing 7-day adventure in Bali...',
        postType: 'Packages',
        price: 150000,
        currency: 'NGN',
        author: testUser._id,
        categories: [testCategory._id],
        metadata: {
          duration: '7 days',
          location: 'Bali, Indonesia',
          maxParticipants: 12,
          difficulty: 'Moderate',
          inclusions: ['Accommodation', 'Meals', 'Transportation'],
          exclusions: ['Flight tickets', 'Personal expenses'],
        },
        availability: {
          startDate: new Date('2024-06-01'),
          endDate: new Date('2024-12-31'),
          isAvailable: true,
        },
      };

      const packagePost = new Post(packageData);
      const savedPackage = await packagePost.save();

      expect(savedPackage.title).toBe(packageData.title);
      expect(savedPackage.postType).toBe('Packages');
      expect(savedPackage.price).toBe(150000);
      expect(savedPackage.currency).toBe('NGN');
      expect(savedPackage.metadata.duration).toBe('7 days');
      expect(savedPackage.metadata.location).toBe('Bali, Indonesia');
      expect(savedPackage.metadata.maxParticipants).toBe(12);
      expect(savedPackage.metadata.difficulty).toBe('Moderate');
    });

    it('should require price for packages', async () => {
      const packagePost = new Post({
        title: 'Test Package',
        content: 'Content...',
        postType: 'Packages',
        author: testUser._id,
        metadata: {
          duration: '5 days',
          location: 'Test Location',
          maxParticipants: 10,
          difficulty: 'Easy',
        },
        availability: {
          startDate: new Date('2024-06-01'),
          endDate: new Date('2024-12-31'),
        },
      });

      await expect(packagePost.save()).rejects.toThrow('Price is required for Packages');
    });

    it('should require package-specific metadata', async () => {
      const packagePost = new Post({
        title: 'Incomplete Package',
        content: 'Content...',
        postType: 'Packages',
        price: 100000,
        author: testUser._id,
      });

      await expect(packagePost.save()).rejects.toThrow();
    });

    it('should validate availability dates', async () => {
      const packagePost = new Post({
        title: 'Test Package',
        content: 'Content...',
        postType: 'Packages',
        price: 100000,
        author: testUser._id,
        metadata: {
          duration: '5 days',
          location: 'Test Location',
          maxParticipants: 10,
          difficulty: 'Easy',
        },
        availability: {
          startDate: new Date('2024-12-31'),
          endDate: new Date('2024-06-01'), // End before start
        },
      });

      await expect(packagePost.save()).rejects.toThrow('End date must be after start date');
    });

    it('should check package availability correctly', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 30);
      
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 30);

      const packagePost = new Post({
        title: 'Available Package',
        content: 'Content...',
        postType: 'Packages',
        price: 100000,
        author: testUser._id,
        status: 'Published',
        metadata: {
          duration: '5 days',
          location: 'Test Location',
          maxParticipants: 10,
          difficulty: 'Easy',
        },
        availability: {
          startDate: pastDate,
          endDate: futureDate,
          isAvailable: true,
        },
      });

      const savedPackage = await packagePost.save();
      expect(savedPackage.isPackageAvailable()).toBe(true);
    });
  });

  describe('Common Post Features', () => {
    it('should generate slug automatically', async () => {
      const post = new Post({
        title: 'Amazing Travel Experience & Adventure!',
        content: 'Content...',
        postType: 'Articles',
        author: testUser._id,
      });

      const savedPost = await post.save();
      expect(savedPost.slug).toBe('amazing-travel-experience-adventure');
    });

    it('should set published date when status changes to Published', async () => {
      const post = new Post({
        title: 'Test Post',
        content: 'Content...',
        postType: 'Articles',
        author: testUser._id,
        status: 'Published',
      });

      const savedPost = await post.save();
      expect(savedPost.publishedAt).toBeDefined();
      expect(savedPost.publishedAt).toBeInstanceOf(Date);
    });

    it('should generate SEO metadata automatically', async () => {
      const post = new Post({
        title: 'This is a very long title that should be truncated for SEO purposes',
        content: 'This is the content that should be used for SEO description if excerpt is not provided.',
        postType: 'Articles',
        author: testUser._id,
      });

      const savedPost = await post.save();
      expect(savedPost.metadata.seoTitle).toBe('This is a very long title that should be truncated for SEO');
      expect(savedPost.metadata.seoDescription).toContain('This is the content');
      expect(savedPost.excerpt).toContain('This is the content');
    });

    it('should enforce unique slug constraint', async () => {
      await new Post({
        title: 'Unique Title',
        content: 'Content...',
        postType: 'Articles',
        author: testUser._id,
        slug: 'unique-slug',
      }).save();

      const duplicatePost = new Post({
        title: 'Different Title',
        content: 'Content...',
        postType: 'Articles',
        author: testUser._id,
        slug: 'unique-slug',
      });

      await expect(duplicatePost.save()).rejects.toThrow();
    });

    it('should handle duplicate titles with automatic slug conflict resolution', async () => {
      // Create first post with a title
      const firstPost = new Post({
        title: 'Amazing Travel Guide',
        content: 'Content...',
        postType: 'Articles',
        author: testUser._id,
      });
      const savedFirstPost = await firstPost.save();
      expect(savedFirstPost.slug).toBe('amazing-travel-guide');

      // Create second post with same title - should get different slug
      const secondPost = new Post({
        title: 'Amazing Travel Guide',
        content: 'Different content...',
        postType: 'Articles',
        author: testUser._id,
      });
      const savedSecondPost = await secondPost.save();
      expect(savedSecondPost.slug).toBe('amazing-travel-guide-1');

      // Create third post with same title - should get different slug
      const thirdPost = new Post({
        title: 'Amazing Travel Guide',
        content: 'Yet another content...',
        postType: 'Articles',
        author: testUser._id,
      });
      const savedThirdPost = await thirdPost.save();
      expect(savedThirdPost.slug).toBe('amazing-travel-guide-2');
    });
  });

  describe('Enhanced Validation and Error Handling', () => {
    it('should provide detailed error messages for package validation failures', async () => {
      const invalidPackage = new Post({
        title: 'Invalid Package',
        content: 'Content...',
        postType: 'Packages',
        author: testUser._id,
        // Missing required fields
      });

      try {
        await invalidPackage.save();
        fail('Should have thrown validation error');
      } catch (error) {
        expect(error.name).toBe('ValidationError');
        expect(error.message).toContain('Price is required for Packages');
        expect(error.message).toContain('Duration is required for Packages');
        expect(error.message).toContain('Location is required for Packages');
        expect(error.message).toContain('Max participants is required for Packages');
        expect(error.message).toContain('Difficulty level is required for Packages');
      }
    });

    it('should handle complex slug conflicts with multiple posts', async () => {
      const baseTitle = 'Popular Destination Guide';
      const posts = [];

      // Create 5 posts with the same title
      for (let i = 0; i < 5; i++) {
        const post = new Post({
          title: baseTitle,
          content: `Content ${i}...`,
          postType: 'Articles',
          author: testUser._id,
        });
        const savedPost = await post.save();
        posts.push(savedPost);
      }

      // Verify slug generation
      expect(posts[0].slug).toBe('popular-destination-guide');
      expect(posts[1].slug).toBe('popular-destination-guide-1');
      expect(posts[2].slug).toBe('popular-destination-guide-2');
      expect(posts[3].slug).toBe('popular-destination-guide-3');
      expect(posts[4].slug).toBe('popular-destination-guide-4');
    });

    it('should validate package price and currency requirements', async () => {
      const packageWithZeroPrice = new Post({
        title: 'Free Package',
        content: 'Content...',
        postType: 'Packages',
        price: 0,
        author: testUser._id,
        metadata: {
          duration: '3 days',
          location: 'Local',
          maxParticipants: 5,
          difficulty: 'Easy',
        },
        availability: {
          startDate: new Date(),
          endDate: new Date(Date.now() + 86400000),
        },
      });

      await expect(packageWithZeroPrice.save()).rejects.toThrow('Price is required for Packages and must be greater than 0');
    });

    it('should handle special characters in title for slug generation', async () => {
      const post = new Post({
        title: 'Travel to São Paulo & Rio de Janeiro: A Complete Guide!',
        content: 'Content...',
        postType: 'Articles',
        author: testUser._id,
      });

      const savedPost = await post.save();
      expect(savedPost.slug).toBe('travel-to-so-paulo-rio-de-janeiro-a-complete-guide');
    });

    it('should preserve manually set slugs when they are unique', async () => {
      const post = new Post({
        title: 'Custom Title',
        slug: 'my-custom-slug',
        content: 'Content...',
        postType: 'Articles',
        author: testUser._id,
      });

      const savedPost = await post.save();
      expect(savedPost.slug).toBe('my-custom-slug');
    });

    it('should throw error for manually set duplicate slugs', async () => {
      // Create first post with custom slug
      await new Post({
        title: 'First Post',
        slug: 'duplicate-slug',
        content: 'Content...',
        postType: 'Articles',
        author: testUser._id,
      }).save();

      // Try to create second post with same slug
      const duplicatePost = new Post({
        title: 'Second Post',
        slug: 'duplicate-slug',
        content: 'Different content...',
        postType: 'Articles',
        author: testUser._id,
      });

      await expect(duplicatePost.save()).rejects.toThrow("Post with slug 'duplicate-slug' already exists");
    });
  });

  describe('Static Methods', () => {
    beforeEach(async () => {
      // Create test posts
      await new Post({
        title: 'Published Article',
        content: 'Content...',
        postType: 'Articles',
        author: testUser._id,
        status: 'Published',
        publishedAt: new Date(),
      }).save();

      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 30);
      
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 30);

      await new Post({
        title: 'Available Package',
        content: 'Content...',
        postType: 'Packages',
        price: 100000,
        author: testUser._id,
        status: 'Published',
        publishedAt: new Date(),
        metadata: {
          duration: '5 days',
          location: 'Test Location',
          maxParticipants: 10,
          difficulty: 'Easy',
        },
        availability: {
          startDate: pastDate,
          endDate: futureDate,
          isAvailable: true,
        },
      }).save();
    });

    it('should get published posts', async () => {
      const posts = await Post.getPublishedPosts();
      expect(posts.length).toBe(2);
    });

    it('should filter posts by type', async () => {
      const articles = await Post.getPublishedPosts('Articles');
      expect(articles.length).toBe(1);
      expect(articles[0].postType).toBe('Articles');

      const packages = await Post.getPublishedPosts('Packages');
      expect(packages.length).toBe(1);
      expect(packages[0].postType).toBe('Packages');
    });

    it('should get available packages', async () => {
      const packages = await Post.getAvailablePackages();
      expect(packages.length).toBe(1);
      expect(packages[0].postType).toBe('Packages');
    });
  });
});