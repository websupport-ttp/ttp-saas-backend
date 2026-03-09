# Duplicate Mongoose Index Fixes

## Issue
Models have duplicate index definitions:
1. `index: true` or `unique: true` in schema field definition
2. Separate `.index()` call after schema definition

This causes Mongoose warnings but doesn't affect functionality.

## Models to Fix

### 1. pendingVerificationModel.js
- `verificationToken`: Has `unique: true` in schema + `.index()` call
- **Fix**: Remove line 73: `pendingVerificationSchema.index({ verificationToken: 1 });`

### 2. userModel.js  
- `staffEmployeeId`: Has `index: true` in schema + `.index()` call
- `staffDetails.employeeId`: Has `index: true` + `.index()` call
- **Fix**: Remove duplicate `.index()` calls

### 3. carBookingModel.js
- `bookingReference`: Has `unique: true` + `.index()` call
- `payment.reference`: Has `index: true` + `.index()` call
- **Fix**: Remove duplicate `.index()` calls

### 4. walletTransactionModel.js
- `walletId`: Has `index: true` + `.index()` in compound
- `affiliateId`: Has `index: true` + `.index()` in compound
- `type`: Has `index: true` + `.index()` in compound
- `status`: Has `index: true` + `.index()` in compound
- **Fix**: Remove `index: true` from field definitions, keep compound indexes

## Solution Strategy

For each duplicate:
1. If field needs to be unique: Keep `unique: true`, remove `.index()` call
2. If field is part of compound index: Remove `index: true`, keep compound `.index()` call
3. If field needs simple index: Keep either one (prefer `.index()` for clarity)

## Files to Update
- backend/v1/models/pendingVerificationModel.js
- backend/v1/models/userModel.js
- backend/v1/models/carBookingModel.js
- backend/v1/models/walletTransactionModel.js
- backend/v1/models/postModel.js
- backend/v1/models/ledgerModel.js
