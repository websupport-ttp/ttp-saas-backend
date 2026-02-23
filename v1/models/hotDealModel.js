const mongoose = require('mongoose');

const hotDealSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    maxlength: 100,
  },
  description: {
    type: String,
    required: true,
    maxlength: 500,
  },
  image: {
    url: String,
    publicId: String,
  },
  originalPrice: {
    type: Number,
    required: true,
  },
  discountedPrice: {
    type: Number,
    required: true,
  },
  discountPercentage: {
    type: Number,
  },
  category: {
    type: String,
    enum: ['Flight', 'Hotel', 'Package', 'Car Rental', 'Insurance'],
    required: true,
  },
  validFrom: {
    type: Date,
    required: true,
  },
  validUntil: {
    type: Date,
    required: true,
  },
  link: {
    type: String,
    maxlength: 200,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  featured: {
    type: Boolean,
    default: false,
  },
}, {
  timestamps: true,
});

// Calculate discount percentage before saving
hotDealSchema.pre('save', function(next) {
  if (this.originalPrice && this.discountedPrice) {
    this.discountPercentage = Math.round(
      ((this.originalPrice - this.discountedPrice) / this.originalPrice) * 100
    );
  }
  next();
});

hotDealSchema.index({ validUntil: 1, isActive: 1 });
hotDealSchema.index({ category: 1, isActive: 1 });

module.exports = mongoose.model('HotDeal', hotDealSchema);
