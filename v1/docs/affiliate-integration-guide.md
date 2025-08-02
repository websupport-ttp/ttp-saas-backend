# Affiliate Marketing System Integration Guide

## Overview

The Travel Place Affiliate Marketing System allows businesses to earn commissions from customer referrals. This guide provides comprehensive examples and integration patterns for developers.

## Table of Contents

1. [Authentication](#authentication)
2. [Affiliate Registration Flow](#affiliate-registration-flow)
3. [Referral Code Integration](#referral-code-integration)
4. [Commission Tracking](#commission-tracking)
5. [Wallet Management](#wallet-management)
6. [QR Code Integration](#qr-code-integration)
7. [Error Handling](#error-handling)
8. [Rate Limiting](#rate-limiting)
9. [Webhooks](#webhooks)
10. [Testing](#testing)

## Authentication

All affiliate endpoints require JWT authentication. Include the token in the Authorization header:

```javascript
const headers = {
  'Authorization': `Bearer ${accessToken}`,
  'Content-Type': 'application/json'
};
```

## Affiliate Registration Flow

### Step 1: Register as Affiliate

```javascript
const registerAffiliate = async (businessData) => {
  try {
    const response = await fetch('/api/v1/affiliates/register', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        businessName: "Travel Partners Ltd",
        businessEmail: "partners@travelpartners.com",
        businessPhone: "+2348012345678",
        businessAddress: {
          street: "123 Business Street",
          city: "Lagos",
          state: "Lagos State",
          country: "Nigeria",
          postalCode: "100001"
        }
      })
    });

    const result = await response.json();
    
    if (result.success) {
      console.log('Registration submitted:', result.data);
      // Status will be 'pending' until admin approval
      return result.data;
    } else {
      throw new Error(result.message);
    }
  } catch (error) {
    console.error('Registration failed:', error.message);
    throw error;
  }
};
```

### Step 2: Check Registration Status

```javascript
const checkAffiliateStatus = async () => {
  try {
    const response = await fetch('/api/v1/affiliates/me', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });

    const result = await response.json();
    
    if (result.success) {
      const affiliate = result.data;
      console.log(`Status: ${affiliate.status}`);
      
      if (affiliate.status === 'active') {
        console.log(`Referral Code: ${affiliate.referralCode}`);
        console.log(`Affiliate ID: ${affiliate.affiliateId}`);
        return affiliate;
      }
    }
  } catch (error) {
    console.error('Status check failed:', error.message);
  }
};
```

## Referral Code Integration

### Validate Referral Code (Public Endpoint)

```javascript
const validateReferralCode = async (referralCode) => {
  try {
    const response = await fetch(`/api/v1/affiliates/validate-referral/${referralCode}`, {
      method: 'GET'
    });

    const result = await response.json();
    
    if (result.success && result.data.isValid) {
      console.log('Valid referral code:', result.data.affiliate);
      return result.data.affiliate;
    } else {
      console.log('Invalid referral code');
      return null;
    }
  } catch (error) {
    console.error('Validation failed:', error.message);
    return null;
  }
};
```

### Apply Referral Code During Booking

```javascript
const applyReferralToBooking = async (bookingData, referralCode) => {
  // First validate the referral code
  const affiliate = await validateReferralCode(referralCode);
  
  if (!affiliate) {
    throw new Error('Invalid referral code');
  }

  // Include referral code in booking request
  const bookingRequest = {
    ...bookingData,
    referralCode: referralCode,
    affiliateId: affiliate.affiliateId
  };

  try {
    const response = await fetch('/api/v1/products/flights/book', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(bookingRequest)
    });

    const result = await response.json();
    
    if (result.success) {
      console.log('Booking successful with referral:', result.data);
      // Commission will be automatically calculated and credited
      return result.data;
    }
  } catch (error) {
    console.error('Booking with referral failed:', error.message);
    throw error;
  }
};
```

## Commission Tracking

### Get Commission History

```javascript
const getCommissionHistory = async (affiliateId, filters = {}) => {
  const queryParams = new URLSearchParams({
    page: filters.page || 1,
    limit: filters.limit || 10,
    ...(filters.status && { status: filters.status }),
    ...(filters.serviceType && { serviceType: filters.serviceType }),
    ...(filters.startDate && { startDate: filters.startDate }),
    ...(filters.endDate && { endDate: filters.endDate })
  });

  try {
    const response = await fetch(
      `/api/v1/affiliates/${affiliateId}/dashboard/commissions?${queryParams}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      }
    );

    const result = await response.json();
    
    if (result.success) {
      console.log('Commission history:', result.data);
      return result.data;
    }
  } catch (error) {
    console.error('Failed to get commission history:', error.message);
    throw error;
  }
};
```

### Get Affiliate Statistics

```javascript
const getAffiliateStats = async (affiliateId, dateRange = {}) => {
  const queryParams = new URLSearchParams({
    ...(dateRange.startDate && { startDate: dateRange.startDate }),
    ...(dateRange.endDate && { endDate: dateRange.endDate })
  });

  try {
    const response = await fetch(
      `/api/v1/affiliates/${affiliateId}/stats?${queryParams}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      }
    );

    const result = await response.json();
    
    if (result.success) {
      const stats = result.data;
      console.log(`Total Referrals: ${stats.totalReferrals}`);
      console.log(`Total Commissions: ${stats.totalCommissions}`);
      console.log(`Conversion Rate: ${stats.conversionRate}%`);
      return stats;
    }
  } catch (error) {
    console.error('Failed to get affiliate stats:', error.message);
    throw error;
  }
};
```

## Wallet Management

### Get Wallet Balance

```javascript
const getWalletBalance = async (affiliateId) => {
  try {
    const response = await fetch(`/api/v1/wallets/${affiliateId}/balance`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });

    const result = await response.json();
    
    if (result.success) {
      const wallet = result.data;
      console.log(`Available Balance: ${wallet.balance} ${wallet.currency}`);
      console.log(`Total Earned: ${wallet.totalEarned} ${wallet.currency}`);
      console.log(`Total Withdrawn: ${wallet.totalWithdrawn} ${wallet.currency}`);
      return wallet;
    }
  } catch (error) {
    console.error('Failed to get wallet balance:', error.message);
    throw error;
  }
};
```

### Request Withdrawal

```javascript
const requestWithdrawal = async (affiliateId, withdrawalData) => {
  try {
    const response = await fetch(
      `/api/v1/affiliates/${affiliateId}/dashboard/withdrawals`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          amount: withdrawalData.amount,
          bankDetails: {
            accountName: withdrawalData.accountName,
            accountNumber: withdrawalData.accountNumber,
            bankCode: withdrawalData.bankCode,
            bankName: withdrawalData.bankName
          }
        })
      }
    );

    const result = await response.json();
    
    if (result.success) {
      console.log('Withdrawal requested:', result.data);
      // Status will be 'pending' initially
      return result.data;
    } else {
      throw new Error(result.message);
    }
  } catch (error) {
    console.error('Withdrawal request failed:', error.message);
    throw error;
  }
};
```

### Get Transaction History

```javascript
const getTransactionHistory = async (affiliateId, filters = {}) => {
  const queryParams = new URLSearchParams({
    page: filters.page || 1,
    limit: filters.limit || 10,
    ...(filters.type && { type: filters.type }),
    ...(filters.startDate && { startDate: filters.startDate }),
    ...(filters.endDate && { endDate: filters.endDate })
  });

  try {
    const response = await fetch(
      `/api/v1/wallets/${affiliateId}/transactions?${queryParams}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      }
    );

    const result = await response.json();
    
    if (result.success) {
      console.log('Transaction history:', result.data);
      return result.data;
    }
  } catch (error) {
    console.error('Failed to get transaction history:', error.message);
    throw error;
  }
};
```

## QR Code Integration

### Generate Referral Link with QR Code

```javascript
const generateReferralLink = async (affiliateId) => {
  try {
    const response = await fetch(
      `/api/v1/affiliates/${affiliateId}/referral-link`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      }
    );

    const result = await response.json();
    
    if (result.success) {
      const { referralLink, referralCode, qrCode } = result.data;
      
      console.log('Referral Link:', referralLink);
      console.log('Referral Code:', referralCode);
      
      // Display QR code in HTML
      const qrImage = document.createElement('img');
      qrImage.src = qrCode;
      qrImage.alt = 'Referral QR Code';
      document.body.appendChild(qrImage);
      
      return result.data;
    }
  } catch (error) {
    console.error('Failed to generate referral link:', error.message);
    throw error;
  }
};
```

### Get All QR Codes

```javascript
const getAffiliateQRCodes = async (affiliateId, type = null) => {
  const queryParams = new URLSearchParams({
    ...(type && { type: type })
  });

  try {
    const response = await fetch(
      `/api/v1/affiliates/${affiliateId}/dashboard/qr-codes?${queryParams}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      }
    );

    const result = await response.json();
    
    if (result.success) {
      console.log('QR Codes:', result.data);
      return result.data;
    }
  } catch (error) {
    console.error('Failed to get QR codes:', error.message);
    throw error;
  }
};
```

## Error Handling

### Comprehensive Error Handler

```javascript
const handleAffiliateApiError = (error, response) => {
  if (response) {
    switch (response.status) {
      case 400:
        console.error('Validation Error:', error.errors);
        // Handle validation errors
        break;
      case 401:
        console.error('Authentication Error:', error.message);
        // Redirect to login
        break;
      case 403:
        console.error('Authorization Error:', error.message);
        // Show access denied message
        break;
      case 404:
        console.error('Not Found:', error.message);
        // Handle resource not found
        break;
      case 409:
        console.error('Conflict:', error.message);
        // Handle duplicate resource
        break;
      case 429:
        console.error('Rate Limited:', error.message);
        // Implement retry with backoff
        break;
      case 500:
        console.error('Server Error:', error.message);
        // Show generic error message
        break;
      default:
        console.error('Unknown Error:', error.message);
    }
  } else {
    console.error('Network Error:', error.message);
  }
};

// Usage example
const safeApiCall = async (apiFunction, ...args) => {
  try {
    return await apiFunction(...args);
  } catch (error) {
    handleAffiliateApiError(error, error.response);
    throw error;
  }
};
```

## Rate Limiting

The API implements rate limiting to prevent abuse:

- **General endpoints**: 100 requests per 15 minutes
- **Authentication endpoints**: 5 requests per 15 minutes
- **Payment/Wallet endpoints**: 20 requests per 15 minutes

### Handle Rate Limiting

```javascript
const makeApiCallWithRetry = async (url, options, maxRetries = 3) => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);
      
      if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After') || 60;
        console.log(`Rate limited. Retrying after ${retryAfter} seconds...`);
        
        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
          continue;
        }
      }
      
      return response;
    } catch (error) {
      if (attempt === maxRetries) throw error;
      
      // Exponential backoff
      const delay = Math.pow(2, attempt) * 1000;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
};
```

## Webhooks

### Webhook Event Types

The system can send webhooks for the following events:

- `affiliate.approved` - Affiliate account approved
- `affiliate.suspended` - Affiliate account suspended
- `commission.earned` - New commission earned
- `commission.paid` - Commission paid to wallet
- `withdrawal.completed` - Withdrawal processed successfully
- `withdrawal.failed` - Withdrawal processing failed

### Webhook Handler Example

```javascript
const express = require('express');
const crypto = require('crypto');

const app = express();

// Webhook endpoint
app.post('/webhooks/affiliate', express.raw({ type: 'application/json' }), (req, res) => {
  const signature = req.headers['x-webhook-signature'];
  const payload = req.body;
  
  // Verify webhook signature
  const expectedSignature = crypto
    .createHmac('sha256', process.env.WEBHOOK_SECRET)
    .update(payload)
    .digest('hex');
  
  if (signature !== `sha256=${expectedSignature}`) {
    return res.status(401).send('Invalid signature');
  }
  
  const event = JSON.parse(payload);
  
  switch (event.type) {
    case 'affiliate.approved':
      handleAffiliateApproved(event.data);
      break;
    case 'commission.earned':
      handleCommissionEarned(event.data);
      break;
    case 'withdrawal.completed':
      handleWithdrawalCompleted(event.data);
      break;
    default:
      console.log('Unknown event type:', event.type);
  }
  
  res.status(200).send('OK');
});

const handleAffiliateApproved = (data) => {
  console.log('Affiliate approved:', data.affiliateId);
  // Send welcome email, update UI, etc.
};

const handleCommissionEarned = (data) => {
  console.log('Commission earned:', data.amount);
  // Update dashboard, send notification, etc.
};

const handleWithdrawalCompleted = (data) => {
  console.log('Withdrawal completed:', data.withdrawalId);
  // Update transaction status, send confirmation, etc.
};
```

## Testing

### Test Environment Setup

```javascript
// Test configuration
const TEST_CONFIG = {
  baseUrl: 'http://localhost:5000/api/v1',
  testUser: {
    email: 'test@example.com',
    password: 'testpassword123'
  },
  testAffiliate: {
    businessName: 'Test Business',
    businessEmail: 'test@testbusiness.com',
    businessPhone: '+2348012345678',
    businessAddress: {
      street: '123 Test Street',
      city: 'Lagos',
      state: 'Lagos State',
      country: 'Nigeria'
    }
  }
};

// Test helper functions
const testHelpers = {
  async login() {
    const response = await fetch(`${TEST_CONFIG.baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(TEST_CONFIG.testUser)
    });
    const result = await response.json();
    return result.data.accessToken;
  },

  async createTestAffiliate(token) {
    const response = await fetch(`${TEST_CONFIG.baseUrl}/affiliates/register`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(TEST_CONFIG.testAffiliate)
    });
    return await response.json();
  },

  async cleanup(token, affiliateId) {
    // Clean up test data
    await fetch(`${TEST_CONFIG.baseUrl}/affiliates/${affiliateId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
  }
};
```

### Integration Test Example

```javascript
describe('Affiliate Integration Tests', () => {
  let accessToken;
  let affiliateId;

  beforeAll(async () => {
    accessToken = await testHelpers.login();
  });

  afterAll(async () => {
    if (affiliateId) {
      await testHelpers.cleanup(accessToken, affiliateId);
    }
  });

  test('should register affiliate successfully', async () => {
    const result = await testHelpers.createTestAffiliate(accessToken);
    
    expect(result.success).toBe(true);
    expect(result.data.status).toBe('pending');
    expect(result.data.businessName).toBe(TEST_CONFIG.testAffiliate.businessName);
    
    affiliateId = result.data._id;
  });

  test('should validate referral code', async () => {
    // First get the referral code
    const affiliateResponse = await fetch(
      `${TEST_CONFIG.baseUrl}/affiliates/me`,
      {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      }
    );
    const affiliate = await affiliateResponse.json();
    const referralCode = affiliate.data.referralCode;

    // Validate the referral code
    const validationResponse = await fetch(
      `${TEST_CONFIG.baseUrl}/affiliates/validate-referral/${referralCode}`
    );
    const validation = await validationResponse.json();

    expect(validation.success).toBe(true);
    expect(validation.data.isValid).toBe(true);
  });

  test('should get wallet balance', async () => {
    const response = await fetch(
      `${TEST_CONFIG.baseUrl}/wallets/${affiliateId}/balance`,
      {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      }
    );
    const result = await response.json();

    expect(result.success).toBe(true);
    expect(result.data.balance).toBe(0);
    expect(result.data.currency).toBe('NGN');
  });
});
```

## Best Practices

1. **Always validate referral codes** before applying them to bookings
2. **Implement proper error handling** for all API calls
3. **Use pagination** for large data sets (commissions, transactions)
4. **Cache affiliate data** to reduce API calls
5. **Implement retry logic** for failed requests
6. **Validate webhook signatures** to ensure security
7. **Use HTTPS** for all API communications
8. **Store sensitive data securely** (tokens, keys)
9. **Implement proper logging** for debugging
10. **Test thoroughly** in development environment

## Support

For additional support or questions about the Affiliate Marketing System API:

- Email: api-support@travelplace.com
- Documentation: https://docs.travelplace.com/affiliate-api
- Status Page: https://status.travelplace.com