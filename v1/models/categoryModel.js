// v1/models/categoryModel.js
const mongoose = require('mongoose');

/**
 * @description Mongoose schema for the Category model.
 * Supports hierarchical categories for organizing posts and content.
 */
const CategorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Category name is required'],
    unique: true,
    trim: true,
    maxlength: [100, 'Category name cannot exceed 100 characters'],
  },
  slug: {
    type: String,
    unique: true,
    required: [true, 'Category slug is required'],
    lowercase: true,
    trim: true,
    match: [
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      'Slug must contain only lowercase letters, numbers, and hyphens',
    ],
  },
  description: {
    type: String,
    trim: true,
    maxlength: [1000, 'Description cannot exceed 1000 characters'],
  },
  parentCategory: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    default: null,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  sortOrder: {
    type: Number,
    default: 0,
    min: 0,
  },
  metadata: {
    seoTitle: {
      type: String,
      trim: true,
      maxlength: [60, 'SEO title cannot exceed 60 characters'],
    },
    seoDescription: {
      type: String,
      trim: true,
      maxlength: [160, 'SEO description cannot exceed 160 characters'],
    },
    color: {
      type: String,
      match: [/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, 'Color must be a valid hex color'],
    },
    icon: {
      type: String,
      trim: true,
    },
  },
}, {
  timestamps: true,
});

// Index for performance
CategorySchema.index({ parentCategory: 1 });
CategorySchema.index({ isActive: 1, sortOrder: 1 });

// Virtual for child categories
CategorySchema.virtual('children', {
  ref: 'Category',
  localField: '_id',
  foreignField: 'parentCategory',
});

// Method to generate slug from name
CategorySchema.methods.generateSlug = function() {
  return this.name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // Remove special characters
    .replace(/[\s_-]+/g, '-') // Replace spaces and underscores with hyphens
    .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
};

// Pre-save hook to generate slug if not provided
CategorySchema.pre('save', function(next) {
  if (!this.slug && this.name) {
    this.slug = this.generateSlug();
  }
  next();
});

// Pre-validate hook to ensure slug is generated before validation
CategorySchema.pre('validate', function(next) {
  if (!this.slug && this.name) {
    this.slug = this.generateSlug();
  }
  next();
});

// Prevent circular references in parent-child relationships
CategorySchema.pre('save', async function(next) {
  if (this.parentCategory && this.parentCategory.equals(this._id)) {
    const error = new Error('Category cannot be its own parent');
    return next(error);
  }
  
  // Check for circular reference by traversing up the parent chain
  if (this.parentCategory) {
    let currentParent = this.parentCategory;
    const visitedIds = new Set([this._id.toString()]);
    
    while (currentParent) {
      if (visitedIds.has(currentParent.toString())) {
        const error = new Error('Circular reference detected in category hierarchy');
        return next(error);
      }
      
      visitedIds.add(currentParent.toString());
      
      const parentCategory = await this.constructor.findById(currentParent);
      if (!parentCategory) break;
      
      currentParent = parentCategory.parentCategory;
    }
  }
  
  next();
});

// Static method to get category tree
CategorySchema.statics.getCategoryTree = async function() {
  const categories = await this.find({ isActive: true })
    .sort({ sortOrder: 1, name: 1 })
    .lean();
  
  const categoryMap = new Map();
  const rootCategories = [];
  
  // Create a map of all categories
  categories.forEach(category => {
    categoryMap.set(category._id.toString(), { ...category, children: [] });
  });
  
  // Build the tree structure
  categories.forEach(category => {
    if (category.parentCategory) {
      const parent = categoryMap.get(category.parentCategory.toString());
      if (parent) {
        parent.children.push(categoryMap.get(category._id.toString()));
      }
    } else {
      rootCategories.push(categoryMap.get(category._id.toString()));
    }
  });
  
  return rootCategories;
};

// Static method to get all descendant categories
CategorySchema.statics.getDescendants = async function(categoryId) {
  const descendants = [];
  const queue = [categoryId];
  
  while (queue.length > 0) {
    const currentId = queue.shift();
    const children = await this.find({ parentCategory: currentId });
    
    for (const child of children) {
      descendants.push(child);
      queue.push(child._id);
    }
  }
  
  return descendants;
};

module.exports = mongoose.model('Category', CategorySchema);