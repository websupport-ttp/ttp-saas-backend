// v1/test/performance/affiliatePerformance.test.js
// Performance tests for commission processing and wallet operations

const autocannon = require('autocannon');
const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const app = require('../../../app');
const performanceConfig = require('./performanceTestConfig');

// Models
const User = require('../../models/userModel');
const Affiliate = require('../../models/affiliateModel');
const Wallet = require('../../models/walletModel');
const CommissionTransaction = require('../../models/commissionTransactionModel');

// Services
const CommissionService = require('../../services/commissionService');
const WalletService = require('../../services/walletService');
const QRCodeService = require('../../services/qrCodeService');

// Test utilities
const { createTestUserWithAuth } = require('../helpers/testHelper');

describe('Affiliate System Performance Tests', () => {
  let mongoServer;
  let server;
  let baseUrl;
  let testUsers = [];
  let testAffiliates = [];

  beforeAll(async () => {
    // Start MongoDB Memory Server
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    await mongoose.connect(mongoUri);

    // Start test server
    server = app.listen(0);
    const port = server.address().port;
    baseUrl = `http://localhost:${port}`;

    // Create test data
    await setupTestData();
  });

  afterAll(async () => {
    if (server) {
      server.close();
    }
    await mongoose.connection.dropDatabase();
    await mongoose.connection.close();
    await mongoServer.stop();
  });

  async function setupTestData() {
    // Create test users and affiliates
    for (let i = 0; i < 10; i++) {
      const userAuth = createTestUserWithAuth({
        email: `affiliate${i}@test.com`,
        firstName: `Affiliate${i}`,
        lastName: 'User'
      });

      const user = await User.create(userAuth.user);
      
      const affiliate = await Affiliate.create({
        userId: user._id,
        businessName: `Business ${i}`,
        businessEmail: `business${i}@test.com`,
        businessPhone: `+23481234567${i}`,
        businessAddress: {
          street: `${i} Business Street`,
          city: 'Lagos',
          state: 'Lagos',
          country: 'Nigeria',
          postalCode: '100001'
        },
        affiliateId: `AFF-${String(i).padStart(6, '0')}`,
        referralCode: `REF-${String(i).padStart(6, '0')}`,
        status: 'active',
        commissionRates: {
          flights: 2.5,
          hotels: 3.0,
          insurance: 5.0,
          visa: 4.0
        }
      });

      await Wallet.create({
        affiliateId: affiliate._id,
        balance: Math.floor(Math.random() * 100000) + 50000,
        totalEarned: Math.floor(Math.random() * 500000) + 100000,
        totalWithdrawn: Math.floor(Math.random() * 200000),
        currency: 'NGN',
        status: 'active',
        bankDetails: {
          accountName: `Business ${i}`,
          accountNumber: `012345678${i}`,
          bankCode: '044',
          bankName: 'Access Bank'
        }
      });

      testUsers.push({ user, affiliate, token: userAuth.accessToken });
      testAffiliates.push(affiliate);
    }
  }

  describe('Commission Processing Performance', () => {
    test('Bulk commission calculation performance', async () => {
      const startTime = process.hrtime.bigint();
      const commissionPromises = [];

      // Create 1000 commission calculations
      for (let i = 0; i < 1000; i++) {
        const bookingData = {
          bookingReference: `BOOK-${Date.now()}-${i}`,
          serviceType: ['flights', 'hotels', 'insurance', 'visa'][i % 4],
          bookingAmount: Math.floor(Math.random() * 200000) + 50000,
          affiliateId: testAffiliates[i % testAffiliates.length]._id
        };

        commissionPromises.push(
          CommissionService.calculateCommission(bookingData, bookingData.affiliateId)
        );
      }

      const results = await Promise.all(commissionPromises);
      const endTime = process.hrtime.bigint();
      const executionTime = Number(endTime - startTime) / 1000000; // Convert to milliseconds

      expect(results).toHaveLength(1000);
      expect(executionTime).toBeLessThan(5000); // Should complete within 5 seconds
      expect(results.every(result => result.commissionAmount > 0)).toBe(true);

      console.log(`✅ Bulk commission calculation: ${executionTime.toFixed(2)}ms for 1000 calculations`);
      console.log(`📊 Average per calculation: ${(executionTime / 1000).toFixed(2)}ms`);
    });

    test('Concurrent commission processing performance', async () => {
      const startTime = process.hrtime.bigint();
      const batchSize = 100;
      const numberOfBatches = 5;
      const results = [];

      for (let batch = 0; batch < numberOfBatches; batch++) {
        const batchPromises = [];
        
        for (let i = 0; i < batchSize; i++) {
          const bookingData = {
            bookingReference: `BATCH-${batch}-${i}`,
            serviceType: ['flights', 'hotels', 'insurance', 'visa'][i % 4],
            bookingAmount: Math.floor(Math.random() * 150000) + 30000,
            affiliateId: testAffiliates[i % testAffiliates.length]._id
          };

          batchPromises.push(
            CommissionService.processCommission(bookingData.bookingReference, bookingData.affiliateId)
          );
        }

        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);
      }

      const endTime = process.hrtime.bigint();
      const executionTime = Number(endTime - startTime) / 1000000;

      expect(results).toHaveLength(batchSize * numberOfBatches);
      expect(executionTime).toBeLessThan(10000); // Should complete within 10 seconds

      console.log(`✅ Concurrent commission processing: ${executionTime.toFixed(2)}ms for ${results.length} commissions`);
      console.log(`📊 Throughput: ${(results.length / (executionTime / 1000)).toFixed(2)} commissions/second`);
    });

    test('Commission calculation memory usage', async () => {
      const initialMemory = process.memoryUsage();
      const commissions = [];

      // Process large number of commissions
      for (let i = 0; i < 5000; i++) {
        const bookingData = {
          bookingReference: `MEM-TEST-${i}`,
          serviceType: 'flights',
          bookingAmount: 100000,
          affiliateId: testAffiliates[0]._id
        };

        const commission = await CommissionService.calculateCommission(bookingData, bookingData.affiliateId);
        commissions.push(commission);

        // Force garbage collection every 1000 iterations
        if (i % 1000 === 0 && global.gc) {
          global.gc();
        }
      }

      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      const memoryIncreasePerCommission = memoryIncrease / commissions.length;

      expect(memoryIncreasePerCommission).toBeLessThan(1024); // Less than 1KB per commission
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024); // Less than 50MB total increase

      console.log(`✅ Memory usage: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB for ${commissions.length} commissions`);
      console.log(`📊 Per commission: ${memoryIncreasePerCommission.toFixed(2)} bytes`);
    });
  });

  describe('Wallet Operations Performance', () => {
    test('Concurrent wallet operations performance', async () => {
      const startTime = process.hrtime.bigint();
      const operations = [];
      const numberOfOperations = 500;

      // Mix of credit and debit operations
      for (let i = 0; i < numberOfOperations; i++) {
        const affiliate = testAffiliates[i % testAffiliates.length];
        const amount = Math.floor(Math.random() * 10000) + 1000;
        const transactionRef = `PERF-TEST-${Date.now()}-${i}`;

        if (i % 2 === 0) {
          // Credit operation
          operations.push(
            WalletService.creditWallet(affiliate._id, amount, transactionRef)
          );
        } else {
          // Debit operation (smaller amount to avoid insufficient balance)
          operations.push(
            WalletService.debitWallet(affiliate._id, Math.min(amount, 5000), transactionRef)
          );
        }
      }

      const results = await Promise.allSettled(operations);
      const endTime = process.hrtime.bigint();
      const executionTime = Number(endTime - startTime) / 1000000;

      const successful = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;

      expect(successful).toBeGreaterThan(numberOfOperations * 0.8); // At least 80% success rate
      expect(executionTime).toBeLessThan(15000); // Should complete within 15 seconds

      console.log(`✅ Wallet operations: ${executionTime.toFixed(2)}ms for ${numberOfOperations} operations`);
      console.log(`📊 Success rate: ${((successful / numberOfOperations) * 100).toFixed(1)}%`);
      console.log(`📊 Throughput: ${(numberOfOperations / (executionTime / 1000)).toFixed(2)} operations/second`);
    });

    test('Wallet balance inquiry performance', async () => {
      const startTime = process.hrtime.bigint();
      const balancePromises = [];

      // Query balance for all test affiliates 100 times each
      for (let i = 0; i < 100; i++) {
        testAffiliates.forEach(affiliate => {
          balancePromises.push(WalletService.getBalance(affiliate._id));
        });
      }

      const balances = await Promise.all(balancePromises);
      const endTime = process.hrtime.bigint();
      const executionTime = Number(endTime - startTime) / 1000000;

      expect(balances).toHaveLength(testAffiliates.length * 100);
      expect(balances.every(balance => typeof balance === 'number')).toBe(true);
      expect(executionTime).toBeLessThan(3000); // Should complete within 3 seconds

      console.log(`✅ Balance inquiries: ${executionTime.toFixed(2)}ms for ${balances.length} queries`);
      console.log(`📊 Average per query: ${(executionTime / balances.length).toFixed(2)}ms`);
    });

    test('Transaction history retrieval performance', async () => {
      const startTime = process.hrtime.bigint();
      const historyPromises = [];

      // Get transaction history for all affiliates
      testAffiliates.forEach(affiliate => {
        historyPromises.push(
          WalletService.getTransactionHistory(affiliate._id, { 
            page: 1, 
            limit: 50 
          })
        );
      });

      const histories = await Promise.all(historyPromises);
      const endTime = process.hrtime.bigint();
      const executionTime = Number(endTime - startTime) / 1000000;

      expect(histories).toHaveLength(testAffiliates.length);
      expect(executionTime).toBeLessThan(2000); // Should complete within 2 seconds

      console.log(`✅ Transaction history: ${executionTime.toFixed(2)}ms for ${histories.length} queries`);
      console.log(`📊 Average per query: ${(executionTime / histories.length).toFixed(2)}ms`);
    });
  });

  describe('QR Code Generation Performance', () => {
    test('Bulk QR code generation performance', async () => {
      const startTime = process.hrtime.bigint();
      const qrPromises = [];
      const numberOfQRCodes = 1000;

      // Generate different types of QR codes
      for (let i = 0; i < numberOfQRCodes; i++) {
        const qrType = ['affiliate', 'commission', 'withdrawal', 'referral'][i % 4];
        const affiliate = testAffiliates[i % testAffiliates.length];

        let qrData;
        switch (qrType) {
          case 'affiliate':
            qrData = {
              type: 'affiliate',
              affiliateId: affiliate._id,
              referralCode: affiliate.referralCode
            };
            break;
          case 'commission':
            qrData = {
              type: 'commission',
              affiliateId: affiliate._id,
              amount: Math.floor(Math.random() * 10000) + 1000,
              transactionId: `TXN-${i}`
            };
            break;
          case 'withdrawal':
            qrData = {
              type: 'withdrawal',
              affiliateId: affiliate._id,
              amount: Math.floor(Math.random() * 50000) + 10000,
              withdrawalId: `WTH-${i}`
            };
            break;
          case 'referral':
            qrData = {
              type: 'referral',
              affiliateId: affiliate._id,
              referralCode: affiliate.referralCode,
              customerId: `CUST-${i}`
            };
            break;
        }

        qrPromises.push(QRCodeService.generateQRCode(qrData));
      }

      const qrCodes = await Promise.all(qrPromises);
      const endTime = process.hrtime.bigint();
      const executionTime = Number(endTime - startTime) / 1000000;

      expect(qrCodes).toHaveLength(numberOfQRCodes);
      expect(qrCodes.every(qr => qr.data && qr.url)).toBe(true);
      expect(executionTime).toBeLessThan(10000); // Should complete within 10 seconds

      console.log(`✅ QR code generation: ${executionTime.toFixed(2)}ms for ${numberOfQRCodes} QR codes`);
      console.log(`📊 Average per QR code: ${(executionTime / numberOfQRCodes).toFixed(2)}ms`);
      console.log(`📊 Throughput: ${(numberOfQRCodes / (executionTime / 1000)).toFixed(2)} QR codes/second`);
    });

    test('QR code validation performance', async () => {
      // First generate some QR codes to validate
      const qrCodes = [];
      for (let i = 0; i < 100; i++) {
        const affiliate = testAffiliates[i % testAffiliates.length];
        const qrData = {
          type: 'affiliate',
          affiliateId: affiliate._id,
          referralCode: affiliate.referralCode
        };
        const qrCode = await QRCodeService.generateQRCode(qrData);
        qrCodes.push(qrCode);
      }

      const startTime = process.hrtime.bigint();
      const validationPromises = qrCodes.map(qr => 
        QRCodeService.validateQRCode(qr.metadata)
      );

      const validationResults = await Promise.all(validationPromises);
      const endTime = process.hrtime.bigint();
      const executionTime = Number(endTime - startTime) / 1000000;

      expect(validationResults).toHaveLength(qrCodes.length);
      expect(validationResults.every(result => result.valid === true)).toBe(true);
      expect(executionTime).toBeLessThan(1000); // Should complete within 1 second

      console.log(`✅ QR code validation: ${executionTime.toFixed(2)}ms for ${validationResults.length} validations`);
      console.log(`📊 Average per validation: ${(executionTime / validationResults.length).toFixed(2)}ms`);
    });
  });

  describe('API Endpoint Load Testing', () => {
    test('Affiliate dashboard endpoint load test', async () => {
      const testUser = testUsers[0];
      
      const result = await autocannon({
        url: `${baseUrl}/api/v1/affiliates/dashboard`,
        connections: 20,
        duration: 10,
        headers: {
          'Authorization': `Bearer ${testUser.token}`,
          'Content-Type': 'application/json'
        }
      });

      expect(result.errors).toBe(0);
      expect(result.timeouts).toBe(0);
      expect(result.non2xx).toBe(0);
      expect(result.latency.average).toBeLessThan(500); // Average response time under 500ms
      expect(result.requests.average).toBeGreaterThan(10); // At least 10 requests per second

      console.log(`✅ Dashboard endpoint load test:`);
      console.log(`📊 Average latency: ${result.latency.average}ms`);
      console.log(`📊 Requests per second: ${result.requests.average}`);
      console.log(`📊 Total requests: ${result.requests.total}`);
    });

    test('Commission calculation endpoint stress test', async () => {
      const testUser = testUsers[0];
      
      const result = await autocannon({
        url: `${baseUrl}/api/v1/affiliates/commissions/calculate`,
        method: 'POST',
        connections: 15,
        duration: 15,
        headers: {
          'Authorization': `Bearer ${testUser.token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          bookingReference: 'LOAD-TEST-BOOKING',
          serviceType: 'flights',
          bookingAmount: 100000
        })
      });

      expect(result.errors).toBe(0);
      expect(result.timeouts).toBe(0);
      expect(result.latency.average).toBeLessThan(1000); // Average response time under 1 second
      expect(result.requests.average).toBeGreaterThan(5); // At least 5 requests per second

      console.log(`✅ Commission calculation stress test:`);
      console.log(`📊 Average latency: ${result.latency.average}ms`);
      console.log(`📊 Requests per second: ${result.requests.average}`);
      console.log(`📊 Error rate: ${((result.non2xx / result.requests.total) * 100).toFixed(2)}%`);
    });

    test('Wallet operations endpoint performance', async () => {
      const testUser = testUsers[0];
      
      const result = await autocannon({
        url: `${baseUrl}/api/v1/affiliates/wallet/balance`,
        connections: 25,
        duration: 10,
        headers: {
          'Authorization': `Bearer ${testUser.token}`,
          'Content-Type': 'application/json'
        }
      });

      expect(result.errors).toBe(0);
      expect(result.timeouts).toBe(0);
      expect(result.non2xx).toBe(0);
      expect(result.latency.average).toBeLessThan(200); // Average response time under 200ms
      expect(result.requests.average).toBeGreaterThan(20); // At least 20 requests per second

      console.log(`✅ Wallet balance endpoint performance:`);
      console.log(`📊 Average latency: ${result.latency.average}ms`);
      console.log(`📊 Requests per second: ${result.requests.average}`);
      console.log(`📊 95th percentile: ${result.latency.p95}ms`);
    });
  });

  describe('Database Performance', () => {
    test('Commission query performance with large dataset', async () => {
      // Create a large number of commission records
      const commissions = [];
      for (let i = 0; i < 10000; i++) {
        commissions.push({
          affiliateId: testAffiliates[i % testAffiliates.length]._id,
          bookingReference: `PERF-${i}`,
          serviceType: ['flights', 'hotels', 'insurance', 'visa'][i % 4],
          bookingAmount: Math.floor(Math.random() * 200000) + 50000,
          commissionRate: 2.5,
          commissionAmount: Math.floor(Math.random() * 5000) + 1000,
          status: 'approved',
          createdAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000)
        });
      }

      await CommissionTransaction.insertMany(commissions);

      // Test query performance
      const startTime = process.hrtime.bigint();
      
      const queries = await Promise.all([
        // Query by affiliate
        CommissionTransaction.find({ 
          affiliateId: testAffiliates[0]._id 
        }).limit(100),
        
        // Query by date range
        CommissionTransaction.find({
          createdAt: {
            $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
            $lte: new Date()
          }
        }).limit(100),
        
        // Aggregation query
        CommissionTransaction.aggregate([
          { $match: { status: 'approved' } },
          { $group: { 
            _id: '$affiliateId', 
            totalCommissions: { $sum: '$commissionAmount' },
            count: { $sum: 1 }
          }},
          { $limit: 10 }
        ])
      ]);

      const endTime = process.hrtime.bigint();
      const executionTime = Number(endTime - startTime) / 1000000;

      expect(queries[0].length).toBeGreaterThan(0);
      expect(queries[1].length).toBeGreaterThan(0);
      expect(queries[2].length).toBeGreaterThan(0);
      expect(executionTime).toBeLessThan(1000); // Should complete within 1 second

      console.log(`✅ Database query performance: ${executionTime.toFixed(2)}ms for complex queries`);
      console.log(`📊 Records processed: ${commissions.length}`);
    });
  });
});