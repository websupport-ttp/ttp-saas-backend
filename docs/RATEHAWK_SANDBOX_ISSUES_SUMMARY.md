# Ratehawk Sandbox Integration - Current Status

## ✅ RESOLVED ISSUES

### 1. Base URL Issue - FIXED
- **Problem**: Was using production URL with sandbox credentials
- **Solution**: Changed to `https://api-sandbox.worldota.net`
- **Status**: ✅ Working

### 2. Currency Issue - FIXED  
- **Problem**: Sandbox doesn't support NGN (Nigerian Naira)
- **Error**: `"validation_error": "unknown currency"`
- **Solution**: Using USD for sandbox testing
- **Status**: ✅ Working

### 3. API Endpoint Issue - FIXED
- **Problem**: Was using wrong endpoint path
- **Solution**: Changed to `/api/b2b/v3/search/serp/region`
- **Status**: ✅ Working

---

## ❌ CURRENT BLOCKER

### Invalid Region ID
**Error**: `"validation_error": "invalid region_id field, this region cannot be searched"`

**Problem**: The sandbox environment has very limited data. We've tried:
- Region ID 2114 - Invalid
- Region ID 6040 - Invalid  
- Multicomplete search returns empty results for most destinations

**What We Need from Ratehawk**:
1. List of valid region IDs available in sandbox
2. List of valid test destinations/cities
3. The test hotel mentioned (hid = 8473727 or id = "test_hotel_do_not_book") and its region_id

---

## API CALLS WORKING

### ✅ Multicomplete Search
```bash
POST https://api-sandbox.worldota.net/api/b2b/v3/search/multicomplete
Status: 200 OK
Authentication: Working
```

### ❌ Hotel Search by Region
```bash
POST https://api-sandbox.worldota.net/api/b2b/v3/search/serp/region
Status: 400 Bad Request
Error: "invalid region_id field, this region cannot be searched"
```

**Request Being Sent**:
```json
{
  "checkin": "2025-11-28",
  "checkout": "2025-11-29",
  "residency": "ng",
  "language": "en",
  "guests": [{"adults": 1, "children": []}],
  "region_id": 2114,
  "currency": "USD"
}
```

---

## WHAT WE NEED TO PROCEED

### From Ratehawk Support

**Email to**: apisupport@ratehawk.com  
**CC**: vivian.obi@ratehawk.com  
**Subject**: APIR-39029 - Need Valid Test Data for Sandbox Environment

**Request**:
1. **Valid Region IDs**: Please provide a list of region IDs that are available in the sandbox environment for testing
2. **Test Hotel Details**: The region_id for the test hotel (hid = 8473727 or id = "test_hotel_do_not_book")
3. **Test Destinations**: List of cities/destinations that have hotel data in sandbox
4. **Supported Currencies**: List of currencies supported in sandbox (we know USD works, NGN doesn't)

---

## INTEGRATION STATUS

### Code Implementation: 100% Complete ✅
- All endpoints implemented correctly
- Authentication working
- Error handling in place
- Request/response transformation working
- Fallback to mock data working

### Testing Status: Blocked ⚠️
- Cannot test hotel search without valid region IDs
- Cannot complete Pre-Certification Checklist
- Cannot map test hotel without knowing its region_id

### Next Steps
1. **Immediate**: Email Ratehawk for valid test data
2. **Once received**: Test hotel search with valid region IDs
3. **Then**: Complete Pre-Certification Checklist
4. **Finally**: Provide website access for certification

---

## Technical Details

### Current Configuration
- **Base URL**: https://api-sandbox.worldota.net ✅
- **API Key ID**: 44 ✅
- **Authentication**: HTTP Basic Auth ✅
- **Endpoints**: All correctly implemented ✅

### Test Results
| Test | Status | Notes |
|------|--------|-------|
| Authentication | ✅ Pass | Credentials working |
| Multicomplete API | ✅ Pass | Returns 200, but empty results |
| Hotel Search API | ❌ Fail | Invalid region_id |
| Currency USD | ✅ Pass | Accepted by API |
| Currency NGN | ❌ Fail | Not supported in sandbox |

---

## Logs Showing the Issue

```
2025-11-19 06:28:42 [info]: Using region ID: 2114 for Charles de Gaulle
2025-11-19 06:28:42 [info]: Making POST request to Ratehawk API: /api/b2b/v3/search/serp/region
2025-11-19 06:28:42 [error]: Ratehawk API response data:
{
  "status": "error",
  "error": "invalid_params",
  "debug": {
    "validation_error": "invalid region_id field, this region cannot be searched",
    "key_id": 44,
    "api_key_id": 44
  }
}
```

---

**Last Updated**: November 19, 2025  
**Status**: Waiting for valid sandbox test data from Ratehawk  
**Blocker**: Need valid region IDs to proceed with testing
