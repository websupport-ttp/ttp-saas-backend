const mongoose = require('mongoose');

const googleReviewSchema = new mongoose.Schema({
  reviewId: {
    type: String,
    required: true,
    unique: true,
  },
  authorName: {
    type: String,
    required: true,
  },
  authorPhoto: {
    type: String,
  },
  rating: {
    type: Number,
    required: true,
    min: 1,
    max: 5,
  },
  text: {
    type: String,
  },
  time: {
    type: Date,
    required: true,
  },
  language: {
    type: String,
    default: 'en',
  },
  isVisible: {
    type: Boolean,
    default: true,
  },
}, {
  timestamps: true,
});

googleReviewSchema.index({ time: -1, isVisible: 1 });
googleReviewSchema.index({ rating: -1 });

module.exports = mongoose.model('GoogleReview', googleReviewSchema);
