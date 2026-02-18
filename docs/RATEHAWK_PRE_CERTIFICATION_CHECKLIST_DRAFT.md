# ETG API Pre-Certification Checklist - The Travel Place
## DRAFT - To be completed once API credentials are working

**Status**: PENDING - Waiting for sandbox API credentials to be activated  
**Date**: November 17, 2025  
**Company**: The Travel Place Limited  
**Contact**: websupport@travelplaceng.com

---

## General

### Map Test Hotels
- [ ] **PENDING**: Map test hotel hid = 8473727 or id = "test_hotel_do_not_book"
  - **Status**: Cannot test until API credentials are working

### Product Type for Certification
- [x] **Website** - Travel booking platform
  - [ ] Access to the website has been provided
  - [ ] Access to the website cannot be granted. Please find the video-recording / screenshots attached
  - **Note**: Will provide access once API is functional

### Comparison Diagram
- [ ] We can not provide a diagram
- [ ] Yes, please find the diagram attached to the email
  - **Status**: Will create once integration is tested

### Testing
- [ ] Upsells Booking - **PLANNED**: Will implement if required
- [ ] Multiroom booking - **PLANNED**: Will implement
- [ ] Booking with child - **PLANNED**: Will implement
- [ ] All unusual cases from our perspective

---

## Payment Types

### Selected Payment Type
- [x] **"deposit"** - Payment comes from partner's deposit (B2B API)
- [ ] "hotel" - Payment at the hotel (Affiliate API)
- [ ] "now" - ETG charges the card

**Rationale**: We will use deposit-based payments for B2B model

---

## IP Whitelisting

### IP Addresses
- [ ] Yes, here are our IP addresses: **TO BE PROVIDED**
- [x] **We use dynamic IP addresses**
  - **Note**: Will provide static IPs if required for production

---

## Required Endpoints for Implementation

### Currently Implemented Endpoints

| Endpoint | Status | Notes |
|----------|--------|-------|
| `/api/b2b/v3/search/multicomplete` | ✅ Implemented | For location/region search |
| `/api/b2b/v3/search/serp/region` | ✅ Implemented | Hotel search by region |
| `/api/b2b/v3/search/hp` | ✅ Implemented | Hotel page/details |
| `/api/b2b/v3/hotel/prebook` | ✅ Implemented | Rate verification before booking |
| `/api/b2b/v3/hotel/order/booking/form` | ✅ Implemented | Booking form submission |
| `/api/b2b/v3/hotel/order/booking/finish` | ✅ Implemented | Finalize booking |
| `/api/b2b/v3/hotel/order/booking/finish/status` | ✅ Implemented | Check booking status |
| `/api/b2b/v3/hotel/info` | ✅ Implemented | Hotel details |
| `/api/b2b/v3/hotel/order/cancel` | ✅ Implemented | Cancel booking |

### Planned for Implementation

| Endpoint | Status | Priority |
|----------|--------|----------|
| `/api/b2b/v3/hotel/info/dump` | 📋 Planned | High - For static data |
| `/api/b2b/v3/hotel/info/incremental_dump` | 📋 Planned | Medium - For daily updates |

---

## Static Data

### Hotel Static Data Upload and Updates
- [ ] We will update using "Retrieve hotel dump" method
- [ ] We will update using "Retrieve hotel incremental dump" method
- [x] **We will update using both methods**
  - Weekly: Full dump
  - Daily: Incremental updates
- [ ] We use Content API

**Update Frequency**:
- Full dump: **Weekly**
- Incremental: **Daily**

### Region Data Updates
- [x] We use "Retrieve hotel dump" and get region ids from this file
- [ ] We use Content API

**Update Frequency**: **Weekly**

### Number of Mapped Hotels/Regions
- [x] **All hotels** - We will map all available hotels
- [x] **All regions** - We will map all available regions

### Hotel Important Information
- [x] **Yes, we parse and display data from "metapolicy_struct" and "metapolicy_extra_info" parameters**

### Room Static Data
- [x] **Yes, we show room images and amenities**
- **Matching parameter**: "room_name" and "room_group_id"

---

## Search Step

### Search Flow
- [x] **3-steps search**
  1. Search for hotels
  2. View hotel details and select room
  3. Prebook to verify rate before booking

### Match_hash Usage
- [x] **Yes, we use "match_hash"**
  - **Logic**: Used to identify specific rate/room combinations throughout the booking flow

### Prebook Rate
- [x] **Yes, we use "Prebook rate from hotelpage step"**
- [x] **Yes, it is a separate step** (between hotel selection and booking)
- [ ] "price_increase_percent" is supported - **PLANNED**
- [x] **Prebook implemented according to ETG timeout limitation (60s)**

### Cache
- [x] **We don't cache** search results
  - **Rationale**: Real-time pricing is critical for hotel bookings

### Children Logic
- [x] **Yes, we accommodate children up to and including 17 years of age**
- **Age specification**: Age is specified in all search requests within [] under "guests" > "children" parameter

### Multiroom Booking
- [ ] No, we do not work with multiroom-booking
- [x] **Yes, we support multiroom-booking of both the same and different room types**
  - **Status**: Implementation in progress

### Tax and Fees Data
- [x] **We include all taxes (both included and excluded) in the total price**

### Dynamic Search Timeouts
- [x] **Yes** - "timeout" parameter included in search requests
- **Expected Search Timeout**: 30 seconds
- **Maximum Search Timeout**: 60 seconds

### Cancellation Policies
- [x] **Yes, we parse and display them from "cancellation_penalties"**
- [x] **No, we do not modify policies; we show them as they are**
- [x] **We convert the cancellation deadline time to the user's local timezone and show the user's local timezone in the interface**

### Lead Guest's Citizenship
- [x] **No, we do not request the citizenship data; in the search API requests, we send the default (hardcoded) value in the "residency" parameter**
  - **Default residency**: "ng" (Nigeria)
  - **Future plan**: Will add citizenship selection in Phase 2

### Meal Types
- [x] **We display ETG meal types as they are returned in the API search responses**
- **Parameter used**: "meal" from the API search responses

### Final Price
- [x] **"show_amount"** - This is the price displayed to customers

### Commission
- [x] **"Net" and commission are calculated on partner's end**

### Rate Name Reflection
- [x] **"room_name" from /search/hp/**
- [x] **We display ETG room names as they are**

### Early Check-in / Late Check-out (Upsells)
- [ ] Yes, we work with upsells
- [ ] No, we do not and will not work with upsells in the future
- [x] **We do not work with upsells for now, but we plan to integrate it at a later stage**

### Hotel Chunk Size
- **N/A** - We use /search/serp/region, not /search/serp/hotels

### Rates Filtration Logic
- [x] **We display only the cheapest rate from each supplier**
- [x] **ETG is the only supplier** (initially)

---

## Booking Step

### Test Bookings
- [ ] **PENDING**: Cannot create test bookings until API credentials are working
  - Will test: Multi-room booking
  - Will test: 2 Adults + 1 Child (5 y.o) in 1 room, and 2 adults in another room
  - Will test: Residency set to "uz"

### Receiving Final Booking Status
- [x] **Status OK in "Check booking process" (/order/booking/finish/status/)**
- **Endpoint used**: /order/booking/finish/status/
- **Webhook**: Not implemented yet - **PLANNED**

### Booking Cut-off
- **Expected Booking Timeout**: 60 seconds
- **Maximum Booking Timeout**: 120 seconds

### Errors and Statuses Processing Logic

#### /order/booking/finish/ Endpoint

| ETG API Status/Error | Frontend Status | Backend Logic |
|---------------------|-----------------|---------------|
| Status "ok" | "Processing" | Poll /finish/status/ for final status |
| 5xx status code | "Booking Failed" | Retry once, then show error |
| Error "timeout" | "Booking Timeout" | Retry once, then show error |
| Error "unknown" | "Booking Failed" | Log error, show generic message |
| Error "booking_form_expired" | "Session Expired" | Restart booking process |
| Error "rate_not_found" | "Rate Unavailable" | Return to hotel search |
| Error "return_path_required" | "System Error" | Log error, contact support |

#### /order/booking/finish/status/ Endpoint

| ETG API Status/Error | Frontend Status | Backend Logic |
|---------------------|-----------------|---------------|
| Status "ok" | "Booking Confirmed" | Save booking, send confirmation |
| Status "processing" | "Processing" | Continue polling |
| Error "timeout" | "Booking Timeout" | Show timeout message |
| Error "unknown" | "Booking Failed" | Show error message |
| 5xx status code | "System Error" | Retry, then show error |
| Error "block" | "Booking Blocked" | Show specific error |
| Error "charge" | "Payment Failed" | Show payment error |
| Error "3ds" | "3DS Failed" | Show 3DS error |
| Error "soldout" | "Sold Out" | Return to search |
| Error "provider" | "Provider Error" | Show provider error |
| Error "book_limit" | "Booking Limit" | Show limit error |
| Error "not_allowed" | "Not Allowed" | Show restriction error |
| Error "booking_finish_did_not_succeed" | "Booking Failed" | Show failure message |

### Confirmation Emails
- [x] **We send the guests' personal email address**

---

## Post-Booking

### Retrieve Bookings (/order/info)
- [x] **Yes** - Implemented
- **Purpose**: 
  - To confirm the final booking status
  - To allow users to get their booking details
- **When called**: After booking flow
- **Time gap**: 5 seconds after booking completion

---

## Current Implementation Status

### ✅ Completed
- Core API integration structure
- All main endpoints implemented
- Error handling and fallback mechanisms
- HTTP Basic Authentication
- Request/response transformation
- Mock data fallback for development

### 🔄 In Progress
- Waiting for API credentials activation
- Testing and validation
- Multi-room booking implementation
- Children age specification

### 📋 Planned
- Static data dump integration
- Incremental data updates
- Webhook implementation
- Upsells (early check-in/late checkout)
- IP whitelisting setup
- Production deployment

---

## Blockers

### Critical Blocker
**API Credentials Not Working**
- Status: 401 Unauthorized errors
- Impact: Cannot proceed with any testing
- Action Required: Ratehawk needs to activate sandbox credentials
- Email Sent: [Date to be filled]
- Response Expected: [Date to be filled]

---

## Next Steps

1. **Immediate** (Once credentials are working):
   - [ ] Test all API endpoints
   - [ ] Map test hotel (hid = 8473727)
   - [ ] Create test bookings
   - [ ] Verify all search flows

2. **Short Term** (1-2 weeks):
   - [ ] Implement static data dumps
   - [ ] Complete multi-room booking
   - [ ] Set up webhooks
   - [ ] Provide website access to Ratehawk

3. **Medium Term** (2-4 weeks):
   - [ ] Complete certification process
   - [ ] Implement any required adjustments
   - [ ] Prepare for production

4. **Production**:
   - [ ] Receive production credentials
   - [ ] Deploy to production
   - [ ] Go live

---

**Document Status**: DRAFT - To be finalized once API testing is complete  
**Last Updated**: November 17, 2025  
**Next Review**: After API credentials are activated
