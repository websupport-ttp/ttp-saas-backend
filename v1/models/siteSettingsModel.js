// v1/models/siteSettingsModel.js
const mongoose = require('mongoose');

const siteSettingsSchema = new mongoose.Schema(
  {
    // Contact Information
    phone: {
      type: String,
      required: true,
      default: '+234 (0) 903 557 3593',
    },
    phoneDescription: {
      type: String,
      default: '24/7 Customer Support',
    },
    email: {
      type: String,
      required: true,
      default: 'info@thetravelplace.ng',
    },
    emailDescription: {
      type: String,
      default: 'General Inquiries',
    },
    address: {
      type: String,
      required: true,
      default: 'Lagos, Nigeria',
    },
    addressDescription: {
      type: String,
      default: 'Visit Our Office',
    },

    // Company Information
    tagline: {
      type: String,
      required: true,
      default: 'Your trusted partner for seamless travel experiences. From flights and hotels to visa applications and car rentals, we make travel planning effortless.',
    },
    foundedYear: {
      type: Number,
      required: true,
      default: 2016,
    },
    companyName: {
      type: String,
      default: 'The Travel Place',
    },

    // Social Media Links
    socialLinks: {
      facebook: {
        type: String,
        default: 'https://facebook.com/thetravelplace',
      },
      instagram: {
        type: String,
        default: 'https://instagram.com/thetravelplace',
      },
      twitter: {
        type: String,
        default: 'https://twitter.com/thetravelplace',
      },
      linkedin: {
        type: String,
        default: 'https://linkedin.com/company/thetravelplace',
      },
    },

    // Metadata
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: true,
  }
);

// Ensure only one settings document exists
siteSettingsSchema.statics.getSettings = async function () {
  let settings = await this.findOne();
  if (!settings) {
    settings = await this.create({});
  }
  return settings;
};

siteSettingsSchema.statics.updateSettings = async function (updates, userId) {
  let settings = await this.findOne();
  if (!settings) {
    settings = await this.create(updates);
  } else {
    Object.assign(settings, updates);
    settings.updatedBy = userId;
    await settings.save();
  }
  return settings;
};

const SiteSettings = mongoose.model('SiteSettings', siteSettingsSchema);

module.exports = SiteSettings;
