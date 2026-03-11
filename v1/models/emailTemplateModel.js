// v1/models/emailTemplateModel.js
const mongoose = require('mongoose');

const emailTemplateSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Template name is required'],
      unique: true,
      trim: true,
    },
    displayName: {
      type: String,
      required: [true, 'Display name is required'],
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    subject: {
      type: String,
      required: [true, 'Email subject is required'],
      trim: true,
    },
    category: {
      type: String,
      enum: ['booking', 'authentication', 'notification', 'marketing'],
      default: 'notification',
    },
    variables: [{
      name: String,
      description: String,
      example: String,
    }],
    headerTitle: {
      type: String,
      default: 'THE TRAVEL PLACE',
    },
    headerSubtitle: {
      type: String,
      default: '',
    },
    headerIcon: {
      type: String,
      default: 'flight',
    },
    greeting: {
      type: String,
      default: 'Hello!',
    },
    mainContent: {
      type: String,
      required: [true, 'Main content is required'],
    },
    footerText: {
      type: String,
      default: 'Thank you for choosing The Travel Place.',
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    isSystem: {
      type: Boolean,
      default: false, // System templates cannot be deleted
    },
  },
  {
    timestamps: true,
  }
);

// Index for faster lookups
emailTemplateSchema.index({ name: 1 });
emailTemplateSchema.index({ category: 1 });
emailTemplateSchema.index({ isActive: 1 });

const EmailTemplate = mongoose.model('EmailTemplate', emailTemplateSchema);

module.exports = EmailTemplate;
