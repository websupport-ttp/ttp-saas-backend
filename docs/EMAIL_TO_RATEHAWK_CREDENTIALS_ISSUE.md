# Email to Ratehawk - Sandbox Credentials Not Working

**To**: apisupport@ratehawk.com  
**CC**: vivian.obi@ratehawk.com  
**Subject**: APIR-39029 - Sandbox API Credentials Returning 401 Error - Cannot Proceed with Testing

---

Dear Mikhail,

Thank you for providing the sandbox API credentials and the Pre-Certification Checklist. We are ready to begin the integration and testing process, however we are encountering authentication issues that are preventing us from proceeding.

## Issue Description

We have implemented the Ratehawk API integration using the credentials provided:
- **API Key ID**: 44
- **Access Token**: 2ef38047-b92b-42a8-ae09-f8b86ea319ed
- **Base URL**: https://api.worldota.net
- **Authentication**: HTTP Basic Auth (as specified in your documentation)

However, all API requests are returning **401 Unauthorized** errors with "incorrect_credentials".

## Test Details

**Endpoint Tested**: POST https://api.worldota.net/api/b2b/v3/search/multicomplete

**Request Headers**:
```
Authorization: Basic NDQ6MmVmMzgwNDctYjkyYi00MmE4LWFlMDktZjhiODZlYTMxOWVk
Content-Type: application/json
```

**Request Body**:
```json
{
  "query": "London",
  "language": "en"
}
```

**API Response**:
```json
{
  "data": null,
  "debug": {
    "api_endpoint": {
      "endpoint": "",
      "is_active": false,
      "is_limited": false,
      "remaining": 0,
      "requests_number": 0,
      "reset": "",
      "seconds_number": 0
    },
    "request": {
      "query": "London",
      "language": "en"
    },
    "method": "",
    "real_ip": "",
    "request_id": "",
    "key_id": 44,
    "api_key_id": 0,
    "utcnow": ""
  },
  "status": "error",
  "error": "incorrect_credentials"
}
```

## Analysis

The debug information shows:
- `"key_id": 44` - The API recognizes our Key ID
- `"api_key_id": 0` - This suggests the credentials are not fully activated
- `"is_active": false` - The API endpoint appears inactive for our credentials

## Questions

1. **Do the sandbox credentials need additional activation?** The credentials were provided on October 29, 2025, but may not have been activated yet.

2. **Is IP whitelisting required for sandbox access?** If so, please let us know and we will provide our IP addresses immediately.

3. **Are there any additional setup steps required** before the sandbox credentials become active?

4. **Is there a different base URL** we should be using for sandbox testing?

5. **Are there any additional headers or parameters** required for authentication beyond HTTP Basic Auth?

## Our Current Status

We have:
- ✅ Implemented all core API endpoints according to your documentation
- ✅ Configured proper HTTP Basic Authentication
- ✅ Set up error handling and fallback mechanisms
- ✅ Prepared our system for testing and certification
- ❌ **Cannot proceed with testing due to 401 authentication errors**

## Next Steps Required

To proceed with the Pre-Certification Checklist, we need:
1. Working sandbox API credentials
2. Confirmation that we can successfully make API calls
3. Ability to test hotel search, prebook, and booking flows

Once the credentials are working, we will:
1. Complete comprehensive testing as outlined in the checklist
2. Map the test hotel (hid = 8473727)
3. Provide access to our website for your verification
4. Complete and return the Pre-Certification Checklist

## Urgency

We are ready to proceed immediately once the credentials are activated. Our development team is standing by to begin testing as soon as we can successfully authenticate with the API.

Please advise on the steps needed to resolve this authentication issue so we can move forward with the integration and certification process.

Thank you for your assistance.

Best regards,

**The Travel Place Development Team**  
Website: www.travelplaceng.com  
Email: websupport@travelplaceng.com  
Phone: +234 817 148 1480

---

## Technical Details for Reference

**Integration Status**:
- Framework: Node.js/Express backend
- Authentication: HTTP Basic Auth implemented correctly
- Endpoints implemented: /search/multicomplete, /search/serp, /hotel/prebook, /order/booking/form, /order/booking/finish, /order/booking/finish/status
- Error handling: Comprehensive error handling with fallback mechanisms
- Ready for testing: Yes, pending credential activation

**Test Command Used**:
```bash
curl -X POST https://api.worldota.net/api/b2b/v3/search/multicomplete \
  -H "Authorization: Basic NDQ6MmVmMzgwNDctYjkyYi00MmE4LWFlMDktZjhiODZlYTMxOWVk" \
  -H "Content-Type: application/json" \
  -d '{"query":"London","language":"en"}'
```
