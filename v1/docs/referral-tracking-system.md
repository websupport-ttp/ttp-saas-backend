# Referral Tracking and Attribution System

## Overview

The referral tracking system enables businesses to earn commissions from customer referrals. It provides comprehensive tracking of referral sources, customer attribution, and booking performance analytics.

## Key Components

### 1. ReferralTrackingService

Main service class for managing referral operations.

**Key Methods:**
- `trackReferral(referralCode, customerData, requestData)` - Track new referrals
- `validateReferralCode(code, customerId)` - Validate referral codes
- `attributeBooking(bookingData, customerId)` - Attribute bookings to referrals
- `getReferralStats(affiliateId, dateRange)` - Get referral statistics
- `getCustomerReferralHistory(customerId)` - Get customer's referral history

### 2. Referral Tracking Middleware

Middleware components for automatic referral tracking in booking flows.

**Components:**
- `trackReferralMiddleware` - Tracks referrals for authenticated users
- `attributeBookingMiddleware` - Attributes successful bookings to referrals
- `trackGuestReferralMiddleware` - Handles guest booking referrals
- `processPendingReferral` - Processes referrals after user creation

### 3. Data Models

**Referral Model Features:**
- Customer-affiliate relationship tracking
- Booking history and performance metrics
- Referral source attribution (QR code, link, social media, etc.)
- Geographic and device information
- UTM parameter tracking

## Integration Guide

### Basic Integration

```javascript
const { 
  trackReferralMiddleware, 
  attributeBookingMiddleware 
} = require('../middleware/referralTrackingMiddleware');

// Add to booking routes
router.post('/book-flight',
  authenticateToken,
  trackReferralMiddleware,      // Track referral if code provided
  attributeBookingMiddleware,   // Attribute successful bookings
  bookingController
);
```

### Guest Booking Integration

```javascript
const { 
  trackGuestReferralMiddleware,
  processPendingReferral 
} = require('../middleware/referralTrackingMiddleware');

router.post('/book-flight-guest',
  trackGuestReferralMiddleware,
  async (req, res) => {
    // Create user account
    const newUser = await createUser(req.body.passengerDetails);
    
    // Process pending referral
    if (req.pendingReferral) {
      await processPendingReferral(newUser._id, req.pendingReferral);
    }
    
    // Continue with booking...
  }
);
```

## Request/Response Format

### Request Body (Booking)

```javascript
{
  "referralCode": "TESTBIZ-123",  // Optional referral code
  "flightDetails": {
    "departure": "LOS",
    "arrival": "JFK",
    "price": 500000
  },
  "passengerDetails": {
    "firstName": "John",
    "lastName": "Doe",
    "email": "john@example.com"
  }
}
```

### Successful Response Format

```javascript
{
  "success": true,
  "statusCode": 200,
  "message": "Booking successful",
  "data": {
    "bookingReference": "FLIGHT-123456",
    "totalAmount": 505000,
    "currency": "NGN",
    "referralAttribution": {        // Added by middleware
      "attributed": true,
      "affiliateId": "AFF-123456",
      "businessName": "Travel Agency"
    }
  }
}
```

## Referral Source Detection

The system automatically detects referral sources based on:

1. **UTM Parameters**
   - `utm_medium=qr` → QR Code
   - `utm_medium=email` → Email
   - `utm_medium=social` → Social Media

2. **Referrer URL**
   - Facebook/Twitter/Instagram → Social Media
   - Gmail/Yahoo/Outlook → Email

3. **User Agent**
   - Mobile devices → QR Code (likely)
   - Desktop → Link

4. **Default**: Link

## Analytics and Statistics

### Affiliate Statistics

```javascript
const stats = await ReferralTrackingService.getReferralStats(affiliateId, {
  startDate: '2024-01-01',
  endDate: '2024-01-31'
});

// Returns:
{
  overview: {
    totalReferrals: 100,
    convertedReferrals: 65,
    totalBookings: 120,
    totalValue: 5000000,
    conversionRate: 65
  },
  sourceBreakdown: [
    { _id: 'qr_code', count: 40, totalValue: 2000000, conversionRate: 80 },
    { _id: 'link', count: 35, totalValue: 1800000, conversionRate: 60 },
    { _id: 'social_media', count: 25, totalValue: 1200000, conversionRate: 50 }
  ],
  monthlyPerformance: [...],
  topPerformers: [...]
}
```

### Customer Referral History

```javascript
const history = await ReferralTrackingService.getCustomerReferralHistory(customerId);

// Returns:
{
  referrals: [...],
  summary: {
    totalReferrals: 2,
    totalBookings: 5,
    totalValue: 250000,
    activeReferrals: 1,
    convertedReferrals: 1
  }
}
```

## Error Handling

### Graceful Degradation

The referral system is designed to never block the booking process:

- Invalid referral codes are logged but don't prevent bookings
- Referral tracking failures are caught and logged
- Attribution errors don't affect booking success

### Error Types

```javascript
// Custom error types
class ReferralTrackingError extends ApiError {
  constructor(message, statusCode = 500) {
    super(message, statusCode, [], 'REFERRAL_TRACKING_ERROR');
  }
}
```

## Performance Considerations

### Database Indexes

The Referral model includes optimized indexes for:
- Affiliate queries: `{ affiliateId: 1, status: 1 }`
- Customer queries: `{ customerId: 1 }`
- Performance queries: `{ affiliateId: 1, totalValue: -1 }`
- Date range queries: `{ createdAt: -1 }`

### Caching Strategy

Consider caching:
- Affiliate referral code validations
- Frequently accessed referral statistics
- Top performer lists

## Security Features

### Fraud Prevention

- IP address tracking for suspicious patterns
- Device fingerprinting
- Referral blocking capabilities
- Audit trail for all referral activities

### Data Protection

- PII handling in compliance with data protection laws
- Secure storage of tracking data
- Access controls for referral management

## Testing

### Unit Tests

- Service method testing with mocked dependencies
- Middleware functionality testing
- Error handling scenarios

### Integration Tests

- Complete referral attribution flow
- Guest booking scenarios
- Multi-booking attribution
- Error recovery testing

### Performance Tests

- High-volume referral tracking
- Concurrent booking attribution
- Database query performance

## Monitoring and Logging

### Key Metrics

- Referral tracking success rate
- Attribution accuracy
- Performance latency
- Error rates by type

### Log Events

```javascript
// Successful referral tracking
logger.info('Referral tracked', {
  referralId,
  affiliateId,
  customerId,
  source: 'qr_code'
});

// Booking attribution
logger.info('Booking attributed', {
  bookingReference,
  referralId,
  commissionAmount
});

// Error scenarios
logger.error('Referral tracking failed', {
  referralCode,
  customerId,
  error: error.message
});
```

## API Endpoints

### Referral Management

```
GET    /api/v1/affiliates/:id/referral-stats
GET    /api/v1/affiliates/:id/referrals
GET    /api/v1/users/:id/referral-history
PATCH  /api/v1/referrals/:id/block
PATCH  /api/v1/referrals/:id/reactivate
```

### Validation

```
POST   /api/v1/referrals/validate-code
```

## Configuration

### Environment Variables

```env
# Referral tracking settings
REFERRAL_TRACKING_ENABLED=true
REFERRAL_CODE_EXPIRY_DAYS=365
MAX_REFERRALS_PER_CUSTOMER=5

# Analytics settings
REFERRAL_STATS_CACHE_TTL=3600
TOP_PERFORMERS_LIMIT=10
```

## Migration Guide

### Existing System Integration

1. **Add Middleware**: Integrate referral middleware into existing booking routes
2. **Update Models**: Ensure booking responses include required fields
3. **Test Integration**: Verify referral tracking doesn't affect existing functionality
4. **Monitor Performance**: Watch for any performance impact

### Data Migration

If migrating from an existing referral system:

1. Map existing referral data to new schema
2. Preserve referral relationships and history
3. Update affiliate commission calculations
4. Verify data integrity after migration

## Troubleshooting

### Common Issues

1. **Referrals Not Tracking**
   - Check middleware order in routes
   - Verify referral code format
   - Confirm affiliate status is 'active'

2. **Bookings Not Attributed**
   - Ensure response format includes required fields
   - Check booking endpoint URL patterns
   - Verify user authentication

3. **Performance Issues**
   - Review database indexes
   - Check for N+1 query problems
   - Consider caching frequently accessed data

### Debug Mode

Enable detailed logging:

```javascript
// Set log level to debug
process.env.LOG_LEVEL = 'debug';

// Additional debug info in responses
process.env.REFERRAL_DEBUG = 'true';
```

## Future Enhancements

### Planned Features

1. **Advanced Analytics**
   - Cohort analysis
   - Customer lifetime value tracking
   - Predictive referral scoring

2. **Enhanced Attribution**
   - Multi-touch attribution
   - Cross-device tracking
   - Offline referral tracking

3. **Automation**
   - Automated fraud detection
   - Smart referral recommendations
   - Dynamic commission rates

### API Versioning

The referral system is designed to support API versioning:
- Current version: v1
- Backward compatibility maintained
- Deprecation notices for breaking changes