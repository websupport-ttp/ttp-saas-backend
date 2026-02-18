# API Changes Documentation

## Overview

This document outlines the API changes resulting from the migration from Cloudinary to Cloudflare Images and the transition from Amadeus JSON REST API to XML SOAP API. While most endpoints maintain backward compatibility, there are some important changes to be aware of.

## File Upload and Management Changes

### File Upload Response Format

The file upload endpoints now return Cloudflare-specific response data instead of Cloudinary data.

#### Before (Cloudinary)

```json
{
  "success": true,
  "message": "File uploaded successfully",
  "data": {
    "public_id": "sample_image_abc123",
    "version": 1234567890,
    "signature": "abc123def456",
    "width": 1920,
    "height": 1080,
    "format": "jpg",
    "resource_type": "image",
    "created_at": "2024-01-15T10:30:00Z",
    "tags": [],
    "bytes": 245760,
    "type": "upload",
    "etag": "abc123def456",
    "placeholder": false,
    "url": "http://res.cloudinary.com/demo/image/upload/v1234567890/sample_image_abc123.jpg",
    "secure_url": "https://res.cloudinary.com/demo/image/upload/v1234567890/sample_image_abc123.jpg"
  }
}
```

#### After (Cloudflare)

```json
{
  "success": true,
  "message": "File uploaded successfully",
  "data": {
    "id": "cloudflare-image-id-xyz789",
    "filename": "sample_image.jpg",
    "uploaded": "2024-01-15T10:30:00.000Z",
    "requireSignedURLs": false,
    "variants": [
      "https://imagedelivery.net/your-hash/cloudflare-image-id-xyz789/public",
      "https://imagedelivery.net/your-hash/cloudflare-image-id-xyz789/thumbnail",
      "https://imagedelivery.net/your-hash/cloudflare-image-id-xyz789/medium"
    ],
    "url": "https://imagedelivery.net/your-hash/cloudflare-image-id-xyz789/public",
    "meta": {
      "originalFilename": "sample_image.jpg",
      "uploadedBy": "user-id-123",
      "uploadedAt": "2024-01-15T10:30:00.000Z"
    }
  }
}
```

### Key Changes in File Upload Response

1. **ID Format**: `public_id` → `id` (Cloudflare uses different ID format)
2. **URL Structure**: Cloudinary URLs → Cloudflare Images URLs
3. **Variants**: New `variants` array with different image sizes
4. **Metadata**: Different metadata structure in `meta` object
5. **No Version Numbers**: Cloudflare doesn't use version numbers like Cloudinary

### File Management Endpoints

#### Upload File
```http
POST /api/v1/upload
```

**Request**: No changes
**Response**: Updated format (see above)

#### Delete File
```http
DELETE /api/v1/files/:fileId
```

**Changes**: 
- `fileId` parameter now expects Cloudflare image ID instead of Cloudinary public_id
- Response format updated to reflect Cloudflare deletion result

#### Get File Metadata
```http
GET /api/v1/files/:fileId/metadata
```

**Changes**:
- Returns Cloudflare-specific metadata
- Different metadata structure

## Flight Search and Booking Changes

### Backend Changes (Transparent to API Consumers)

The flight search and booking endpoints now use Amadeus XML SOAP API instead of JSON REST API. However, the request and response formats remain the same for backward compatibility.

#### Flight Search
```http
POST /api/v1/flights/search
```

**Request Format**: No changes
```json
{
  "origin": "LOS",
  "destination": "JFK",
  "departureDate": "2024-12-01",
  "returnDate": "2024-12-08",
  "passengers": {
    "adults": 1,
    "children": 0,
    "infants": 0
  },
  "class": "Economy"
}
```

**Response Format**: No changes to structure, but data now sourced from XML
```json
{
  "success": true,
  "data": {
    "searchId": "xml-search-id-123",
    "flights": [
      {
        "id": "flight-offer-1",
        "airline": "BA",
        "flightNumber": "BA085",
        "departure": {
          "airport": "LOS",
          "time": "2024-12-01T14:30:00Z"
        },
        "arrival": {
          "airport": "JFK",
          "time": "2024-12-01T22:45:00Z"
        },
        "price": {
          "amount": 850000,
          "currency": "NGN"
        },
        "duration": "8h 15m",
        "stops": 0
      }
    ],
    "totalResults": 25,
    "searchCriteria": {
      "origin": "LOS",
      "destination": "JFK",
      "departureDate": "2024-12-01"
    }
  }
}
```

#### Flight Booking
```http
POST /api/v1/flights/book
```

**Request Format**: No changes
**Response Format**: No changes to structure, but booking now processed via XML

### Performance Considerations

- **Response Times**: XML processing may add 100-200ms to response times
- **Data Richness**: XML API provides more detailed flight information
- **Error Handling**: Enhanced error messages with XML-specific error codes

## Error Response Changes

### Enhanced Error Responses

Error responses now include more detailed information, especially for XML processing errors:

#### Before
```json
{
  "success": false,
  "error": {
    "code": "AMADEUS_API_ERROR",
    "message": "Flight search failed"
  }
}
```

#### After
```json
{
  "success": false,
  "error": {
    "code": "AMADEUS_XML_PARSE_ERROR",
    "message": "Failed to parse XML response from Amadeus",
    "details": {
      "xmlError": "Invalid XML structure in SOAP response",
      "endpoint": "/flight-search",
      "timestamp": "2024-01-15T10:30:00Z",
      "requestId": "req-123-abc"
    }
  }
}
```

### New Error Codes

| Error Code | Description | HTTP Status |
|------------|-------------|-------------|
| `CLOUDFLARE_UPLOAD_ERROR` | File upload to Cloudflare failed | 500 |
| `CLOUDFLARE_DELETE_ERROR` | File deletion from Cloudflare failed | 500 |
| `CLOUDFLARE_API_LIMIT` | Cloudflare API rate limit exceeded | 429 |
| `AMADEUS_XML_PARSE_ERROR` | XML response parsing failed | 500 |
| `AMADEUS_XML_TIMEOUT` | XML service request timeout | 504 |
| `AMADEUS_SOAP_FAULT` | SOAP fault returned by Amadeus | 400 |
| `XML_VALIDATION_ERROR` | XML schema validation failed | 400 |

## Health Check Endpoints

New health check endpoints have been added to monitor the new services:

### General Health Check
```http
GET /api/v1/health
```

**Response**:
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00Z",
  "services": {
    "database": "healthy",
    "cloudflare": "healthy",
    "amadeusXml": "healthy"
  },
  "version": "1.0.0"
}
```

### Service-Specific Health Checks

#### Cloudflare Service Health
```http
GET /api/v1/health/cloudflare
```

#### Amadeus XML Service Health
```http
GET /api/v1/health/amadeus-xml
```

## Migration-Specific Endpoints

### Migration Status
```http
GET /api/v1/migration/status
```

**Response**:
```json
{
  "migrationComplete": true,
  "cloudinaryFilesRemaining": 0,
  "lastMigrationDate": "2024-01-15T10:30:00Z",
  "statistics": {
    "totalFilesMigrated": 1250,
    "successfulMigrations": 1248,
    "failedMigrations": 2
  }
}
```

### File URL Migration
```http
POST /api/v1/migration/migrate-url
```

**Request**:
```json
{
  "cloudinaryUrl": "https://res.cloudinary.com/demo/image/upload/v1234567890/sample.jpg"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "originalUrl": "https://res.cloudinary.com/demo/image/upload/v1234567890/sample.jpg",
    "newUrl": "https://imagedelivery.net/your-hash/new-image-id/public",
    "cloudflareId": "new-image-id"
  }
}
```

## Backward Compatibility

### Maintained Compatibility

1. **Request Formats**: All existing request formats are maintained
2. **Response Structures**: Core response structures remain the same
3. **Authentication**: No changes to authentication mechanisms
4. **Rate Limiting**: Same rate limiting rules apply

### Breaking Changes

1. **File Upload Response**: Different response structure (see above)
2. **File IDs**: Cloudflare image IDs replace Cloudinary public_ids
3. **File URLs**: All file URLs now use Cloudflare domain
4. **Error Codes**: New error codes for XML and Cloudflare operations

## Client Migration Guide

### For Frontend Applications

#### 1. Update File Upload Handling

**Before**:
```javascript
// Handling Cloudinary response
const uploadResponse = await uploadFile(file);
const imageUrl = uploadResponse.data.secure_url;
const publicId = uploadResponse.data.public_id;
```

**After**:
```javascript
// Handling Cloudflare response
const uploadResponse = await uploadFile(file);
const imageUrl = uploadResponse.data.url;
const imageId = uploadResponse.data.id;
```

#### 2. Update File Deletion

**Before**:
```javascript
// Delete using Cloudinary public_id
await deleteFile(publicId);
```

**After**:
```javascript
// Delete using Cloudflare image ID
await deleteFile(imageId);
```

#### 3. Handle New Error Codes

```javascript
// Add handling for new error codes
const handleApiError = (error) => {
  switch (error.code) {
    case 'CLOUDFLARE_UPLOAD_ERROR':
      showError('File upload failed. Please try again.');
      break;
    case 'AMADEUS_XML_TIMEOUT':
      showError('Flight search is taking longer than usual. Please wait...');
      break;
    case 'CLOUDFLARE_API_LIMIT':
      showError('Too many requests. Please wait a moment and try again.');
      break;
    default:
      showError('An unexpected error occurred.');
  }
};
```

### For Mobile Applications

#### 1. Update Image Caching

**Before**:
```swift
// iOS: Caching Cloudinary URLs
let cloudinaryUrl = "https://res.cloudinary.com/demo/image/upload/..."
```

**After**:
```swift
// iOS: Caching Cloudflare URLs
let cloudflareUrl = "https://imagedelivery.net/hash/image-id/public"
```

#### 2. Update File Upload Logic

Similar changes as frontend applications, adapting to the new response format.

## Testing Changes

### Updated Test Cases

1. **File Upload Tests**: Update assertions for new response format
2. **Error Handling Tests**: Add tests for new error codes
3. **Integration Tests**: Update XML service mocks
4. **Performance Tests**: Adjust expectations for XML processing times

### Example Test Updates

**Before**:
```javascript
// Testing Cloudinary upload
expect(response.data).toHaveProperty('public_id');
expect(response.data).toHaveProperty('secure_url');
```

**After**:
```javascript
// Testing Cloudflare upload
expect(response.data).toHaveProperty('id');
expect(response.data).toHaveProperty('url');
expect(response.data).toHaveProperty('variants');
```

## Monitoring and Analytics

### New Metrics to Monitor

1. **XML Processing Time**: Monitor Amadeus XML response times
2. **Cloudflare Upload Success Rate**: Track file upload success rates
3. **Error Rate by Type**: Monitor new error codes
4. **Migration Progress**: Track remaining Cloudinary files

### Updated Dashboards

Update monitoring dashboards to include:
- Cloudflare API usage and limits
- XML service availability and performance
- File migration progress
- New error code frequencies

## Support and Troubleshooting

### Common Issues

1. **File Upload Failures**: Check Cloudflare API limits and credentials
2. **XML Parsing Errors**: Verify Amadeus XML service connectivity
3. **Slow Response Times**: Monitor XML processing performance
4. **Migration Issues**: Use migration validation scripts

### Debug Endpoints

```http
GET /api/v1/debug/services
GET /api/v1/debug/migration
GET /api/v1/debug/xml-status
```

## Conclusion

While the migration introduces some changes, particularly in file upload responses and error handling, the core API functionality remains backward compatible. The changes improve performance, reduce costs, and provide better integration with modern services.

Key points for API consumers:
- Update file upload response handling
- Handle new error codes appropriately
- Monitor for any performance changes
- Test thoroughly in staging environments before production deployment