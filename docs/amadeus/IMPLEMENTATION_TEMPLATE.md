# Amadeus XML Service Implementation Template

## Required Information from Documentation

### 1. Service Endpoints
- [ ] **WSDL URL**: `_____________________`
- [ ] **Service URL**: `_____________________`
- [ ] **Test Environment**: `_____________________`
- [ ] **Production Environment**: `_____________________`

### 2. Authentication
- [ ] **Method**: Basic Auth / SOAP Headers / Custom Headers
- [ ] **Username Field**: `_____________________`
- [ ] **Password Field**: `_____________________`
- [ ] **Office ID Field**: `_____________________`
- [ ] **Additional Headers**: `_____________________`

### 3. Flight Search Operations
- [ ] **Operation Name**: `_____________________`
- [ ] **SOAP Action**: `_____________________`
- [ ] **Request Format**: XML structure
- [ ] **Response Format**: XML structure

### 4. Sample Request Structure
```xml
<!-- Paste sample flight search XML request here -->
```

### 5. Sample Response Structure
```xml
<!-- Paste sample flight search XML response here -->
```

### 6. Error Handling
- [ ] **Error Codes**: List of possible error codes
- [ ] **Error Format**: XML structure for errors
- [ ] **Retry Logic**: When to retry requests

### 7. PNR/Booking Operations (from PNR WS doc)
- [ ] **Create PNR Operation**: `_____________________`
- [ ] **Booking Request Format**: XML structure
- [ ] **Booking Response Format**: XML structure

## Implementation Checklist

Once we have the above information:

- [ ] Update `AMADEUS_XML_ENDPOINT` in `.env`
- [ ] Update authentication method in `amadeusXmlService.js`
- [ ] Update SOAP operation names
- [ ] Update XML request builders
- [ ] Update XML response parsers
- [ ] Test with real Amadeus service
- [ ] Verify flight search returns real data
- [ ] Test error handling
- [ ] Test booking functionality

## Current Issues to Resolve

1. **404 Errors**: All tested endpoints return 404
2. **Authentication**: Unknown authentication method
3. **Operation Names**: Don't know correct SOAP method names
4. **XML Format**: Need correct request/response structure

## Next Steps

1. Extract information from Word documents
2. Fill in the template above
3. Update service implementation
4. Test with real Amadeus API
5. Verify integration works end-to-end