# File Upload Testing Suite

## Overview

This comprehensive testing suite validates the file upload functionality for visa document uploads in The Travel Place API. The tests cover security, performance, integration, and functionality aspects of the file upload system.

## Test Files

### 1. `fileUpload.comprehensive.test.js`
**Purpose**: Core functionality testing
**Coverage**:
- File format validation (PDF, JPEG, PNG)
- File size validation (empty files, size limits)
- Document type validation (all visa document types)
- Multiple document upload scenarios
- Error handling for various edge cases
- Authentication and authorization

**Key Test Scenarios**:
- ✅ Valid PDF document upload
- ✅ Valid JPEG/PNG image upload
- ✅ File size limit enforcement (10MB limit)
- ✅ Document type validation
- ✅ Multiple document handling
- ✅ User authorization checks

### 2. `fileUpload.security.test.js`
**Purpose**: Security validation and threat detection
**Coverage**:
- Malicious file detection
- File type spoofing detection
- Path traversal protection
- Content validation
- Rate limiting and abuse prevention
- Metadata security

**Key Test Scenarios**:
- 🛡️ Malicious PDF with embedded JavaScript
- 🛡️ Executable files disguised as PDFs
- 🛡️ Polyglot files (valid in multiple formats)
- 🛡️ Path traversal attempts
- 🛡️ Password-protected PDF detection
- 🛡️ Rate limiting enforcement

### 3. `fileUpload.cloudinary.test.js`
**Purpose**: Cloudinary integration testing
**Coverage**:
- Successful upload scenarios
- Error handling for various Cloudinary failures
- Response validation
- Document replacement and cleanup
- Configuration validation
- Performance optimization

**Key Test Scenarios**:
- ☁️ Successful Cloudinary upload with correct parameters
- ☁️ Service unavailability handling
- ☁️ Authentication error handling
- ☁️ Quota exceeded scenarios
- ☁️ Timeout error handling
- ☁️ Old document cleanup on replacement

### 4. `fileUpload.performance.test.js`
**Purpose**: Performance and load testing
**Coverage**:
- Upload speed benchmarks
- Concurrent upload handling
- Memory usage validation
- Error recovery performance
- Throughput testing
- Scalability validation

**Key Test Scenarios**:
- ⚡ Small file upload speed (< 2 seconds)
- ⚡ Medium file upload speed (< 5 seconds)
- ⚡ Large file upload speed (< 10 seconds)
- ⚡ Concurrent upload handling (5-10 simultaneous)
- ⚡ Memory leak prevention
- ⚡ Error recovery timing

## Test Runner

### `fileUpload.testRunner.js`
**Purpose**: Orchestrates all file upload tests and generates comprehensive reports

**Features**:
- Sequential test suite execution
- Detailed result parsing
- Performance metrics collection
- Comprehensive reporting
- JSON report generation
- Feature coverage validation

**Usage**:
```bash
# Run all file upload tests
node v1/test/fileUpload.testRunner.js

# Run individual test suites
npm test -- v1/test/fileUpload.comprehensive.test.js
npm test -- v1/test/fileUpload.security.test.js
npm test -- v1/test/fileUpload.cloudinary.test.js
npm test -- v1/test/fileUpload.performance.test.js
```

## Test Configuration

### Environment Setup
The tests use a dedicated test environment with:
- In-memory MongoDB for data isolation
- Mocked Cloudinary service for consistent testing
- Temporary file directories for test files
- Proper cleanup after each test

### Mock Configuration
```javascript
// Cloudinary service is mocked to simulate:
uploadFile.mockResolvedValue({
  secure_url: 'https://res.cloudinary.com/test/image/upload/v123456789/test-document.jpg',
  public_id: 'test-document',
  bytes: 1024000,
  format: 'jpg',
  resource_type: 'image'
});
```

## File Upload Validation Rules

### Supported File Formats
- **PDF**: `.pdf` files with valid PDF structure
- **JPEG**: `.jpg`, `.jpeg` files with valid JPEG headers
- **PNG**: `.png` files with valid PNG headers

### File Size Limits
- **Minimum**: Files cannot be empty (0 bytes)
- **Maximum**: 10MB per file
- **Recommended**: Under 5MB for optimal performance

### Document Types
- International Passport
- Passport Photograph
- Bank Statement
- Flight Itinerary
- Hotel Booking
- Invitation Letter
- Other

### Security Validations
- File header validation (magic number checking)
- Malicious content scanning
- Path traversal prevention
- Metadata stripping
- Rate limiting (prevents abuse)

## Performance Benchmarks

### Upload Speed Targets
- **Small files (< 1MB)**: Under 2 seconds
- **Medium files (1-5MB)**: Under 5 seconds
- **Large files (5-10MB)**: Under 10 seconds

### Concurrency Limits
- **Normal load**: 5 concurrent uploads
- **High load**: 10 concurrent uploads (with throttling)
- **Rate limiting**: Prevents excessive requests

### Memory Usage
- **Memory leak prevention**: Validated through multiple large uploads
- **Temporary file cleanup**: Automatic cleanup after processing
- **Resource management**: Proper file handle management

## Error Handling

### Client Errors (4xx)
- `400 Bad Request`: Invalid file format, size, or document type
- `401 Unauthorized`: Missing or invalid authentication
- `403 Forbidden`: Insufficient permissions
- `404 Not Found`: Visa application not found
- `413 Payload Too Large`: File exceeds size limit
- `429 Too Many Requests`: Rate limit exceeded

### Server Errors (5xx)
- `500 Internal Server Error`: Cloudinary upload failure
- `503 Service Unavailable`: Cloudinary service down
- `504 Gateway Timeout`: Upload timeout

## Integration Points

### Cloudinary Configuration
```javascript
const uploadOptions = {
  resource_type: 'auto',
  allowed_formats: ['pdf', 'jpg', 'jpeg', 'png'],
  quality: 'auto:low',
  strip: true, // Remove metadata
  folder: `visa-documents/${visaApplicationId}`
};
```

### Database Integration
- Documents are stored in the `VisaApplication` model
- File metadata is preserved (size, type, upload date)
- Cloudinary URLs are stored for retrieval

### Authentication Integration
- Uses existing authentication middleware
- Supports both authenticated users and guest uploads
- Proper authorization checks for document access

## Monitoring and Logging

### Metrics Tracked
- Upload success/failure rates
- Average upload times
- File size distributions
- Error frequency by type
- Cloudinary API usage

### Logging
- All uploads are logged with context
- Errors include detailed stack traces
- Performance metrics are recorded
- Security violations are flagged

## Maintenance

### Regular Tasks
1. **Update security rules**: Review and update malicious content detection
2. **Performance monitoring**: Track upload times and optimize as needed
3. **Cloudinary optimization**: Review storage usage and cleanup old files
4. **Test updates**: Add new test cases based on production issues

### Troubleshooting

#### Common Issues
1. **Cloudinary timeouts**: Check network connectivity and API limits
2. **File validation failures**: Verify file format and content
3. **Memory issues**: Monitor for file handle leaks
4. **Rate limiting**: Adjust limits based on usage patterns

#### Debug Commands
```bash
# Run tests with debug output
DEBUG=* npm test -- v1/test/fileUpload.comprehensive.test.js

# Check Cloudinary configuration
node -e "console.log(require('cloudinary').v2.config())"

# Monitor memory usage during tests
node --expose-gc v1/test/fileUpload.performance.test.js
```

## Security Considerations

### File Validation
- Magic number verification prevents file type spoofing
- Content scanning detects malicious payloads
- Size limits prevent DoS attacks
- Rate limiting prevents abuse

### Data Protection
- Files are uploaded to secure Cloudinary folders
- Metadata is stripped from images
- Access is controlled through authentication
- Temporary files are securely cleaned up

### Compliance
- GDPR: User data is handled according to privacy requirements
- Security: Files are scanned for malicious content
- Audit: All uploads are logged for compliance

## Future Enhancements

### Planned Features
1. **Virus scanning**: Integration with antivirus services
2. **OCR validation**: Text extraction and validation for documents
3. **Image quality checks**: Ensure passport photos meet requirements
4. **Batch uploads**: Support for multiple file uploads
5. **Progress tracking**: Real-time upload progress for large files

### Performance Improvements
1. **CDN integration**: Faster file delivery
2. **Compression**: Automatic file compression
3. **Caching**: Intelligent caching strategies
4. **Load balancing**: Distribute upload load

## Conclusion

This comprehensive file upload testing suite ensures that the visa document upload functionality is secure, performant, and reliable. The tests cover all critical aspects from basic functionality to advanced security scenarios, providing confidence in the system's ability to handle real-world usage patterns.

Regular execution of these tests helps maintain system quality and catch regressions early in the development cycle.