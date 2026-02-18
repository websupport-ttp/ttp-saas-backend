# The Travel Place Backend API Documentation

## Overview

This is the REST API for The Travel Place (TTP) travel agency platform. The API provides comprehensive endpoints for managing travel services including flights, hotels, travel insurance, visa consultancy, user management, affiliate programs, and payment processing.

## Base URL

```
http://localhost:8080/api/v1
```

## Authentication

All protected endpoints require a JWT token in the Authorization header:

```
Authorization: Bearer <your-jwt-token>
```

## Performance & Caching

The API implements a comprehensive Redis-based caching system for optimal performance:

### Cache Layers

- **API Response Caching**: GET endpoints cached for 5 minutes (configurable)
- **Database Query Caching**: Frequently accessed queries cached for 10 minutes
- **Session Caching**: User sessions cached for 24 hours
- **Rate Limiting**: Redis-based rate limiting with sliding windows

### Cache Headers

Cached responses include these headers:

- `X-Cache`: HIT or MISS indicating cache status
- `X-Cache-Key`: The cache key used (for debugging)
- `Cache-Control`: Standard HTTP cache control directives

### Automatic Invalidation

Cache is automatically invalidated when:

- Data is created, updated, or deleted
- Related data changes (e.g., booking updates invalidate user cache)
- Manual invalidation via admin endpoints

### Performance Benefits

- **50-90% faster response times** for cached endpoints
- **60-80% reduction in database load** for frequently accessed data
- **2-3x increase in concurrent request capacity**

## User Roles

- `User`: Basic user with limited access
- `Business`: Business user with enhanced features
- `Staff`: Staff member with operational access
- `Manager`: Manager with administrative capabilities
- `Executive`: Executive with high-level access
- `Admin`: Full system access

## Environment Configuration

### Required Environment Variables

```bash
# Application
NODE_ENV=development
PORT=3003
CLIENT_URL=http://localhost:3000

# Database
MONGO_URI=mongodb://localhost:27017/the_travel_place
REDIS_URL=redis://localhost:6379

# JWT Authentication
JWT_ACCESS_SECRET=your-jwt-access-secret
JWT_ACCESS_LIFETIME=15m
JWT_REFRESH_SECRET=your-jwt-refresh-secret
JWT_REFRESH_LIFETIME=30d

# Email Service
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USERNAME=your-email@gmail.com
EMAIL_PASSWORD=your-app-password
EMAIL_FROM=your-email@gmail.com

# SMS/WhatsApp (Twilio)
TWILIO_ACCOUNT_SID=your-twilio-account-sid
TWILIO_AUTH_TOKEN=your-twilio-auth-token
TWILIO_PHONE_NUMBER=your-twilio-phone-number
TWILIO_WHATSAPP_NUMBER=your-twilio-whatsapp-number

# AWS S3 (File Storage)
AWS_REGION=your-aws-region
AWS_S3_BUCKET_NAME=your-s3-bucket-name
AWS_ACCESS_KEY_ID=your-aws-access-key
AWS_SECRET_ACCESS_KEY=your-aws-secret-key

# Payment Processing (Paystack)
PAYSTACK_SECRET_KEY=your-paystack-secret-key
PAYSTACK_PUBLIC_KEY=your-paystack-public-key

# Flight Services (Amadeus XML)
AMADEUS_XML_ENDPOINT=your-amadeus-xml-endpoint
AMADEUS_XML_USERNAME=your-amadeus-username
AMADEUS_XML_PASSWORD=your-amadeus-password
AMADEUS_XML_OFFICE_ID=your-amadeus-office-id
```

### Optional Features

- **Redis**: Enables caching and improved performance
- **AWS S3**: File storage for documents and images
- **Twilio**: SMS and WhatsApp notifications
- **Email**: Automated email notifications

## API Endpoints

### Authentication

| Method | Endpoint                          | Description                  | Access  |
| ------ | --------------------------------- | ---------------------------- | ------- |
| POST   | `/auth/register`                  | Register a new user          | Public  |
| POST   | `/auth/login`                     | Login user                   | Public  |
| POST   | `/auth/logout`                    | Logout user                  | Private |
| POST   | `/auth/google`                    | Google OAuth login/register  | Public  |
| POST   | `/auth/forgot-password`           | Request password reset       | Public  |
| PUT    | `/auth/reset-password`            | Reset password with token    | Public  |
| GET    | `/auth/verify-email`              | Verify email address         | Public  |
| POST   | `/auth/verify-phone`              | Verify phone number with OTP | Public  |
| POST   | `/auth/resend-email-verification` | Resend email verification    | Private |
| POST   | `/auth/resend-phone-verification` | Resend phone verification    | Private |

### Users

| Method | Endpoint          | Description              | Access  |
| ------ | ----------------- | ------------------------ | ------- |
| GET    | `/users/me`       | Get current user profile | Private |
| PUT    | `/users/me`       | Update user profile      | Private |
| GET    | `/users`          | Get all users            | Admin   |
| GET    | `/users/:id`      | Get user by ID           | Admin   |
| DELETE | `/users/:id`      | Delete user              | Admin   |
| PUT    | `/users/:id/role` | Update user role         | Admin   |

### Products & Services

#### Service Charges (Admin Only)

| Method | Endpoint                          | Description                    | Access |
| ------ | --------------------------------- | ------------------------------ | ------ |
| GET    | `/products/service-charges`       | Get all service charges        | Admin  |
| PUT    | `/products/service-charges/:name` | Update specific service charge | Admin  |

#### Travel Insurance

| Method | Endpoint                                         | Description                   | Access  |
| ------ | ------------------------------------------------ | ----------------------------- | ------- |
| GET    | `/products/travel-insurance/lookup/:type`        | Get Allianz lookup data       | Public  |
| POST   | `/products/travel-insurance/quote`               | Get travel insurance quote    | Public  |
| POST   | `/products/travel-insurance/purchase/individual` | Purchase individual insurance | Private |
| POST   | `/products/travel-insurance/purchase/family`     | Purchase family insurance     | Private |

#### Flights

| Method | Endpoint                           | Description           | Access  |
| ------ | ---------------------------------- | --------------------- | ------- |
| POST   | `/products/flights/search`         | Search for flights    | Public  |
| POST   | `/products/flights/book`           | Book a flight         | Private |
| POST   | `/products/flights/verify-payment` | Verify flight payment | Public  |

#### Hotels

| Method | Endpoint                         | Description              | Access  | Status |
| ------ | -------------------------------- | ------------------------ | ------- | ------ |
| POST   | `/products/hotels/search`        | Search for hotels        | Public  | ✅ Fully Implemented |
| POST   | `/products/hotels/book`          | Book a hotel             | Private | ✅ Fully Implemented |
| POST   | `/products/hotels/verify-payment`| Verify hotel payment     | Public  | ✅ Fully Implemented |

**✅ Note**: Hotel functionality is now fully implemented with Ratehawk API integration.

#### Travel Packages

| Method | Endpoint                            | Description            | Access  |
| ------ | ----------------------------------- | ---------------------- | ------- |
| GET    | `/products/packages`                | Get available packages | Public  |
| GET    | `/products/packages/:id`            | Get package details    | Public  |
| POST   | `/products/packages/:id/purchase`   | Purchase a package     | Private |
| POST   | `/products/packages/verify-payment` | Verify package payment | Public  |

#### Visa Consultancy

| Method | Endpoint                              | Description                     | Access  |
| ------ | ------------------------------------- | ------------------------------- | ------- |
| POST   | `/products/visa/apply`                | Submit visa application         | Private |
| POST   | `/products/visa/:id/upload-document`  | Upload visa document            | Private |
| GET    | `/products/visa/:id`                  | Get visa application details    | Private |
| PUT    | `/products/visa/:id/status`           | Update visa application status  | Admin   |
| POST   | `/products/visa/:id/payment`          | Process visa payment            | Private |
| POST   | `/products/visa/verify-payment`       | Verify visa payment             | Public  |
| GET    | `/products/visa/requirements`         | Get visa requirements           | Public  |
| POST   | `/products/visa/calculate-fees`       | Calculate visa application fees | Public  |
| GET    | `/products/visa/processing-centers`   | Get visa processing centers     | Public  |
| POST   | `/products/visa/schedule-appointment` | Schedule visa appointment       | Private |
| GET    | `/products/visa/:id/status`           | Check visa application status   | Private |

### Bookings

| Method | Endpoint                       | Description              | Access  |
| ------ | ------------------------------ | ------------------------ | ------- |
| POST   | `/bookings/flights/search`     | Search flights           | Public  |
| POST   | `/bookings/flights/book`       | Book flight              | Private |
| POST   | `/bookings/hotels/search`      | Search hotels            | Public  |
| POST   | `/bookings/hotels/book`        | Book hotel               | Private |
| POST   | `/bookings/visa/apply`         | Apply for visa           | Private |
| POST   | `/bookings/insurance/quote`    | Get insurance quote      | Public  |
| POST   | `/bookings/insurance/purchase` | Purchase insurance       | Private |
| POST   | `/bookings/payment/verify`     | Verify payment           | Private |
| GET    | `/bookings`                    | Get user bookings        | Private |
| GET    | `/bookings/:reference`         | Get booking by reference | Private |

### Affiliate Program

| Method | Endpoint                        | Description                   | Access      |
| ------ | ------------------------------- | ----------------------------- | ----------- |
| POST   | `/affiliates`                   | Create affiliate account      | Private     |
| GET    | `/affiliates`                   | Get all affiliates            | Admin       |
| GET    | `/affiliates/me`                | Get current affiliate profile | Affiliate   |
| PUT    | `/affiliates/me`                | Update affiliate profile      | Affiliate   |
| GET    | `/affiliates/:id`               | Get affiliate by ID           | Admin       |
| PUT    | `/affiliates/:id/status`        | Update affiliate status       | Admin       |
| GET    | `/affiliates/:id/statistics`    | Get affiliate statistics      | Admin/Owner |
| POST   | `/affiliates/:id/generate-code` | Generate new referral code    | Admin/Owner |

### Wallet Management

| Method | Endpoint                             | Description                  | Access      |
| ------ | ------------------------------------ | ---------------------------- | ----------- |
| POST   | `/wallets`                           | Create wallet for affiliate  | Admin       |
| GET    | `/wallets/:affiliateId/balance`      | Get wallet balance           | Owner/Admin |
| POST   | `/wallets/:affiliateId/credit`       | Credit wallet                | Admin       |
| POST   | `/wallets/:affiliateId/debit`        | Debit wallet                 | Admin       |
| GET    | `/wallets/:affiliateId/transactions` | Get transaction history      | Owner/Admin |
| POST   | `/wallets/:affiliateId/freeze`       | Freeze wallet                | Admin       |
| POST   | `/wallets/:affiliateId/unfreeze`     | Unfreeze wallet              | Admin       |
| POST   | `/wallets/:affiliateId/suspend`      | Suspend wallet               | Admin       |
| GET    | `/wallets/:affiliateId/validate`     | Validate wallet              | Owner/Admin |
| PUT    | `/wallets/:affiliateId/bank-details` | Update bank details          | Owner/Admin |
| GET    | `/wallets/:affiliateId/statistics`   | Get wallet statistics        | Owner/Admin |
| POST   | `/wallets/transactions/:id/reverse`  | Reverse transaction          | Admin       |
| GET    | `/wallets/system/statistics`         | Get system wallet statistics | Admin       |
| POST   | `/wallets/bulk-operations`           | Perform bulk operations      | Admin       |
| GET    | `/wallets/:affiliateId/health`       | Check wallet health          | Admin       |

### Messages & Communication

| Method | Endpoint              | Description          | Access  |
| ------ | --------------------- | -------------------- | ------- |
| GET    | `/messages`           | Get user messages    | Private |
| POST   | `/messages`           | Send message         | Private |
| GET    | `/messages/:id`       | Get message by ID    | Private |
| PUT    | `/messages/:id`       | Update message       | Private |
| DELETE | `/messages/:id`       | Delete message       | Private |
| POST   | `/messages/:id/reply` | Reply to message     | Private |
| PUT    | `/messages/:id/read`  | Mark message as read | Private |

### Posts & Content

| Method | Endpoint             | Description      | Access  |
| ------ | -------------------- | ---------------- | ------- |
| GET    | `/posts`             | Get all posts    | Public  |
| POST   | `/posts`             | Create new post  | Staff+  |
| GET    | `/posts/:id`         | Get post by ID   | Public  |
| PUT    | `/posts/:id`         | Update post      | Staff+  |
| DELETE | `/posts/:id`         | Delete post      | Staff+  |
| POST   | `/posts/:id/like`    | Like/unlike post | Private |
| POST   | `/posts/:id/comment` | Comment on post  | Private |

### Categories

| Method | Endpoint          | Description        | Access |
| ------ | ----------------- | ------------------ | ------ |
| GET    | `/categories`     | Get all categories | Public |
| POST   | `/categories`     | Create category    | Admin  |
| GET    | `/categories/:id` | Get category by ID | Public |
| PUT    | `/categories/:id` | Update category    | Admin  |
| DELETE | `/categories/:id` | Delete category    | Admin  |

### Analytics & Reporting

| Method | Endpoint                 | Description             | Access     |
| ------ | ------------------------ | ----------------------- | ---------- |
| GET    | `/analytics/dashboard`   | Get dashboard analytics | Manager+   |
| GET    | `/analytics/bookings`    | Get booking analytics   | Manager+   |
| GET    | `/analytics/revenue`     | Get revenue analytics   | Executive+ |
| GET    | `/analytics/users`       | Get user analytics      | Manager+   |
| GET    | `/analytics/affiliates`  | Get affiliate analytics | Manager+   |
| GET    | `/analytics/performance` | Get performance metrics | Manager+   |

### QR Code Generation

| Method | Endpoint             | Description       | Access  |
| ------ | -------------------- | ----------------- | ------- |
| POST   | `/qr-codes/generate` | Generate QR code  | Private |
| GET    | `/qr-codes/:id`      | Get QR code by ID | Private |
| DELETE | `/qr-codes/:id`      | Delete QR code    | Private |

### Reference Data

| Method | Endpoint                | Description         | Access |
| ------ | ----------------------- | ------------------- | ------ |
| GET    | `/reference/countries`  | Get countries list  | Public |
| GET    | `/reference/airports`   | Get airports list   | Public |
| GET    | `/reference/airlines`   | Get airlines list   | Public |
| GET    | `/reference/currencies` | Get currencies list | Public |

### Health Monitoring

| Method | Endpoint                       | Description                 | Access   |
| ------ | ------------------------------ | --------------------------- | -------- |
| GET    | `/health`                      | Get overall system health   | Public   |
| GET    | `/health/service/:serviceName` | Get specific service health | Public   |
| GET    | `/health/metrics`              | Get performance metrics     | Manager+ |
| GET    | `/health/system`               | Get system information      | Public   |
| DELETE | `/health/metrics/clear`        | Clear performance metrics   | Admin    |
| GET    | `/health/liveness`             | Liveness probe              | Public   |
| GET    | `/health/readiness`            | Readiness probe             | Public   |

## Request/Response Examples

### Authentication

#### Register User

```http
POST /api/v1/auth/register
Content-Type: application/json

{
  "firstName": "John",
  "lastName": "Doe",
  "otherNames": "Michael",
  "email": "john.doe@example.com",
  "phoneNumber": "+2348012345678",
  "password": "SecurePassword123!",
  "role": "User"
}
```

Response:

```json
{
	"status": "success",
	"message": "User registered successfully. Please verify your email and phone number.",
	"data": {
		"user": {
			"_id": "64a1b2c3d4e5f6789012345",
			"firstName": "John",
			"lastName": "Doe",
			"email": "john.doe@example.com",
			"phoneNumber": "+2348012345678",
			"role": "User",
			"isEmailVerified": false,
			"isPhoneVerified": false,
			"createdAt": "2024-01-15T10:00:00.000Z"
		},
		"tokens": {
			"accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
			"refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
		}
	}
}
```

#### Login User

```http
POST /api/v1/auth/login
Content-Type: application/json

{
  "email": "john.doe@example.com",
  "password": "SecurePassword123!"
}
```

Response:

```json
{
	"status": "success",
	"message": "Login successful",
	"data": {
		"user": {
			"_id": "64a1b2c3d4e5f6789012345",
			"firstName": "John",
			"lastName": "Doe",
			"email": "john.doe@example.com",
			"role": "User",
			"isEmailVerified": true,
			"isPhoneVerified": true
		},
		"tokens": {
			"accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
			"refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
		}
	}
}
```

### Flight Search

```http
POST /api/v1/products/flights/search
Content-Type: application/json

{
  "originLocationCode": "LOS",
  "destinationLocationCode": "JFK",
  "departureDate": "2024-12-15",
  "returnDate": "2024-12-22",
  "adults": 2,
  "children": 1,
  "infants": 0,
  "currencyCode": "NGN",
  "travelClass": "ECONOMY",
  "nonStop": false,
  "max": 50
}
```

Response:

```json
{
	"status": "success",
	"message": "Flight search completed successfully",
	"data": {
		"meta": {
			"count": 25,
			"currency": "NGN"
		},
		"data": [
			{
				"type": "flight-offer",
				"id": "1",
				"source": "GDS",
				"instantTicketingRequired": false,
				"nonHomogeneous": false,
				"oneWay": false,
				"lastTicketingDate": "2024-12-10",
				"numberOfBookableSeats": 9,
				"itineraries": [
					{
						"duration": "PT15H30M",
						"segments": [
							{
								"departure": {
									"iataCode": "LOS",
									"terminal": "1",
									"at": "2024-12-15T10:30:00"
								},
								"arrival": {
									"iataCode": "JFK",
									"terminal": "4",
									"at": "2024-12-16T06:00:00"
								},
								"carrierCode": "DL",
								"number": "156",
								"aircraft": {
									"code": "763"
								},
								"duration": "PT10H30M",
								"id": "1",
								"numberOfStops": 0
							}
						]
					}
				],
				"price": {
					"currency": "NGN",
					"total": "850000.00",
					"base": "750000.00",
					"fees": [
						{
							"amount": "50000.00",
							"type": "SUPPLIER"
						}
					],
					"grandTotal": "855000.00"
				},
				"travelerPricings": [
					{
						"travelerId": "1",
						"fareOption": "STANDARD",
						"travelerType": "ADULT",
						"price": {
							"currency": "NGN",
							"total": "425000.00",
							"base": "375000.00"
						}
					}
				]
			}
		],
		"dictionaries": {
			"locations": {
				"JFK": {
					"cityCode": "NYC",
					"countryCode": "US"
				},
				"LOS": {
					"cityCode": "LOS",
					"countryCode": "NG"
				}
			},
			"aircraft": {
				"763": "BOEING 767-300"
			},
			"currencies": {
				"NGN": "NIGERIAN NAIRA"
			},
			"carriers": {
				"DL": "DELTA AIR LINES"
			}
		}
	}
}
```

### Book Flight

```http
POST /api/v1/products/flights/book
Authorization: Bearer <token>
Content-Type: application/json

{
  "flightDetails": {
    "id": "1",
    "price": 855000,
    "currency": "NGN",
    "itineraries": [
      {
        "segments": [
          {
            "departure": {
              "iataCode": "LOS",
              "at": "2024-12-15T10:30:00"
            },
            "arrival": {
              "iataCode": "JFK",
              "at": "2024-12-16T06:00:00"
            },
            "carrierCode": "DL",
            "number": "156"
          }
        ]
      }
    ]
  },
  "passengerDetails": [
    {
      "id": "1",
      "dateOfBirth": "1990-05-15",
      "name": {
        "firstName": "John",
        "lastName": "Doe"
      },
      "gender": "MALE",
      "contact": {
        "emailAddress": "john.doe@example.com",
        "phones": [
          {
            "deviceType": "MOBILE",
            "countryCallingCode": "234",
            "number": "8012345678"
          }
        ]
      },
      "documents": [
        {
          "documentType": "PASSPORT",
          "number": "A12345678",
          "expiryDate": "2030-05-15",
          "issuanceCountry": "NG",
          "nationality": "NG",
          "holder": true
        }
      ]
    }
  ],
  "paymentDetails": {
    "email": "john.doe@example.com",
    "currency": "NGN",
    "callback_url": "https://yourapp.com/payment/callback"
  }
}
```

Response:

```json
{
	"status": "success",
	"message": "Flight booking initiated successfully. Please complete payment to confirm booking.",
	"data": {
		"bookingReference": "TTP-FL-1678888888888",
		"authorizationUrl": "https://checkout.paystack.com/mock_auth_url",
		"paymentReference": "TTP-FL-PAY-1678888888888",
		"amount": 860000,
		"currency": "NGN",
		"expiresAt": "2024-12-15T11:30:00Z",
		"passengers": [
			{
				"id": "1",
				"name": {
					"firstName": "John",
					"lastName": "Doe"
				}
			}
		],
		"flightDetails": {
			"id": "1",
			"price": {
				"total": "855000.00",
				"currency": "NGN"
			}
		},
		"serviceCharges": {
			"flightBookingCharges": 5000
		},
		"instructions": {
			"payment": "Complete payment within 30 minutes to confirm booking",
			"documents": "Ensure passport is valid for at least 6 months from travel date"
		}
	}
}
```

### Travel Insurance Quote

```http
POST /api/v1/products/travel-insurance/quote
Content-Type: application/json

{
  "DateOfBirth": "14-Nov-2000",
  "Email": "john.doe@example.com",
  "Telephone": "08034635116",
  "CoverBegins": "14-Oct-2024",
  "CoverEnds": "30-Oct-2024",
  "CountryId": 110,
  "PurposeOfTravel": "Leisure",
  "TravelPlanId": 1,
  "BookingTypeId": 1,
  "IsRoundTrip": false,
  "NoOfPeople": 1,
  "NoOfChildren": 0,
  "IsMultiTrip": false
}
```

Response:

```json
{
	"status": "success",
	"message": "Travel insurance quote generated successfully",
	"data": {
		"quoteId": 700,
		"premium": 8467,
		"currency": "NGN",
		"coverageDetails": {
			"medicalExpenses": 50000,
			"tripCancellation": 25000,
			"baggageLoss": 10000,
			"personalAccident": 100000
		},
		"validUntil": "2024-10-07T23:59:59Z",
		"terms": "Quote valid for 7 days from generation date"
	}
}
```

### Hotel Search

```http
POST /api/v1/products/hotels/search
Content-Type: application/json

{
  "destination": "Lagos",
  "checkInDate": "2024-12-15",
  "checkOutDate": "2024-12-18",
  "adults": 2,
  "children": 0,
  "currency": "NGN"
}
```

Response (Ratehawk API):

```json
{
	"status": "success",
	"message": "Hotels fetched successfully",
	"data": {
		"searchId": "search_abc123def456",
		"hotels": [
			{
				"id": "12345",
				"name": "Eko Hotel & Suites",
				"address": "1415 Adetokunbo Ademola Street, Victoria Island, Lagos",
				"stars": 5,
				"rating": 4.3,
				"reviewCount": 1250,
				"images": ["https://example.com/hotel1.jpg"],
				"amenities": ["WiFi", "Pool", "Gym", "Restaurant"],
				"rooms": [
					{
						"id": "room_hash_abc123",
						"name": "Deluxe Room",
						"price": 185000,
						"currency": "NGN",
						"cancellationPolicy": "Free cancellation until 24 hours before check-in",
						"breakfast": "Included",
						"bedding": "King Bed"
					}
				],
				"location": {
					"latitude": 6.4281,
					"longitude": 3.4219
				}
			}
		],
		"totalResults": 25,
		"searchCriteria": {
			"destination": "Lagos",
			"checkInDate": "2024-12-15",
			"checkOutDate": "2024-12-18",
			"adults": 2
		}
	}
}
```

### Hotel Booking

```http
POST /api/v1/products/hotels/book
Authorization: Bearer <token>
Content-Type: application/json

{
  "hotelDetails": {
    "id": "12345",
    "name": "Eko Hotel & Suites",
    "price": 185000,
    "currency": "NGN",
    "checkInDate": "2024-12-15",
    "checkOutDate": "2024-12-18",
    "roomName": "Deluxe Room"
  },
  "guestDetails": {
    "firstName": "John",
    "lastName": "Doe",
    "email": "john.doe@example.com",
    "phoneNumber": "+2348012345678"
  },
  "paymentDetails": {
    "email": "john.doe@example.com",
    "currency": "NGN",
    "callback_url": "https://yourapp.com/payment/callback"
  },
  "searchId": "search_abc123def456",
  "roomId": "room_hash_abc123"
}
```

Response:

```json
{
	"status": "success",
	"message": "Hotel booking initiated. Please complete payment to confirm reservation.",
	"data": {
		"bookingReference": "TTP-HTL-1678888888888",
		"authorizationUrl": "https://checkout.paystack.com/abc123def456",
		"paymentReference": "TTP-HTL-PAY-1678888888888",
		"amount": 188000,
		"currency": "NGN",
		"expiresAt": "2024-12-15T11:30:00Z",
		"hotelDetails": {
			"id": "12345",
			"name": "Eko Hotel & Suites",
			"checkIn": "2024-12-15",
			"checkOut": "2024-12-18",
			"roomType": "Deluxe Room"
		},
		"guestDetails": {
			"name": "John Doe",
			"email": "john.doe@example.com",
			"phone": "+2348012345678"
		},
		"serviceCharges": {
			"hotelReservationCharges": 3000
		},
		"instructions": {
			"payment": "Complete payment within 30 minutes to confirm hotel reservation",
			"cancellation": "Cancellation policy depends on hotel terms and conditions"
		}
	}
}
```

### Hotel Payment Verification

```http
POST /api/v1/products/hotels/verify-payment
Content-Type: application/json

{
  "reference": "TTP-HTL-PAY-1678888888888"
}
```

Response:

```json
{
	"status": "success",
	"message": "Hotel payment verified and booking confirmed",
	"data": {
		"paymentStatus": "success",
		"transactionReference": "TTP-HTL-PAY-1678888888888",
		"amountPaid": 188000,
		"currency": "NGN",
		"paidAt": "2024-12-15T10:45:00Z",
		"applicationStatus": "Booking Confirmed",
		"bookingReference": "RATEHAWK-HTL-789012345",
		"hotelDetails": {
			"name": "Eko Hotel & Suites",
			"checkIn": "2024-12-15",
			"checkOut": "2024-12-18",
			"guestName": "John Doe"
		},
		"nextSteps": "Your hotel reservation has been successfully confirmed. You will receive your booking confirmation via email shortly."
	}
}
```

### Get User Profile

```http
GET /api/v1/users/me
Authorization: Bearer <token>
```

Response:

```json
{
	"status": "success",
	"message": "User profile retrieved successfully",
	"data": {
		"user": {
			"_id": "64a1b2c3d4e5f6789012345",
			"firstName": "John",
			"lastName": "Doe",
			"otherNames": "Michael",
			"email": "john.doe@example.com",
			"phoneNumber": "+2348012345678",
			"role": "User",
			"isEmailVerified": true,
			"isPhoneVerified": true,
			"createdAt": "2024-01-15T10:00:00.000Z",
			"updatedAt": "2024-01-15T10:00:00.000Z"
		}
	}
}
```

### Health Check

```http
GET /health
```

Response (Healthy):

```json
{
	"status": "success",
	"data": {
		"status": "healthy",
		"timestamp": "2024-01-15T12:00:00.000Z",
		"summary": {
			"total": 8,
			"healthy": 8,
			"degraded": 0,
			"unhealthy": 0,
			"criticalIssues": 0,
			"warnings": 0
		},
		"services": {
			"database": {
				"status": "healthy",
				"responseTime": 15,
				"details": {
					"connected": true,
					"readyState": 1
				}
			},
			"redis": {
				"status": "healthy",
				"responseTime": 8,
				"details": {
					"connected": true,
					"memory": "2.3MB"
				}
			},
			"paystack": {
				"status": "healthy",
				"responseTime": 120,
				"details": {
					"apiAccessible": true
				}
			},
			"amadeus": {
				"status": "healthy",
				"responseTime": 200,
				"details": {
					"xmlEndpointAccessible": true
				}
			},
			"s3": {
				"status": "healthy",
				"responseTime": 95,
				"details": {
					"bucketAccessible": true
				}
			},
			"allianz": {
				"status": "healthy",
				"responseTime": 180,
				"details": {
					"apiAccessible": true
				}
			},
			"system": {
				"status": "healthy",
				"responseTime": 5,
				"details": {
					"memoryUsage": "45%",
					"cpuUsage": "12%",
					"uptime": 3600
				}
			}
		}
	}
}
```

## Error Handling

### Standard HTTP Status Codes

| Code | Description           | Usage                                             |
| ---- | --------------------- | ------------------------------------------------- |
| 200  | OK                    | Successful GET, PUT, PATCH requests               |
| 201  | Created               | Successful POST requests                          |
| 400  | Bad Request           | Validation errors, malformed requests             |
| 401  | Unauthorized          | Missing or invalid authentication token           |
| 403  | Forbidden             | Insufficient permissions for the requested action |
| 404  | Not Found             | Resource not found                                |
| 409  | Conflict              | Resource already exists or constraint violation   |
| 422  | Unprocessable Entity  | Business logic validation errors                  |
| 429  | Too Many Requests     | Rate limit exceeded                               |
| 500  | Internal Server Error | Server-side errors                                |
| 503  | Service Unavailable   | External service unavailable (Redis, S3, etc.)    |

### Error Response Format

All error responses follow this consistent format:

```json
{
	"status": "error",
	"message": "Error message describing what went wrong",
	"code": "ERROR_CODE",
	"details": {
		"field": "Additional error details",
		"timestamp": "2024-01-15T20:00:00.000Z"
	}
}
```

### Common Error Examples

#### Validation Error (400)

```json
{
	"status": "error",
	"message": "Validation failed",
	"code": "VALIDATION_ERROR",
	"details": {
		"firstName": "First name is required",
		"email": "Email must be a valid email address"
	}
}
```

#### Authentication Error (401)

```json
{
	"status": "error",
	"message": "Authentication required",
	"code": "AUTH_REQUIRED",
	"details": {
		"message": "Please provide a valid JWT token"
	}
}
```

#### Permission Error (403)

```json
{
	"status": "error",
	"message": "Insufficient permissions",
	"code": "FORBIDDEN",
	"details": {
		"required_role": "Admin",
		"user_role": "User"
	}
}
```

#### Rate Limit Error (429)

```json
{
	"status": "error",
	"message": "Rate limit exceeded",
	"code": "RATE_LIMIT_EXCEEDED",
	"details": {
		"limit": 100,
		"window": "1 hour",
		"retry_after": 3600
	}
}
```

## API Versioning

The current API version is v1. Future versions will be supported through URL versioning:

- Current: `/api/v1/endpoint`
- Future: `/api/v2/endpoint`

Breaking changes will result in a new API version, while backward-compatible changes will be added to the current version.

## Rate Limiting

API endpoints are rate-limited to ensure fair usage:

### Default Limits

- **Authenticated users**: 1000 requests per hour
- **Unauthenticated users**: 100 requests per hour
- **Authentication endpoints**: 50 requests per hour
- **Payment operations**: 200 requests per hour
- **File uploads**: 50 requests per hour
- **Admin operations**: 500 requests per hour

### Rate Limit Headers

```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1642248000
```

## Data Validation

### Input Validation Rules

#### User Data

- **Email**: Valid email format, unique across system
- **Names**: 1-50 characters, letters and spaces only
- **Phone**: Valid international format (E.164)
- **Passwords**: Minimum 8 characters with complexity requirements

#### Flight Data

- **IATA Codes**: 3-letter airport codes (e.g., LOS, JFK)
- **Dates**: Valid future dates in YYYY-MM-DD format
- **Passengers**: 1-9 adults, 0-9 children, 0-9 infants
- **Currency**: Supported currencies (NGN, USD, EUR, GBP)

#### Payment Data

- **Amount**: Positive numbers with 2 decimal places
- **Currency**: Valid currency codes
- **Reference**: Unique transaction references

### File Upload Validation

- **Profile Pictures**: Max 2MB, JPEG/PNG only
- **Documents**: Max 10MB, PDF/JPEG/PNG
- **General Files**: Max 10MB, various formats allowed

## Security Considerations

### Authentication & Authorization

- JWT tokens with configurable expiration
- Role-based access control (RBAC)
- Complete profile requirement for sensitive operations
- Multi-factor authentication support

### Data Protection

- Input sanitization and validation
- SQL injection prevention (using Mongoose ODM)
- XSS protection through proper encoding
- CORS configuration for cross-origin requests

### File Upload Security

- File type validation by MIME type and extension
- File size limits to prevent DoS attacks
- Virus scanning (recommended for production)
- Secure file storage with access controls

### API Security

- Rate limiting to prevent abuse
- Request logging for audit trails
- Error message sanitization
- HTTPS enforcement (recommended for production)

## Integration Partners

### Payment Processing

- **Paystack**: Primary payment gateway for Nigerian market
- Support for multiple currencies (NGN, USD, GHS, ZAR, KES)
- Webhook integration for payment verification

### Flight Services

- **Amadeus XML API**: Flight search and booking
- Real-time availability and pricing
- Global airline coverage

### Travel Insurance

- **Allianz Travel Insurance**: Comprehensive travel insurance
- Individual and family plans
- Multiple coverage options

### Communication Services

- **Twilio**: SMS and WhatsApp notifications
- **Nodemailer**: Email notifications
- Multi-channel communication support

### File Storage

- **AWS S3**: Secure file storage and management
- Presigned URLs for direct uploads
- Automatic file organization

## Monitoring & Observability

### Health Monitoring

- Comprehensive health checks for all services
- Performance metrics collection
- System resource monitoring
- Automated alerting capabilities

### Logging

- Structured logging with Winston
- Request/response logging
- Error tracking and reporting
- Security event logging

### Performance Monitoring

- Response time tracking
- Error rate monitoring
- Cache hit rate analysis
- Database query performance

## Development & Testing

### API Documentation

- Interactive Swagger/OpenAPI documentation available at `/api-docs`
- Comprehensive endpoint documentation including **Hotel APIs**
- Request/response examples with real Ratehawk API data
- Schema definitions for all hotel booking workflows
- Complete OpenAPI 3.0 specifications

### Testing

- Automated test suite with Jest
- Performance testing with Autocannon
- Load testing capabilities
- Health check validation

### Development Tools

- Hot reload with Nodemon
- Environment-specific configurations
- Database seeding scripts
- Migration utilities

## Implementation Status

### Hotel Services ✅

The hotel booking functionality is now **fully implemented** with Ratehawk API integration:

#### What's Implemented:
- ✅ **API Routes**: `/products/hotels/search`, `/products/hotels/book`, and `/products/hotels/verify-payment`
- ✅ **Controller Functions**: Complete `searchHotels`, `bookHotel`, and `verifyHotelPayment` implementations
- ✅ **Ratehawk Service**: Full WorldOTA/Ratehawk API integration with real hotel data
- ✅ **Validation Schemas**: Request validation for hotel search and booking
- ✅ **Payment Integration**: Complete Paystack payment flow with verification
- ✅ **Database Models**: Ledger entries for hotel bookings with full tracking
- ✅ **Notification System**: Email and SMS confirmations for bookings
- ✅ **Error Handling**: Comprehensive error handling with fallback mechanisms

#### Environment Variables Required:
```bash
RATEHAWK_BASE_URL=https://api.worldota.net
RATEHAWK_API_KEY_ID=44
RATEHAWK_API_ACCESS_TOKEN=your_access_token_here
```

#### Current Behavior:
```javascript
// Real hotel search response from Ratehawk API
{
  "status": "success",
  "message": "Hotels fetched successfully",
  "data": {
    "searchId": "abc123",
    "hotels": [
      {
        "id": "12345",
        "name": "Eko Hotel & Suites",
        "address": "1415 Adetokunbo Ademola Street, Victoria Island, Lagos",
        "stars": 5,
        "rating": 4.3,
        "reviewCount": 1250,
        "rooms": [
          {
            "id": "room_hash_123",
            "name": "Deluxe Room",
            "price": 185000,
            "currency": "NGN",
            "breakfast": "Included"
          }
        ]
      }
    ],
    "totalResults": 25
  }
}
```

#### Booking Flow:
1. **Search Hotels**: Real-time search via Ratehawk API
2. **Initiate Booking**: Creates Paystack payment link
3. **Payment Verification**: Confirms payment and books with Ratehawk
4. **Confirmation**: Sends booking confirmation via email/SMS
5. **Fallback**: Manual booking if API fails (payment still processed)

#### Frontend Integration:
The frontend hotel components are fully compatible and ready to use the implemented API endpoints.

---

For technical support or questions about the API, please contact the development team or refer to the interactive documentation at `/api-docs`.
