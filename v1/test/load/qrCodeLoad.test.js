// v1/test/load/qrCodeLoad.test.js
// Load tests for QR code generation and referral tracking

const autocannon = require('autocannon');
const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const app = require('../../../app');

// Models
const User = require('../../models/userModel');
const Affiliate = require('../../models/affiliateModel');
const Referral = require('../../models/referralModel');

// Services
const QRCodeService = require('../../services/qrCodeService');
const ReferralTrackingService = require('../../services/referralTrackingService');

// Test utilities
const { createTestUserWithAuth } = require('../helpers/testHelper');

describe('QR Code and Referral Tracking Load Tests', () => {
  let mongoServer;
  let server;
  let baseUrl;
  let testAffiliates = [];
  let testUsers = [];

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
    // Create test affiliates and users
    for (let i = 0; i < 20; i++) {
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
        businessPhone: `+23481234567${String(i).padStart(2, '0')}`,
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

      testUsers.push({ user, token: userAuth.accessToken });
      testAffiliates.push(affiliate);
    }
  }

  describe('QR Code Generation Load Tests', () => {
    test('High-volume QR code generation performance', async () => {
      const startTime = process.hrtime.bigint();
      const qrPromises = [];
      const numberOfQRCodes = 5000;

      console.log(`🚀 Starting generation of ${numberOfQRCodes} QR codes...`);

      // Generate QR codes in batches to avoid memory issues
      const batchSize = 100;
      const batches = Math.ceil(numberOfQRCodes / batchSize);

      for (let batch = 0; batch < batches; batch++) {
        const batchPromises = [];
        const batchStart = batch * batchSize;
        const batchEnd = Math.min(batchStart + batchSize, numberOfQRCodes);

        for (let i = batchStart; i < batchEnd; i++) {
          const affiliate = testAffiliates[i % testAffiliates.length];
          const qrType = ['affiliate', 'commission', 'withdrawal', 'referral'][i % 4];

          let qrData;
          switch (qrType) {
            case 'affiliate':
              qrData = {
                type: 'affiliate',
                affiliateId: affiliate._id,
                referralCode: affiliate.referralCode,
                timestamp: new Date(),
                metadata: {
                  businessName: affiliate.businessName,
                  affiliateId: affiliate.affiliateId
                }
              };
              break;
            case 'commission':
              qrData = {
                type: 'commission',
                affiliateId: affiliate._id,
                amount: Math.floor(Math.random() * 10000) + 1000,
                transactionId: `TXN-${i}`,
                timestamp: new Date(),
                metadata: {
                  serviceType: 'flights',
                  bookingReference: `BOOK-${i}`
                }
              };
              break;
            case 'withdrawal':
              qrData = {
                type: 'withdrawal',
                affiliateId: affiliate._id,
                amount: Math.floor(Math.random() * 50000) + 10000,
                withdrawalId: `WTH-${i}`,
                timestamp: new Date(),
                metadata: {
                  bankName: 'Access Bank',
                  accountNumber: '****6789'
                }
              };
              break;
            case 'referral':
              qrData = {
                type: 'referral',
                affiliateId: affiliate._id,
                referralCode: affiliate.referralCode,
                customerId: `CUST-${i}`,
                timestamp: new Date(),
                metadata: {
                  source: 'mobile_app',
                  campaign: 'load_test'
                }
              };
              break;
          }

          batchPromises.push(QRCodeService.generateQRCode(qrData));
        }

        const batchResults = await Promise.all(batchPromises);
        qrPromises.push(...batchResults);

        // Log progress
        if (batch % 10 === 0) {
          console.log(`📊 Completed batch ${batch + 1}/${batches} (${batchEnd}/${numberOfQRCodes} QR codes)`);
        }
      }

      const endTime = process.hrtime.bigint();
      const executionTime = Number(endTime - startTime) / 1000000; // Convert to milliseconds

      expect(qrPromises).toHaveLength(numberOfQRCodes);
      expect(qrPromises.every(qr => qr && qr.data && qr.url)).toBe(true);
      expect(executionTime).toBeLessThan(60000); // Should complete within 60 seconds

      const throughput = numberOfQRCodes / (executionTime / 1000);
      const avgTimePerQR = executionTime / numberOfQRCodes;

      console.log(`✅ QR Code Generation Load Test Results:`);
      console.log(`📊 Total QR codes: ${numberOfQRCodes}`);
      console.log(`⏱️ Total time: ${(executionTime / 1000).toFixed(2)}s`);
      console.log(`🚀 Throughput: ${throughput.toFixed(2)} QR codes/second`);
      console.log(`📈 Average per QR code: ${avgTimePerQR.toFixed(2)}ms`);

      // Performance assertions
      expect(throughput).toBeGreaterThan(50); // At least 50 QR codes per second
      expect(avgTimePerQR).toBeLessThan(100); // Less than 100ms per QR code
    });

    test('Concurrent QR code generation stress test', async () => {
      const concurrentBatches = 10;
      const qrCodesPerBatch = 200;
      const totalQRCodes = concurrentBatches * qrCodesPerBatch;

      console.log(`🚀 Starting concurrent generation of ${totalQRCodes} QR codes in ${concurrentBatches} batches...`);

      const startTime = process.hrtime.bigint();
      const batchPromises = [];

      for (let batch = 0; batch < concurrentBatches; batch++) {
        const batchPromise = (async () => {
          const qrPromises = [];
          
          for (let i = 0; i < qrCodesPerBatch; i++) {
            const affiliate = testAffiliates[(batch * qrCodesPerBatch + i) % testAffiliates.length];
            const qrData = {
              type: 'affiliate',
              affiliateId: affiliate._id,
              referralCode: affiliate.referralCode,
              timestamp: new Date(),
              batchId: batch,
              itemId: i
            };

            qrPromises.push(QRCodeService.generateQRCode(qrData));
          }

          return Promise.all(qrPromises);
        })();

        batchPromises.push(batchPromise);
      }

      const batchResults = await Promise.all(batchPromises);
      const endTime = process.hrtime.bigint();
      const executionTime = Number(endTime - startTime) / 1000000;

      const allQRCodes = batchResults.flat();
      expect(allQRCodes).toHaveLength(totalQRCodes);
      expect(allQRCodes.every(qr => qr && qr.data && qr.url)).toBe(true);

      const throughput = totalQRCodes / (executionTime / 1000);

      console.log(`✅ Concurrent QR Code Generation Results:`);
      console.log(`📊 Total QR codes: ${totalQRCodes}`);
      console.log(`🔄 Concurrent batches: ${concurrentBatches}`);
      console.log(`⏱️ Total time: ${(executionTime / 1000).toFixed(2)}s`);
      console.log(`🚀 Throughput: ${throughput.toFixed(2)} QR codes/second`);

      expect(throughput).toBeGreaterThan(100); // At least 100 QR codes per second under concurrent load
    });

    test('QR code validation performance under load', async () => {
      // First generate QR codes to validate
      const qrCodes = [];
      const numberOfQRs = 1000;

      console.log(`🔧 Generating ${numberOfQRs} QR codes for validation test...`);

      for (let i = 0; i < numberOfQRs; i++) {
        const affiliate = testAffiliates[i % testAffiliates.length];
        const qrData = {
          type: 'affiliate',
          affiliateId: affiliate._id,
          referralCode: affiliate.referralCode,
          timestamp: new Date(),
          validationTestId: i
        };

        const qrCode = await QRCodeService.generateQRCode(qrData);
        qrCodes.push(qrCode);
      }

      console.log(`🚀 Starting validation of ${numberOfQRs} QR codes...`);

      const startTime = process.hrtime.bigint();
      const validationPromises = qrCodes.map(qr => 
        QRCodeService.validateQRCode(qr.metadata)
      );

      const validationResults = await Promise.all(validationPromises);
      const endTime = process.hrtime.bigint();
      const executionTime = Number(endTime - startTime) / 1000000;

      expect(validationResults).toHaveLength(numberOfQRs);
      expect(validationResults.every(result => result.valid === true)).toBe(true);

      const throughput = numberOfQRs / (executionTime / 1000);
      const avgTimePerValidation = executionTime / numberOfQRs;

      console.log(`✅ QR Code Validation Performance Results:`);
      console.log(`📊 Total validations: ${numberOfQRs}`);
      console.log(`⏱️ Total time: ${(executionTime / 1000).toFixed(2)}s`);
      console.log(`🚀 Throughput: ${throughput.toFixed(2)} validations/second`);
      console.log(`📈 Average per validation: ${avgTimePerValidation.toFixed(2)}ms`);

      expect(throughput).toBeGreaterThan(500); // At least 500 validations per second
      expect(avgTimePerValidation).toBeLessThan(10); // Less than 10ms per validation
    });
  });

  describe('Referral Tracking Load Tests', () => {
    test('High-volume referral tracking performance', async () => {
      const numberOfReferrals = 2000;
      const startTime = process.hrtime.bigint();

      console.log(`🚀 Starting tracking of ${numberOfReferrals} referrals...`);

      const referralPromises = [];

      for (let i = 0; i < numberOfReferrals; i++) {
        const affiliate = testAffiliates[i % testAffiliates.length];
        const customerData = {
          customerId: `CUST-${i}`,
          email: `customer${i}@example.com`,
          firstName: `Customer${i}`,
          lastName: 'Test',
          phoneNumber: `+23481234567${String(i).padStart(2, '0')}`
        };

        const requestData = {
          ipAddress: `192.168.1.${(i % 254) + 1}`,
          userAgent: 'Mozilla/5.0 (Test Browser)',
          source: 'load_test',
          timestamp: new Date()
        };

        referralPromises.push(
          ReferralTrackingService.trackReferral(
            affiliate.referralCode,
            customerData,
            requestData
          )
        );
      }

      const referralResults = await Promise.all(referralPromises);
      const endTime = process.hrtime.bigint();
      const executionTime = Number(endTime - startTime) / 1000000;

      expect(referralResults).toHaveLength(numberOfReferrals);
      expect(referralResults.every(result => result.success === true)).toBe(true);

      const throughput = numberOfReferrals / (executionTime / 1000);
      const avgTimePerReferral = executionTime / numberOfReferrals;

      console.log(`✅ Referral Tracking Performance Results:`);
      console.log(`📊 Total referrals tracked: ${numberOfReferrals}`);
      console.log(`⏱️ Total time: ${(executionTime / 1000).toFixed(2)}s`);
      console.log(`🚀 Throughput: ${throughput.toFixed(2)} referrals/second`);
      console.log(`📈 Average per referral: ${avgTimePerReferral.toFixed(2)}ms`);

      expect(throughput).toBeGreaterThan(100); // At least 100 referrals per second
      expect(avgTimePerReferral).toBeLessThan(50); // Less than 50ms per referral
    });

    test('Concurrent referral attribution performance', async () => {
      const concurrentUsers = 50;
      const bookingsPerUser = 20;
      const totalBookings = concurrentUsers * bookingsPerUser;

      console.log(`🚀 Starting concurrent attribution of ${totalBookings} bookings...`);

      const startTime = process.hrtime.bigint();
      const userPromises = [];

      for (let user = 0; user < concurrentUsers; user++) {
        const userPromise = (async () => {
          const bookingPromises = [];
          
          for (let booking = 0; booking < bookingsPerUser; booking++) {
            const affiliate = testAffiliates[user % testAffiliates.length];
            const customerId = `CONCURRENT-CUST-${user}-${booking}`;
            
            const bookingData = {
              bookingReference: `BOOK-${user}-${booking}`,
              serviceType: ['flights', 'hotels', 'insurance', 'visa'][booking % 4],
              amount: Math.floor(Math.random() * 200000) + 50000,
              customerId: customerId,
              timestamp: new Date()
            };

            bookingPromises.push(
              ReferralTrackingService.attributeBooking(bookingData, customerId)
            );
          }

          return Promise.all(bookingPromises);
        })();

        userPromises.push(userPromise);
      }

      const userResults = await Promise.all(userPromises);
      const endTime = process.hrtime.bigint();
      const executionTime = Number(endTime - startTime) / 1000000;

      const allAttributions = userResults.flat();
      expect(allAttributions).toHaveLength(totalBookings);

      const throughput = totalBookings / (executionTime / 1000);

      console.log(`✅ Concurrent Attribution Performance Results:`);
      console.log(`📊 Total attributions: ${totalBookings}`);
      console.log(`👥 Concurrent users: ${concurrentUsers}`);
      console.log(`⏱️ Total time: ${(executionTime / 1000).toFixed(2)}s`);
      console.log(`🚀 Throughput: ${throughput.toFixed(2)} attributions/second`);

      expect(throughput).toBeGreaterThan(50); // At least 50 attributions per second
    });

    test('Referral statistics aggregation performance', async () => {
      // First create referral data
      const referrals = [];
      const numberOfReferrals = 5000;

      console.log(`🔧 Creating ${numberOfReferrals} referral records for aggregation test...`);

      for (let i = 0; i < numberOfReferrals; i++) {
        const affiliate = testAffiliates[i % testAffiliates.length];
        
        referrals.push({
          affiliateId: affiliate._id,
          customerId: `AGG-CUST-${i}`,
          referralCode: affiliate.referralCode,
          referralSource: ['qr_code', 'link', 'manual'][i % 3],
          ipAddress: `192.168.1.${(i % 254) + 1}`,
          userAgent: 'Mozilla/5.0 (Test Browser)',
          firstBookingAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000),
          totalBookings: Math.floor(Math.random() * 10) + 1,
          totalValue: Math.floor(Math.random() * 500000) + 50000,
          status: 'converted',
          createdAt: new Date(Date.now() - Math.random() * 60 * 24 * 60 * 60 * 1000)
        });
      }

      await Referral.insertMany(referrals);

      console.log(`🚀 Starting aggregation of ${numberOfReferrals} referral statistics...`);

      const startTime = process.hrtime.bigint();
      const aggregationPromises = [];

      // Test different types of aggregations
      testAffiliates.forEach(affiliate => {
        const dateRange = {
          startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          endDate: new Date()
        };

        aggregationPromises.push(
          ReferralTrackingService.getReferralStats(affiliate._id, dateRange)
        );
      });

      const aggregationResults = await Promise.all(aggregationPromises);
      const endTime = process.hrtime.bigint();
      const executionTime = Number(endTime - startTime) / 1000000;

      expect(aggregationResults).toHaveLength(testAffiliates.length);
      expect(aggregationResults.every(result => result && typeof result.totalReferrals === 'number')).toBe(true);

      const throughput = testAffiliates.length / (executionTime / 1000);

      console.log(`✅ Referral Statistics Aggregation Results:`);
      console.log(`📊 Affiliates processed: ${testAffiliates.length}`);
      console.log(`📈 Referral records: ${numberOfReferrals}`);
      console.log(`⏱️ Total time: ${(executionTime / 1000).toFixed(2)}s`);
      console.log(`🚀 Throughput: ${throughput.toFixed(2)} aggregations/second`);

      expect(executionTime).toBeLessThan(5000); // Should complete within 5 seconds
      expect(throughput).toBeGreaterThan(2); // At least 2 aggregations per second
    });
  });

  describe('API Endpoint Load Tests', () => {
    test('QR code generation endpoint load test', async () => {
      const testUser = testUsers[0];
      
      console.log(`🚀 Starting QR code generation endpoint load test...`);

      const result = await autocannon({
        url: `${baseUrl}/api/v1/qr-codes/generate`,
        method: 'POST',
        connections: 20,
        duration: 15,
        headers: {
          'Authorization': `Bearer ${testUser.token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          type: 'affiliate',
          affiliateId: testAffiliates[0]._id,
          referralCode: testAffiliates[0].referralCode
        })
      });

      expect(result.errors).toBe(0);
      expect(result.timeouts).toBe(0);
      expect(result.latency.average).toBeLessThan(1000); // Average response time under 1 second
      expect(result.requests.average).toBeGreaterThan(5); // At least 5 requests per second

      console.log(`✅ QR Code Generation Endpoint Load Test Results:`);
      console.log(`📊 Total requests: ${result.requests.total}`);
      console.log(`⏱️ Average latency: ${result.latency.average}ms`);
      console.log(`🚀 Requests per second: ${result.requests.average}`);
      console.log(`📈 95th percentile: ${result.latency.p95}ms`);
      console.log(`❌ Errors: ${result.errors}`);
      console.log(`⏰ Timeouts: ${result.timeouts}`);
    });

    test('Referral validation endpoint stress test', async () => {
      console.log(`🚀 Starting referral validation endpoint stress test...`);

      const result = await autocannon({
        url: `${baseUrl}/api/v1/referrals/validate`,
        method: 'POST',
        connections: 30,
        duration: 20,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          referralCode: testAffiliates[0].referralCode
        })
      });

      expect(result.errors).toBe(0);
      expect(result.timeouts).toBe(0);
      expect(result.latency.average).toBeLessThan(500); // Average response time under 500ms
      expect(result.requests.average).toBeGreaterThan(10); // At least 10 requests per second

      console.log(`✅ Referral Validation Endpoint Stress Test Results:`);
      console.log(`📊 Total requests: ${result.requests.total}`);
      console.log(`⏱️ Average latency: ${result.latency.average}ms`);
      console.log(`🚀 Requests per second: ${result.requests.average}`);
      console.log(`📈 99th percentile: ${result.latency.p99}ms`);
      console.log(`❌ Error rate: ${((result.non2xx / result.requests.total) * 100).toFixed(2)}%`);
    });

    test('Mixed QR code and referral operations load test', async () => {
      const testUser = testUsers[0];
      
      console.log(`🚀 Starting mixed operations load test...`);

      // Test multiple endpoints simultaneously
      const endpoints = [
        {
          url: `${baseUrl}/api/v1/qr-codes/generate`,
          method: 'POST',
          body: JSON.stringify({
            type: 'affiliate',
            affiliateId: testAffiliates[0]._id,
            referralCode: testAffiliates[0].referralCode
          })
        },
        {
          url: `${baseUrl}/api/v1/referrals/validate`,
          method: 'POST',
          body: JSON.stringify({
            referralCode: testAffiliates[0].referralCode
          })
        },
        {
          url: `${baseUrl}/api/v1/qr-codes/validate`,
          method: 'POST',
          body: JSON.stringify({
            qrData: {
              type: 'affiliate',
              affiliateId: testAffiliates[0]._id
            }
          })
        }
      ];

      const results = await Promise.all(
        endpoints.map(endpoint => 
          autocannon({
            url: endpoint.url,
            method: endpoint.method,
            connections: 15,
            duration: 10,
            headers: {
              'Authorization': `Bearer ${testUser.token}`,
              'Content-Type': 'application/json'
            },
            body: endpoint.body
          })
        )
      );

      results.forEach((result, index) => {
        expect(result.errors).toBe(0);
        expect(result.timeouts).toBe(0);
        expect(result.latency.average).toBeLessThan(1500);
        
        console.log(`✅ Endpoint ${index + 1} Results:`);
        console.log(`📊 Requests: ${result.requests.total}`);
        console.log(`⏱️ Avg latency: ${result.latency.average}ms`);
        console.log(`🚀 RPS: ${result.requests.average}`);
      });

      const totalRequests = results.reduce((sum, result) => sum + result.requests.total, 0);
      const avgLatency = results.reduce((sum, result) => sum + result.latency.average, 0) / results.length;

      console.log(`✅ Mixed Operations Load Test Summary:`);
      console.log(`📊 Total requests across all endpoints: ${totalRequests}`);
      console.log(`⏱️ Average latency across endpoints: ${avgLatency.toFixed(2)}ms`);
    });
  });
});