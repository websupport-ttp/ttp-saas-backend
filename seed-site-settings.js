// seed-site-settings.js
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const SiteSettings = require('./v1/models/siteSettingsModel');
const TeamMember = require('./v1/models/teamMemberModel');

// Load environment variables
dotenv.config({ path: './.env' });

// Connect to MongoDB
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ MongoDB connected successfully');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error.message);
    process.exit(1);
  }
};

// Seed site settings
const seedSiteSettings = async () => {
  try {
    // Check if settings already exist
    let settings = await SiteSettings.findOne();
    
    if (settings) {
      console.log('ℹ️  Site settings already exist. Updating...');
      settings = await SiteSettings.updateSettings({
        phone: '+234 (0) 903 557 3593',
        phoneDescription: '24/7 Customer Support',
        email: 'info@thetravelplace.ng',
        emailDescription: 'General Inquiries',
        address: 'Lagos, Nigeria',
        addressDescription: 'Visit Our Office',
        tagline: 'Your trusted partner for seamless travel experiences. From flights and hotels to visa applications and car rentals, we make travel planning effortless.',
        foundedYear: 2016,
        companyName: 'The Travel Place',
        socialLinks: {
          facebook: 'https://facebook.com/thetravelplace',
          instagram: 'https://instagram.com/thetravelplace',
          twitter: 'https://twitter.com/thetravelplace',
          linkedin: 'https://linkedin.com/company/thetravelplace',
        },
      });
    } else {
      console.log('✨ Creating new site settings...');
      settings = await SiteSettings.create({
        phone: '+234 (0) 903 557 3593',
        phoneDescription: '24/7 Customer Support',
        email: 'info@thetravelplace.ng',
        emailDescription: 'General Inquiries',
        address: 'Lagos, Nigeria',
        addressDescription: 'Visit Our Office',
        tagline: 'Your trusted partner for seamless travel experiences. From flights and hotels to visa applications and car rentals, we make travel planning effortless.',
        foundedYear: 2016,
        companyName: 'The Travel Place',
        socialLinks: {
          facebook: 'https://facebook.com/thetravelplace',
          instagram: 'https://instagram.com/thetravelplace',
          twitter: 'https://twitter.com/thetravelplace',
          linkedin: 'https://linkedin.com/company/thetravelplace',
        },
      });
    }
    
    console.log('✅ Site settings seeded successfully');
    console.log(settings);
  } catch (error) {
    console.error('❌ Error seeding site settings:', error.message);
    throw error;
  }
};

// Seed team members
const seedTeamMembers = async () => {
  try {
    // Check if team members already exist
    const existingMembers = await TeamMember.countDocuments();
    
    if (existingMembers > 0) {
      console.log(`ℹ️  ${existingMembers} team members already exist. Skipping...`);
      return;
    }
    
    console.log('✨ Creating default team members...');
    
    const teamMembers = [
      {
        name: 'Sarah Johnson',
        role: 'CEO & Founder',
        bio: 'With over 20 years in the travel industry, Sarah founded The Travel Place to make travel accessible to everyone.',
        image: '/images/author-avatar-1.svg',
        order: 1,
        isActive: true,
      },
      {
        name: 'Michael Chen',
        role: 'Head of Operations',
        bio: 'Michael ensures our operations run smoothly and our customers receive exceptional service worldwide.',
        image: '/images/author-avatar-2.svg',
        order: 2,
        isActive: true,
      },
      {
        name: 'Emily Rodriguez',
        role: 'Travel Experience Director',
        bio: 'Emily curates unique travel experiences and manages our destination partnerships globally.',
        image: '/images/author-avatar.svg',
        order: 3,
        isActive: true,
      },
    ];
    
    await TeamMember.insertMany(teamMembers);
    
    console.log('✅ Team members seeded successfully');
    console.log(`   Created ${teamMembers.length} team members`);
  } catch (error) {
    console.error('❌ Error seeding team members:', error.message);
    throw error;
  }
};

// Main seed function
const seedAll = async () => {
  try {
    await connectDB();
    
    console.log('\n🌱 Starting seed process...\n');
    
    await seedSiteSettings();
    await seedTeamMembers();
    
    console.log('\n✅ All data seeded successfully!\n');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Seed process failed:', error.message);
    process.exit(1);
  }
};

// Run seed
seedAll();
