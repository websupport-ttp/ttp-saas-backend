// v1/models/postModel.js
const mongoose = require('mongoose');

/**
 * @description Mongoose schema for the Post model.
 * Supports both Articles and Packages with appropriate validation and features.
 */
const PostSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Post title is required'],
    trim: true,
    maxlength: [200, 'Title cannot exceed 200 characters'],
  },
  slug: {
    type: String,
    unique: true,
    lowercase: true,
    trim: true,
    match: [
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      'Slug must contain only lowercase letters, numbers, and hyphens',
    ],
  },
  content: {
    type: String,
    required: [true, 'Post content is required'],
  },
  excerpt: {
    type: String,
    trim: true,
    maxlength: [500, 'Excerpt cannot exceed 500 characters'],
  },
  postType: {
    type: String,
    enum: {
      values: ['Articles', 'Packages'],
      message: 'Post type must be either Articles or Packages',
    },
    required: [true, 'Post type is required'],
  },
  price: {
    type: Number,
    required: function () {
      return this.postType === 'Packages';
    },
    min: [0, 'Price cannot be negative'],
    validate: {
      validator: function (value) {
        // Price is required for Packages, optional for Articles
        if (this.postType === 'Packages') {
          return value != null && value > 0;
        }
        return value == null || value >= 0;
      },
      message: 'Price is required for Packages and must be greater than 0',
    },
  },
  currency: {
    type: String,
    default: 'NGN',
    enum: ['NGN', 'USD', 'EUR', 'GBP'],
    required: function () {
      return this.postType === 'Packages' && this.price != null;
    },
  },
  categories: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
  }],
  tags: [{
    type: String,
    trim: true,
    lowercase: true,
    maxlength: [50, 'Tag cannot exceed 50 characters'],
  }],
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Post author is required'],
  },
  status: {
    type: String,
    enum: {
      values: ['Draft', 'Published', 'Archived'],
      message: 'Status must be Draft, Published, or Archived',
    },
    default: 'Draft',
  },
  featuredImage: {
    type: String,
    trim: true,
  },
  gallery: [{
    type: String,
    trim: true,
  }],
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
    // Package-specific metadata
    duration: {
      type: String,
      trim: true,
      required: function () {
        return this.postType === 'Packages';
      },
    },
    location: {
      type: String,
      trim: true,
      required: function () {
        return this.postType === 'Packages';
      },
    },
    inclusions: [{
      type: String,
      trim: true,
    }],
    exclusions: [{
      type: String,
      trim: true,
    }],
    maxParticipants: {
      type: Number,
      min: 1,
      validate: {
        validator: function (value) {
          return this.postType !== 'Packages' || (value != null && value > 0);
        },
        message: 'Max participants is required for Packages and must be greater than 0',
      },
    },
    difficulty: {
      type: String,
      enum: ['Easy', 'Moderate', 'Challenging', 'Expert'],
      required: function () {
        return this.postType === 'Packages';
      },
    },
    // Article-specific metadata
    readingTime: {
      type: Number, // in minutes
      min: 1,
    },
    wordCount: {
      type: Number,
      min: 0,
    },
  },
  publishedAt: {
    type: Date,
    validate: {
      validator: function (value) {
        return this.status !== 'Published' || value != null;
      },
      message: 'Published date is required when status is Published',
    },
  },
  viewCount: {
    type: Number,
    default: 0,
    min: 0,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  isFeatured: {
    type: Boolean,
    default: false,
  },
  // Package-specific fields
  availability: {
    startDate: {
      type: Date,
      required: function () {
        return this.postType === 'Packages';
      },
    },
    endDate: {
      type: Date,
      required: function () {
        return this.postType === 'Packages';
      },
      validate: {
        validator: function (value) {
          return this.postType !== 'Packages' || !this.availability?.startDate || value > this.availability.startDate;
        },
        message: 'End date must be after start date',
      },
    },
    isAvailable: {
      type: Boolean,
      default: true,
    },
  },
}, {
  timestamps: true,
});

// Indexes for performance (removed duplicate indexes that are already defined with unique: true)
PostSchema.index({ postType: 1, status: 1 });
PostSchema.index({ categories: 1 });
PostSchema.index({ tags: 1 });
PostSchema.index({ publishedAt: -1 });
PostSchema.index({ author: 1 });
PostSchema.index({ isActive: 1, isFeatured: 1 });
PostSchema.index({ 'availability.startDate': 1, 'availability.endDate': 1 });

// Virtual for URL
PostSchema.virtual('url').get(function () {
  return `/${this.postType.toLowerCase()}/${this.slug}`;
});

// Method to generate slug from title
PostSchema.methods.generateSlug = function () {
  return this.title
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // Remove special characters
    .replace(/[\s_-]+/g, '-') // Replace spaces and underscores with hyphens
    .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
};

// Method to calculate reading time for articles
PostSchema.methods.calculateReadingTime = function () {
  if (this.postType === 'Articles' && this.content) {
    const wordsPerMinute = 200;
    // Filter out empty strings from split to get accurate word count
    const words = this.content.split(/\s+/).filter(word => word.length > 0);
    const wordCount = words.length;
    const readingTime = Math.ceil(wordCount / wordsPerMinute);

    this.metadata.wordCount = wordCount;
    this.metadata.readingTime = readingTime;

    return readingTime;
  }
  return null;
};

// Method to check if package is currently available
PostSchema.methods.isPackageAvailable = function () {
  if (this.postType !== 'Packages') return false;

  const now = new Date();
  return this.availability?.isAvailable &&
    this.availability?.startDate <= now &&
    this.availability?.endDate >= now &&
    this.status === 'Published' &&
    this.isActive;
};

// Pre-save hooks with slug conflict resolution
PostSchema.pre('save', async function (next) {
  try {
    // Handle slug generation and conflict resolution
    if ((this.isModified('title') || this.isNew) && this.title) {
      // Only generate new slug if it wasn't manually set
      const wasSlugManuallySet = this.isModified('slug') && this.slug && this.slug !== this.generateSlug();
      
      if (!wasSlugManuallySet) {
        let baseSlug = this.generateSlug();
        let slug = baseSlug;
        let counter = 1;

        // Check for existing slugs and resolve conflicts
        while (await this.constructor.findOne({ slug, _id: { $ne: this._id } })) {
          slug = `${baseSlug}-${counter}`;
          counter++;
        }

        this.slug = slug;
      } else {
        // If slug was manually set, still check for conflicts and throw error
        const existingPost = await this.constructor.findOne({ slug: this.slug, _id: { $ne: this._id } });
        if (existingPost) {
          const error = new Error(`Post with slug '${this.slug}' already exists`);
          error.code = 11000;
          throw error;
        }
      }
    }

    // Set published date when status changes to Published
    if (this.status === 'Published' && !this.publishedAt) {
      this.publishedAt = new Date();
    }

    // Calculate reading time for articles
    if (this.postType === 'Articles') {
      this.calculateReadingTime();
    }

    // Generate SEO metadata if not provided
    if (!this.metadata.seoTitle && this.title) {
      if (this.title.length > 60) {
        // Truncate at word boundary if possible
        let truncated = this.title.substring(0, 60);
        const lastSpaceIndex = truncated.lastIndexOf(' ');
        if (lastSpaceIndex > 40) { // Only use word boundary if it's not too short
          truncated = truncated.substring(0, lastSpaceIndex);
        }
        this.metadata.seoTitle = truncated;
      } else {
        this.metadata.seoTitle = this.title;
      }
    }

    if (!this.metadata.seoDescription && this.excerpt) {
      this.metadata.seoDescription = this.excerpt.length > 160 ? this.excerpt.substring(0, 160) : this.excerpt;
    } else if (!this.metadata.seoDescription && this.content) {
      // Generate excerpt from content if not provided
      const plainText = this.content.replace(/<[^>]*>/g, ''); // Remove HTML tags
      this.metadata.seoDescription = plainText.length > 160 ? plainText.substring(0, 160) : plainText;

      if (!this.excerpt) {
        this.excerpt = plainText.length > 500 ? plainText.substring(0, 500) : plainText;
      }
    }

    next();
  } catch (error) {
    next(error);
  }
});

// Pre-validate hook for package-specific validations
PostSchema.pre('validate', function (next) {
  // Generate slug if not provided (before validation) - only for new documents or when title changes
  // But don't do conflict resolution here - that happens in pre-save
  if (!this.slug && this.title) {
    this.slug = this.generateSlug();
  }

  // Validate slug is present after generation
  if (!this.slug) {
    this.invalidate('slug', 'Post slug is required');
  }

  // Ensure package-specific fields are properly validated
  if (this.postType === 'Packages') {
    // Validate price for packages with better error message
    if (!this.price || this.price <= 0) {
      this.invalidate('price', 'Price is required for Packages and must be greater than 0');
    }

    // Validate that required package fields are present
    if (!this.metadata.duration) {
      this.invalidate('metadata.duration', 'Duration is required for Packages');
    }
    if (!this.metadata.location) {
      this.invalidate('metadata.location', 'Location is required for Packages');
    }
    if (!this.metadata.maxParticipants || this.metadata.maxParticipants <= 0) {
      this.invalidate('metadata.maxParticipants', 'Max participants is required for Packages and must be greater than 0');
    }
    if (!this.metadata.difficulty) {
      this.invalidate('metadata.difficulty', 'Difficulty level is required for Packages');
    }
    if (!this.availability?.startDate) {
      this.invalidate('availability.startDate', 'Start date is required for Packages');
    }
    if (!this.availability?.endDate) {
      this.invalidate('availability.endDate', 'End date is required for Packages');
    }
  }

  next();
});

// Static methods
PostSchema.statics.getPublishedPosts = function (postType = null, limit = 10, skip = 0) {
  const query = { status: 'Published', isActive: true };
  if (postType) {
    query.postType = postType;
  }

  return this.find(query)
    .populate('author', 'firstName lastName')
    .populate('categories', 'name slug')
    .sort({ publishedAt: -1 })
    .limit(limit)
    .skip(skip);
};

PostSchema.statics.getAvailablePackages = function (limit = 10, skip = 0) {
  const now = new Date();

  return this.find({
    postType: 'Packages',
    status: 'Published',
    isActive: true,
    'availability.isAvailable': true,
    'availability.startDate': { $lte: now },
    'availability.endDate': { $gte: now },
  })
    .populate('author', 'firstName lastName')
    .populate('categories', 'name slug')
    .sort({ publishedAt: -1 })
    .limit(limit)
    .skip(skip);
};

PostSchema.statics.getFeaturedPosts = function (postType = null, limit = 5) {
  const query = {
    status: 'Published',
    isActive: true,
    isFeatured: true
  };
  if (postType) {
    query.postType = postType;
  }

  return this.find(query)
    .populate('author', 'firstName lastName')
    .populate('categories', 'name slug')
    .sort({ publishedAt: -1 })
    .limit(limit);
};

module.exports = mongoose.model('Post', PostSchema);