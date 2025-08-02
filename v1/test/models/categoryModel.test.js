// v1/test/models/categoryModel.test.js
const mongoose = require('mongoose');
const Category = require('../../models/categoryModel');

describe('Category Model', () => {
  beforeAll(async () => {
    // Ensure test environment is set up
    process.env.NODE_ENV = 'test';
    process.env.JWT_ACCESS_SECRET = 'test_access_secret';
    process.env.JWT_REFRESH_SECRET = 'test_refresh_secret';
  });

  describe('Category Creation', () => {
    it('should create a valid category', async () => {
      const categoryData = {
        name: 'Travel Destinations',
        description: 'Popular travel destinations around the world',
      };

      const category = new Category(categoryData);
      const savedCategory = await category.save();

      expect(savedCategory.name).toBe(categoryData.name);
      expect(savedCategory.description).toBe(categoryData.description);
      expect(savedCategory.slug).toBe('travel-destinations');
      expect(savedCategory.isActive).toBe(true);
      expect(savedCategory.sortOrder).toBe(0);
    });

    it('should generate slug automatically from name', async () => {
      const category = new Category({
        name: 'Adventure Travel & Tours',
      });

      const savedCategory = await category.save();
      expect(savedCategory.slug).toBe('adventure-travel-tours');
    });

    it('should require name field', async () => {
      const category = new Category({});

      await expect(category.save()).rejects.toThrow('Category name is required');
    });

    it('should enforce unique name constraint', async () => {
      const categoryData = { name: 'Beach Destinations' };
      
      await new Category(categoryData).save();
      
      const duplicateCategory = new Category(categoryData);
      await expect(duplicateCategory.save()).rejects.toThrow();
    });

    it('should enforce unique slug constraint', async () => {
      await new Category({ name: 'Beach Tours', slug: 'beach-tours' }).save();
      
      const duplicateSlugCategory = new Category({ 
        name: 'Different Name', 
        slug: 'beach-tours' 
      });
      
      await expect(duplicateSlugCategory.save()).rejects.toThrow();
    });
  });

  describe('Hierarchical Categories', () => {
    it('should create parent-child relationship', async () => {
      const parent = await new Category({ name: 'Travel' }).save();
      const child = await new Category({ 
        name: 'International Travel',
        parentCategory: parent._id 
      }).save();

      expect(child.parentCategory.toString()).toBe(parent._id.toString());
    });

    it('should prevent circular references', async () => {
      const category = await new Category({ name: 'Test Category' }).save();
      
      category.parentCategory = category._id;
      
      await expect(category.save()).rejects.toThrow('Category cannot be its own parent');
    });

    it('should get category tree structure', async () => {
      const parent = await new Category({ name: 'Travel', sortOrder: 1 }).save();
      const child1 = await new Category({ 
        name: 'Domestic', 
        parentCategory: parent._id,
        sortOrder: 1 
      }).save();
      const child2 = await new Category({ 
        name: 'International', 
        parentCategory: parent._id,
        sortOrder: 2 
      }).save();

      const tree = await Category.getCategoryTree();
      
      expect(tree).toHaveLength(1);
      expect(tree[0].name).toBe('Travel');
      expect(tree[0].children).toHaveLength(2);
      expect(tree[0].children[0].name).toBe('Domestic');
      expect(tree[0].children[1].name).toBe('International');
    });
  });

  describe('SEO and Metadata', () => {
    it('should store SEO metadata', async () => {
      const category = new Category({
        name: 'Adventure Tours',
        metadata: {
          seoTitle: 'Best Adventure Tours',
          seoDescription: 'Discover amazing adventure tours worldwide',
          color: '#FF5733',
          icon: 'mountain'
        }
      });

      const savedCategory = await category.save();
      
      expect(savedCategory.metadata.seoTitle).toBe('Best Adventure Tours');
      expect(savedCategory.metadata.seoDescription).toBe('Discover amazing adventure tours worldwide');
      expect(savedCategory.metadata.color).toBe('#FF5733');
      expect(savedCategory.metadata.icon).toBe('mountain');
    });

    it('should validate hex color format', async () => {
      const category = new Category({
        name: 'Test Category',
        metadata: {
          color: 'invalid-color'
        }
      });

      await expect(category.save()).rejects.toThrow('Color must be a valid hex color');
    });
  });
});