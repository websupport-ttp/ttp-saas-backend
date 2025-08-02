# JWT Token Generation Fix

## Issue Description

The authentication system was experiencing a JWT token generation error:

```
Bad "options.jwtid" option. The payload already has an "jti" property.
```

This error occurred during user registration when the system attempted to generate JWT tokens for authentication.

## Root Cause

The issue was in the `generateToken` function in `v1/utils/jwt.js`. The function was setting both:

1. `jti` property in the token payload
2. `jwtid` option in the JWT signing options

The JWT library treats `jti` (JWT ID in payload) and `jwtid` (JWT ID in options) as the same thing, causing a conflict when both are present.

## Solution

**File:** `v1/utils/jwt.js`

**Change:** Removed the redundant `jwtid` from the JWT signing options since we're already setting `jti` in the payload.

### Before (Problematic Code):
```javascript
const generateToken = (payload, secret, expiresIn, options = {}) => {
  const {
    issuer = 'travel-place-api',
    audience = 'travel-place-client',
    jwtid = crypto.randomUUID(),
    algorithm = 'HS256',
  } = options;

  const enhancedPayload = {
    ...payload,
    iat: Math.floor(Date.now() / 1000),
    jti: jwtid, // JWT ID for token tracking
  };

  return jwt.sign(enhancedPayload, secret, {
    expiresIn,
    algorithm,
    issuer,
    audience,
    jwtid, // ❌ This conflicts with jti in payload
  });
};
```

### After (Fixed Code):
```javascript
const generateToken = (payload, secret, expiresIn, options = {}) => {
  const {
    issuer = 'travel-place-api',
    audience = 'travel-place-client',
    jwtid = crypto.randomUUID(),
    algorithm = 'HS256',
  } = options;

  const enhancedPayload = {
    ...payload,
    iat: Math.floor(Date.now() / 1000),
    jti: jwtid, // JWT ID for token tracking
  };

  return jwt.sign(enhancedPayload, secret, {
    expiresIn,
    algorithm,
    issuer,
    audience,
    // ✅ Removed jwtid from options since jti is in payload
  });
};
```

## Impact

### Functions Affected:
- `generateToken()` - Direct fix applied
- `generateTokenPair()` - Uses generateToken, now works correctly
- `attachCookiesToResponse()` - Uses generateTokenPair, now works correctly

### Authentication Flows Fixed:
- User registration (`/api/v1/auth/register`)
- User login (`/api/v1/auth/login`)
- Google OAuth login
- Password reset
- Token refresh operations

## Verification

The fix was verified through:

1. **Direct Testing**: Created test cases to verify token generation works without errors
2. **Integration Testing**: Confirmed authentication endpoints work correctly
3. **Error Handling Tests**: Verified existing error handling tests still pass
4. **Token Verification**: Confirmed generated tokens can be verified successfully

### Test Results:
- ✅ Basic token generation: Working
- ✅ Token pair generation: Working
- ✅ Token verification: Working
- ✅ Error handling: Working
- ✅ All existing tests: Still passing

## Security Considerations

The fix maintains all security features:
- JWT ID (`jti`) is still present in tokens for tracking
- Token expiration works correctly
- Token verification includes all security checks
- No changes to token payload structure
- No changes to signing algorithms or secrets

## Backward Compatibility

This fix is fully backward compatible:
- Existing tokens remain valid
- Token verification logic unchanged
- API responses unchanged
- Cookie handling unchanged

## Related Components

The following components work correctly after the fix:
- Authentication middleware
- Error handling system
- Session management
- Cookie-based authentication
- Token blacklisting (for logout)
- Token rotation (for refresh)

## Conclusion

The JWT token generation issue has been resolved by removing the redundant `jwtid` option from the JWT signing process. The system now generates tokens correctly without conflicts, and all authentication flows work as expected.