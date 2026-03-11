const mongoose = require('mongoose');
const dotenv = require('dotenv');
const ServiceCharge = require('./v1/models/serviceChargeModel');
const Tax = require('./v1/models/taxModel');
const Discount = require('./v1/models/discountModel');

dotenv.config({ path: './.env' });

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('MongoDB connected');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
};

const seedPricingData = async () => {
  try {
    await connectDB();

    // Clear existing data
    await ServiceCharge.deleteMany({});
    await Tax.deleteMany({});
    await Discount.deleteMany({});

    console.log('Existing pricing data cleared');

    // Seed Service Charges
    const serviceCharges = [
      {
        name: 'Platform Service Fee',
        description: 'Standard platform service fee for all bookings',
        type: 'percentage',
        value: 2.5,
        appliesTo: ['all'],
        isActive: true,
        priority: 1
      },
      {
        name: 'Flight Booking Fee',
        description: 'Additional fee for flight bookings',
        type: 'fixed',
        value: 500,
        appliesTo: ['flights'],
        isActive: true,
        priority: 2
      },
      {
        name: 'Hotel Booking Fee',
        description: 'Service fee for hotel reservations',
        type: 'percentage',
        value: 3,
        appliesTo: ['hotels'],
        isActive: true,
        priority: 2
      }
    ];

    await ServiceCharge.insertMany(serviceCharges);
    console.log(`${serviceCharges.length} service charges seeded`);

    // Seed Taxes
    const taxes = [
      {
        name: 'VAT',
        description: 'Value Added Tax',
        type: 'VAT',
        rate: 7.5,
        appliesTo: ['all'],
        country: 'NG',
        isActive: true,
        isInclusive: false,
        priority: 1
      },
      {
        name: 'Tourism Development Levy',
        description: 'Tourism development tax',
        type: 'Other',
        rate: 1,
        appliesTo: ['hotels', 'packages'],
        country: 'NG',
        isActive: true,
        isInclusive: false,
        priority: 2
      }
    ];

    await Tax.insertMany(taxes);
    console.log(`${taxes.length} taxes seeded`);

    // Seed Discounts
    const discounts = [
      {
        name: 'Role-Based Discount',
        description: 'Automatic discounts based on user role',
        type: 'role-based',
        roleDiscounts: {
          user: 0,
          staff: 10,
          agent: 15,
          business: 20
        },
        appliesTo: ['all'],
        isActive: true,
        isStackable: false,
        priority: 1
      },
      {
        name: 'Early Bird Special',
        description: '10% off for bookings made 30 days in advance',
        code: 'EARLYBIRD10',
        type: 'percentage',
        value: 10,
        appliesTo: ['flights', 'hotels'],
        minPurchaseAmount: 50000,
        validFrom: new Date(),
        validUntil: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days
        isActive: true,
        isStackable: false,
        priority: 2
      },
      {
        name: 'First Time Customer',
        description: '5% discount for first-time customers',
        code: 'WELCOME5',
        type: 'percentage',
        value: 5,
        appliesTo: ['all'],
        usageLimit: 1000,
        validFrom: new Date(),
        validUntil: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
        isActive: true,
        isStackable: false,
        priority: 3
      },
      {
        name: 'Summer Sale',
        description: 'Fixed ₦5,000 off on bookings above ₦100,000',
        code: 'SUMMER5K',
        type: 'fixed',
        value: 5000,
        appliesTo: ['all'],
        minPurchaseAmount: 100000,
        maxDiscountAmount: 5000,
        validFrom: new Date(),
        validUntil: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000), // 60 days
        isActive: true,
        isStackable: false,
        priority: 4
      }
    ];

    await Discount.insertMany(discounts);
    console.log(`${discounts.length} discounts seeded`);

    console.log('✅ Pricing data seeded successfully');
    process.exit(0);
  } catch (error) {
    console.error('Error seeding pricing data:', error);
    process.exit(1);
  }
};

seedPricingData();
