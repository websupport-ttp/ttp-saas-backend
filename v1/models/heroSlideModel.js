const mongoose = require('mongoose');

const heroSlideSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    maxlength: 100,
  },
  subtitle: {
    type: String,
    maxlength: 200,
  },
  description: {
    type: String,
    maxlength: 500,
  },
  image: {
    url: String,
    publicId: String,
  },
  ctaText: {
    type: String,
    maxlength: 50,
  },
  ctaLink: {
    type: String,
    maxlength: 200,
  },
  order: {
    type: Number,
    default: 0,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
}, {
  timestamps: true,
});

heroSlideSchema.index({ order: 1, isActive: 1 });

module.exports = mongoose.model('HeroSlide', heroSlideSchema);
