// seed-test-data.js - Populate database with test data
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./v1/models/userModel');
const Car = require('./v1/models/carModel');
const CarBooking = require('./v1/models/carBookingModel');

const seedData = async () => {
  try {
    console.log('🌱 Starting database seed...\n');

    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB\n');

    // Clear existing data (optional - comment out to keep existing data)
    // await User.deleteMany({ email: { $regex: '@test.com$' } });
    // await Car.deleteMany({});
    // await CarBooking.deleteMany({});
    // console.log('🧹 Cleared test data\n');

    // Create test users
    console.log('👥 Creating test users...');
    const testUsers = [];
    
    // Admin user
    const admin = await User.create({
      firstName: 'Admin',
      lastName: 'User',
      email: 'admin@test.com',
      phoneNumber: '+2348012345678',
      password: 'Test123!@#',
      role: 'Admin',
      isEmailVerified: true,
      isPhoneVerified: true,
    });
    testUsers.push(admin);
    console.log('  ✓ Admin user created');

    // Regular users
    for (let i = 1; i <= 5; i++) {
      const user = await User.create({
        firstName: `User${i}`,
        lastName: `Test`,
        email: `user${i}@test.com`,
        phoneNumber: `+23480${1234567 + i}`,
        password: 'Test123!@#',
        role: 'User',
        isEmailVerified: true,
        isPhoneVerified: true,
        totalSpent: Math.floor(Math.random() * 500000),
        totalTransactions: Math.floor(Math.random() * 20),
      });
      testUsers.push(user);
    }
    console.log(`  ✓ ${testUsers.length} users created\n`);

    // Create test cars
    console.log('🚗 Creating test cars...');
    const carBrands = ['Toyota', 'Honda', 'Mercedes', 'BMW', 'Lexus'];
    const carModels = {
      Toyota: ['Camry', 'Corolla', 'RAV4', 'Highlander'],
      Honda: ['Accord', 'Civic', 'CR-V', 'Pilot'],
      Mercedes: ['C-Class', 'E-Class', 'GLE', 'S-Class'],
      BMW: ['3 Series', '5 Series', 'X5', 'X7'],
      Lexus: ['ES', 'RX', 'GX', 'LX'],
    };

    const testCars = [];
    for (const brand of carBrands) {
      const models = carModels[brand];
      for (let i = 0; i < 2; i++) {
        const model = models[i];
        const year = 2020 + Math.floor(Math.random() * 4);
        const car = await Car.create({
          name: `${brand} ${model} ${year}`,
          brand,
          model,
          year,
          registrationNumber: `ABC${Math.floor(Math.random() * 9000) + 1000}XY`,
          color: ['Black', 'White', 'Silver', 'Blue', 'Red'][Math.floor(Math.random() * 5)],
          seats: [4, 5, 7][Math.floor(Math.random() * 3)],
          transmission: ['Automatic', 'Manual'][Math.floor(Math.random() * 2)],
          fuelType: ['Petrol', 'Diesel', 'Hybrid'][Math.floor(Math.random() * 3)],
          pricePerDay: 15000 + Math.floor(Math.random() * 35000),
          features: ['Air Conditioning', 'GPS', 'Bluetooth', 'USB Charging'],
          images: [`https://via.placeholder.com/400x300?text=${brand}+${model}`],
          status: 'available',
          mileage: Math.floor(Math.random() * 50000),
          lastServiceDate: new Date(Date.now() - Math.random() * 90 * 24 * 60 * 60 * 1000),
        });
        testCars.push(car);
      }
    }
    console.log(`  ✓ ${testCars.length} cars created\n`);

    // Create test bookings
    console.log('📋 Creating test bookings...');
    const bookingStatuses = ['pending', 'confirmed', 'completed', 'cancelled'];
    const paymentStatuses = ['pending', 'paid', 'failed'];
    
    const testBookings = [];
    for (let i = 0; i < 15; i++) {
      const user = testUsers[Math.floor(Math.random() * testUsers.length)];
      const car = testCars[Math.floor(Math.random() * testCars.length)];
      const days = Math.floor(Math.random() * 7) + 1;
      const pickupDate = new Date(Date.now() + Math.random() * 30 * 24 * 60 * 60 * 1000);
      const dropoffDate = new Date(pickupDate.getTime() + days * 24 * 60 * 60 * 1000);
      
      const booking = await CarBooking.create({
        user: user._id,
        car: car._id,
        bookingReference: `BK${Date.now()}${i}`,
        pickupDate,
        dropoffDate,
        pickupLocation: 'Lagos Airport',
        dropoffLocation: 'Lagos Airport',
        totalAmount: car.pricePerDay * days,
        status: bookingStatuses[Math.floor(Math.random() * bookingStatuses.length)],
        paymentStatus: paymentStatuses[Math.floor(Math.random() * paymentStatuses.length)],
        payment: {
          method: 'card',
          reference: `PAY${Date.now()}${i}`,
        },
      });
      testBookings.push(booking);
    }
    console.log(`  ✓ ${testBookings.length} bookings created\n`);

    // Summary
    console.log('📊 Seed Summary:');
    console.log(`   Users: ${testUsers.length}`);
    console.log(`   Cars: ${testCars.length}`);
    console.log(`   Bookings: ${testBookings.length}`);
    console.log('');
    console.log('✅ Database seeded successfully!');
    console.log('');
    console.log('🔑 Test Credentials:');
    console.log('   Admin: admin@test.com / Test123!@#');
    console.log('   User1: user1@test.com / Test123!@#');
    console.log('   User2: user2@test.com / Test123!@#');
    console.log('');

    process.exit(0);
  } catch (error) {
    console.error('❌ Seed failed:', error);
    process.exit(1);
  }
};

// Run seed
seedData();
