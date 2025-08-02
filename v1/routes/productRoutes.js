// v1/routes/productRoutes.js
const express = require('express');
const multer = require('multer');
const {
  getServiceCharges,
  updateServiceCharge,
  getTravelInsuranceLookup,
  getTravelInsuranceQuote,
  purchaseTravelInsuranceIndividual,
  purchaseTravelInsuranceFamily,
  searchFlights,
  bookFlight,
  searchHotels,
  bookHotel,
  getAvailablePackages,
  getPackageDetails,
  initiatePackagePurchase,
  verifyPackagePayment,
  initiateVisaApplication,
  uploadVisaDocument,
  getVisaApplicationDetails,
  updateVisaApplicationStatus,
  processVisaPayment,
  verifyVisaPayment,
} = require('../controllers/productController');
const { authenticateUser, authorizeRoles, optionalAuthenticateUser } = require('../middleware/authMiddleware');
const { UserRoles } = require('../utils/constants');
const validate = require('../middleware/validationMiddleware');
const { safeAuthMiddleware, safeValidationMiddleware } = require('../utils/middlewareLoader');
const {
  trackBookingReferralMiddleware,
  processBookingCommissionMiddleware,
  enhanceBookingConfirmationMiddleware
} = require('../middleware/bookingIntegrationMiddleware');
const {
  updateServiceChargeSchema,
  travelInsuranceQuoteSchema,
  travelInsurancePurchaseIndividualSchema,
  flightSearchSchema,
  flightBookSchema,
  hotelSearchSchema,
  hotelBookSchema,
  visaApplicationSchema,
  visaDocumentUploadSchema,
  visaStatusUpdateSchema,
  visaPaymentSchema,
  visaPaymentVerificationSchema,
  guestCheckoutSchema,
  packagePurchaseSchema,
  packagePaymentVerificationSchema,
  mongoIdParamSchema,
} = require('../utils/validationSchemas');

const router = express.Router();
const upload = multer({ dest: 'uploads/' }); // Temporary storage for file uploads

// --- Service Charge Routes (Admin Only) ---
/**
 * @openapi
 * /products/service-charges:
 *   get:
 *     summary: Get all service charges
 *     tags: [Products]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Service charges fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/StandardSuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         serviceCharges:
 *                           type: object
 *                           example:
 *                             FLIGHT_BOOKING_CHARGES: 5000
 *                             HOTEL_RESERVATION_CHARGES: 3000
 *                             TRAVEL_INSURANCE_CHARGES: 1000
 *                             VISA_PROCESSING_CHARGES: 7500
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/StandardErrorResponse'
 *       403:
 *         description: Forbidden (insufficient role)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/StandardErrorResponse'
 */
router.get('/service-charges', authenticateUser, authorizeRoles(UserRoles.ADMIN), getServiceCharges);

/**
 * @openapi
 * /products/service-charges/{chargeName}:
 *   put:
 *     summary: Update a specific service charge
 *     tags: [Products]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: chargeName
 *         schema:
 *           type: string
 *           enum: [FLIGHT_BOOKING_CHARGES, HOTEL_RESERVATION_CHARGES, TRAVEL_INSURANCE_CHARGES, VISA_PROCESSING_CHARGES]
 *         required: true
 *         description: The name of the service charge to update.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - value
 *             properties:
 *               value:
 *                 type: number
 *                 example: 6000
 *     responses:
 *       200:
 *         description: Service charge updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/StandardSuccessResponse'
 *       400:
 *         description: Invalid charge name or value
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/StandardErrorResponse'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/StandardErrorResponse'
 *       403:
 *         description: Forbidden (insufficient role)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/StandardErrorResponse'
 */
router.put('/service-charges/:chargeName', authenticateUser, authorizeRoles(UserRoles.ADMIN), validate(updateServiceChargeSchema), updateServiceCharge);

// --- Travel Insurance Routes ---
/**
 * @openapi
 * /products/travel-insurance/lookup/{type}:
 *   get:
 *     summary: Get Allianz Travel Insurance lookup data
 *     tags: [Products, Travel Insurance]
 *     parameters:
 *       - in: path
 *         name: type
 *         schema:
 *           type: string
 *           enum: [countries, travel-plans, Gender, Title, State, Marital Status, Booking Type]
 *         required: true
 *         description: Type of lookup data (e.g., 'countries', 'travel-plans').
 *       - in: query
 *         name: countryId
 *         schema:
 *           type: integer
 *         description: Optional country ID for specific lookups (e.g., TravelPlan).
 *     responses:
 *       200:
 *         description: Lookup data fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/StandardSuccessResponse'
 *       400:
 *         description: Invalid lookup type
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/StandardErrorResponse'
 */
router.get('/travel-insurance/lookup/:type', getTravelInsuranceLookup);

/**
 * @openapi
 * /products/travel-insurance/quote:
 *   post:
 *     summary: Get a quote for Allianz Travel Insurance
 *     tags: [Products, Travel Insurance]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - DateOfBirth
 *               - Email
 *               - Telephone
 *               - CoverBegins
 *               - CoverEnds
 *               - CountryId
 *               - PurposeOfTravel
 *               - TravelPlanId
 *               - BookingTypeId
 *               - IsRoundTrip
 *               - NoOfPeople
 *               - NoOfChildren
 *               - IsMultiTrip
 *             properties:
 *               DateOfBirth:
 *                 type: string
 *                 format: date
 *                 example: "14-Nov-2000"
 *               Email:
 *                 type: string
 *                 format: email
 *                 example: "joel.omondiale@allianz.ng"
 *               Telephone:
 *                 type: string
 *                 example: "08034635116"
 *               CoverBegins:
 *                 type: string
 *                 format: date
 *                 example: "14-Oct-2019"
 *               CoverEnds:
 *                 type: string
 *                 format: date
 *                 example: "30-Oct-2019"
 *               CountryId:
 *                 type: integer
 *                 example: 110
 *               PurposeOfTravel:
 *                 type: string
 *                 example: "Leisure"
 *               TravelPlanId:
 *                 type: integer
 *                 example: 1
 *               BookingTypeId:
 *                 type: integer
 *                 example: 1
 *               IsRoundTrip:
 *                 type: boolean
 *                 example: false
 *               NoOfPeople:
 *                 type: integer
 *                 example: 1
 *               NoOfChildren:
 *                 type: integer
 *                 example: 0
 *               IsMultiTrip:
 *                 type: boolean
 *                 example: false
 *     responses:
 *       200:
 *         description: Travel insurance quote fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/StandardSuccessResponse'
 *       400:
 *         description: Invalid request body
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/StandardErrorResponse'
 */
router.post('/travel-insurance/quote', validate(travelInsuranceQuoteSchema), getTravelInsuranceQuote);

/**
 * @openapi
 * /products/travel-insurance/purchase/individual:
 *   post:
 *     summary: Purchase Allianz Individual Travel Insurance
 *     tags: [Products, Travel Insurance]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - quoteId
 *               - customerDetails
 *             properties:
 *               quoteId:
 *                 type: integer
 *                 example: 700
 *               customerDetails:
 *                 type: object
 *                 required:
 *                   - Surname
 *                   - FirstName
 *                   - GenderId
 *                   - TitleId
 *                   - DateOfBirth
 *                   - Email
 *                   - Telephone
 *                   - StateId
 *                   - Address
 *                   - ZipCode
 *                   - Nationality
 *                   - PassportNo
 *                   - Occupation
 *                   - MaritalStatusId
 *                   - PreExistingMedicalCondition
 *                   - NextOfKin
 *                 properties:
 *                   Surname:
 *                     type: string
 *                     example: "Joel"
 *                   MiddleName:
 *                     type: string
 *                     example: "Amejayolo"
 *                   FirstName:
 *                     type: string
 *                     example: "Omondiale"
 *                   GenderId:
 *                     type: integer
 *                     example: 1
 *                   TitleId:
 *                     type: integer
 *                     example: 2
 *                   DateOfBirth:
 *                     type: string
 *                     format: date
 *                     example: "14-Nov-1990"
 *                   Email:
 *                     type: string
 *                     format: email
 *                     example: "joel.omondiale@allianz.ng"
 *                   Telephone:
 *                     type: string
 *                     example: "08034635116"
 *                   StateId:
 *                     type: integer
 *                     example: 25
 *                   Address:
 *                     type: string
 *                     example: "15 Bariga road, Bariga, Lagos, Bariga"
 *                   ZipCode:
 *                     type: string
 *                     example: "100252"
 *                   Nationality:
 *                     type: string
 *                     example: "Nigeria"
 *                   PassportNo:
 *                     type: string
 *                     example: "A123456"
 *                   IdentificationPath:
 *                     type: string
 *                     nullable: true
 *                   Occupation:
 *                     type: string
 *                     example: "Software Dev"
 *                   MaritalStatusId:
 *                     type: integer
 *                     example: 2
 *                   PreExistingMedicalCondition:
 *                     type: boolean
 *                     example: false
 *                   MedicalCondition:
 *                     type: string
 *                     nullable: true
 *                   NextOfKin:
 *                     type: object
 *                     properties:
 *                       FullName:
 *                         type: string
 *                         example: "Jason"
 *                       Address:
 *                         type: string
 *                         example: "Same as mine"
 *                       Relationship:
 *                         type: string
 *                         example: "Son"
 *                       Telephone:
 *                         type: string
 *                         example: "08034635116"
 *               paymentDetails:
 *                 type: object
 *                 description: Details for Paystack payment (e.g., card token, callback URL)
 *                 example: {}
 *     responses:
 *       200:
 *         description: Travel insurance purchase initiated. Redirect to payment gateway.
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/StandardSuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         authorizationUrl:
 *                           type: string
 *                           example: "https://checkout.paystack.com/mock_auth_url"
 *                         reference:
 *                           type: string
 *                           example: "TTP-TI-1678888888888"
 *                         amount:
 *                           type: number
 *                           example: 8467
 *       400:
 *         description: Invalid request body or missing data
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/StandardErrorResponse'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/StandardErrorResponse'
 *       500:
 *         description: Internal server error (e.g., Allianz API or Paystack error)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/StandardErrorResponse'
 */
router.post('/travel-insurance/purchase/individual', authenticateUser, trackBookingReferralMiddleware, enhanceBookingConfirmationMiddleware, validate(travelInsurancePurchaseIndividualSchema), purchaseTravelInsuranceIndividual);

/**
 * @openapi
 * /products/travel-insurance/purchase/family:
 *   post:
 *     summary: Purchase Allianz Family Travel Insurance
 *     tags: [Products, Travel Insurance]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               quoteId:
 *                 type: integer
 *                 example: 700
 *               familyMembersDetails:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     Surname:
 *                       type: string
 *                       example: "Joel"
 *                     MiddleName:
 *                       type: string
 *                       example: "Amejayolo"
 *                     FirstName:
 *                       type: string
 *                       example: "Omondiale"
 *                     GenderId:
 *                       type: integer
 *                       example: 1
 *                     TitleId:
 *                       type: integer
 *                       example: 2
 *                     DateOfBirth:
 *                       type: string
 *                       format: date
 *                       example: "14-Nov-1990"
 *                     Email:
 *                       type: string
 *                       format: email
 *                       example: "joel.omondiale@allianz.ng"
 *                     Telephone:
 *                       type: string
 *                       example: "08034635116"
 *                     StateId:
 *                       type: integer
 *                       example: 25
 *                     Address:
 *                       type: string
 *                       example: "15 Bariga road, Bariga, Lagos, Bariga"
 *                     ZipCode:
 *                       type: string
 *                       example: "100252"
 *                     Nationality:
 *                       type: string
 *                       example: "Nigeria"
 *                     PassportNo:
 *                       type: string
 *                       example: "A123456"
 *                     IdentificationPath:
 *                       type: string
 *                       nullable: true
 *                     Occupation:
 *                       type: string
 *                       example: "Software Dev"
 *                     MaritalStatusId:
 *                       type: integer
 *                       example: 2
 *                     PreExistingMedicalCondition:
 *                       type: boolean
 *                       example: false
 *                     MedicalCondition:
 *                       type: string
 *                       nullable: true
 *                     NextOfKin:
 *                       type: object
 *                       properties:
 *                         FullName:
 *                           type: string
 *                           example: "Jason"
 *                         Address:
 *                           type: string
 *                           example: "Same as mine"
 *                         Relationship:
 *                           type: string
 *                           example: "Son"
 *                         Telephone:
 *                           type: string
 *                           example: "08034635116"
 *                   required:
 *                     - Surname
 *                     - FirstName
 *                     - GenderId
 *                     - TitleId
 *                     - DateOfBirth
 *                     - Email
 *                     - Telephone
 *                     - StateId
 *                     - Address
 *                     - ZipCode
 *                     - Nationality
 *                     - PassportNo
 *                     - Occupation
 *                     - MaritalStatusId
 *                     - PreExistingMedicalCondition
 *                     - NextOfKin
 *               paymentDetails:
 *                 type: object
 *                 description: Details for Paystack payment
 *                 example: {}
 *             required:
 *               - quoteId
 *               - familyMembersDetails
 *     responses:
 *       200:
 *         description: Family travel insurance purchase initiated. Redirect to payment gateway.
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/StandardSuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         authorizationUrl:
 *                           type: string
 *                           example: "https://checkout.paystack.com/mock_auth_url"
 *                         reference:
 *                           type: string
 *                           example: "TTP-TIF-1678888888888"
 *                         amount:
 *                           type: number
 *                           example: 36259
 *       400:
 *         description: Invalid request body or missing data
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/StandardErrorResponse'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/StandardErrorResponse'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/StandardErrorResponse'
 */
router.post('/travel-insurance/purchase/family', authenticateUser, trackBookingReferralMiddleware, enhanceBookingConfirmationMiddleware, purchaseTravelInsuranceFamily);

// --- Flight Routes ---
/**
 * @openapi
 * /products/flights/search:
 *   post:
 *     summary: Search for flights
 *     tags: [Products, Flights]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               originLocationCode:
 *                 type: string
 *                 example: "LOS"
 *               destinationLocationCode:
 *                 type: string
 *                 example: "JFK"
 *               departureDate:
 *                 type: string
 *                 format: date
 *                 example: "2024-09-15"
 *               returnDate:
 *                 type: string
 *                 format: date
 *                 example: "2024-09-25"
 *                 nullable: true
 *               adults:
 *                 type: integer
 *                 example: 1
 *               children:
 *                 type: integer
 *                 example: 0
 *               travelClass:
 *                 type: string
 *                 enum: [ECONOMY, PREMIUM_ECONOMY, BUSINESS, FIRST]
 *                 example: "ECONOMY"
 *               currencyCode:
 *                 type: string
 *                 example: "NGN"
 *             required:
 *               - originLocationCode
 *               - destinationLocationCode
 *               - departureDate
 *               - adults
 *     responses:
 *       200:
 *         description: Flights fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/StandardSuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         flights:
 *                           type: array
 *                           items:
 *                             type: object
 *                             properties:
 *                               id:
 *                                 type: string
 *                               airline:
 *                                 type: string
 *                               departure:
 *                                 type: string
 *                               arrival:
 *                                 type: string
 *                               price:
 *                                 type: number
 *       400:
 *         description: Invalid search criteria
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/StandardErrorResponse'
 */
router.post('/flights/search', validate(flightSearchSchema), searchFlights);

/**
 * @openapi
 * /products/flights/book:
 *   post:
 *     summary: Book a flight
 *     tags: [Products, Flights]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               flightDetails:
 *                 type: object
 *                 description: Selected flight offer details from search endpoint.
 *                 properties:
 *                   id:
 *                     type: string
 *                     example: "FL123"
 *                   price:
 *                     type: number
 *                     example: 500000
 *               passengerDetails:
 *                 type: object
 *                 properties:
 *                   firstName:
 *                     type: string
 *                     example: "John"
 *                   lastName:
 *                     type: string
 *                     example: "Doe"
 *                   email:
 *                     type: string
 *                     format: email
 *                     example: "john.doe@example.com"
 *                   phoneNumber:
 *                     type: string
 *                     example: "+2348012345678"
 *               paymentDetails:
 *                 type: object
 *                 description: Details for Paystack payment
 *                 example: {}
 *             required:
 *               - flightDetails
 *               - passengerDetails
 *     responses:
 *       200:
 *         description: Flight booking initiated. Redirect to payment gateway.
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/StandardSuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         authorizationUrl:
 *                           type: string
 *                           example: "https://checkout.paystack.com/mock_auth_url"
 *                         reference:
 *                           type: string
 *                           example: "TTP-FL-1678888888888"
 *                         amount:
 *                           type: number
 *                           example: 505000
 *       400:
 *         description: Invalid request body or missing data
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/StandardErrorResponse'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/StandardErrorResponse'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/StandardErrorResponse'
 */
router.post('/flights/book', authenticateUser, trackBookingReferralMiddleware, enhanceBookingConfirmationMiddleware, validate(flightBookSchema), bookFlight);

// --- Hotel Routes ---
/**
 * @openapi
 * /products/hotels/search:
 *   post:
 *     summary: Search for hotels
 *     tags: [Products, Hotels]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               checkin:
 *                 type: string
 *                 format: date
 *                 example: "2024-10-01"
 *               checkout:
 *                 type: string
 *                 format: date
 *                 example: "2024-10-05"
 *               country:
 *                 type: string
 *                 example: "NG"
 *               city:
 *                 type: string
 *                 example: "Lagos"
 *               adults:
 *                 type: integer
 *                 example: 2
 *               children:
 *                 type: array
 *                 items:
 *                   type: integer
 *                 example: [5]
 *                 description: Array of children ages
 *               currency:
 *                 type: string
 *                 example: "NGN"
 *             required:
 *               - checkin
 *               - checkout
 *               - country
 *               - city
 *               - adults
 *     responses:
 *       200:
 *         description: Hotels fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/StandardSuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         hotels:
 *                           type: array
 *                           items:
 *                             type: object
 *                             properties:
 *                               id:
 *                                 type: string
 *                               name:
 *                                 type: string
 *                               price:
 *                                 type: number
 *                               currency:
 *                                 type: string
 *       400:
 *         description: Invalid search criteria
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/StandardErrorResponse'
 */
router.post('/hotels/search', validate(hotelSearchSchema), searchHotels);

/**
 * @openapi
 * /products/hotels/book:
 *   post:
 *     summary: Book a hotel
 *     tags: [Products, Hotels]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               hotelDetails:
 *                 type: object
 *                 description: Selected hotel details from search endpoint.
 *                 properties:
 *                   id:
 *                     type: string
 *                     example: "HTL001"
 *                   price:
 *                     type: number
 *                     example: 150000
 *               guestDetails:
 *                 type: object
 *                 properties:
 *                   firstName:
 *                     type: string
 *                     example: "Jane"
 *                   lastName:
 *                     type: string
 *                     example: "Smith"
 *                   email:
 *                     type: string
 *                     format: email
 *                     example: "jane.smith@example.com"
 *                   phoneNumber:
 *                     type: string
 *                     example: "+2347012345678"
 *               paymentDetails:
 *                 type: object
 *                 description: Details for Paystack payment
 *                 example: {}
 *             required:
 *               - hotelDetails
 *               - guestDetails
 *     responses:
 *       200:
 *         description: Hotel booking initiated. Redirect to payment gateway.
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/StandardSuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         authorizationUrl:
 *                           type: string
 *                           example: "https://checkout.paystack.com/mock_auth_url"
 *                         reference:
 *                           type: string
 *                           example: "TTP-HTL-1678888888888"
 *                         amount:
 *                           type: number
 *                           example: 153000
 *       400:
 *         description: Invalid request body or missing data
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/StandardErrorResponse'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/StandardErrorResponse'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/StandardErrorResponse'
 */
router.post('/hotels/book', authenticateUser, trackBookingReferralMiddleware, enhanceBookingConfirmationMiddleware, validate(hotelBookSchema), bookHotel);

// --- Package Routes ---
/**
 * @openapi
 * /products/packages:
 *   get:
 *     summary: Get available packages for purchase
 *     tags: [Products, Packages]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number for pagination
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Number of packages per page
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *         description: Filter by category ID
 *       - in: query
 *         name: featured
 *         schema:
 *           type: boolean
 *         description: Filter featured packages only
 *     responses:
 *       200:
 *         description: Available packages fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/StandardSuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         packages:
 *                           type: array
 *                           items:
 *                             type: object
 *                             properties:
 *                               _id:
 *                                 type: string
 *                               title:
 *                                 type: string
 *                               slug:
 *                                 type: string
 *                               price:
 *                                 type: number
 *                               currency:
 *                                 type: string
 *                               excerpt:
 *                                 type: string
 *                               featuredImage:
 *                                 type: string
 *                               metadata:
 *                                 type: object
 *                                 properties:
 *                                   duration:
 *                                     type: string
 *                                   location:
 *                                     type: string
 *                                   difficulty:
 *                                     type: string
 *                                   maxParticipants:
 *                                     type: number
 *                         pagination:
 *                           type: object
 *                           properties:
 *                             currentPage:
 *                               type: integer
 *                             totalPages:
 *                               type: integer
 *                             totalPackages:
 *                               type: integer
 *                             hasNext:
 *                               type: boolean
 *                             hasPrev:
 *                               type: boolean
 */
router.get('/packages', getAvailablePackages);

/**
 * @openapi
 * /products/packages/{identifier}:
 *   get:
 *     summary: Get package details by ID or slug
 *     tags: [Products, Packages]
 *     parameters:
 *       - in: path
 *         name: identifier
 *         schema:
 *           type: string
 *         required: true
 *         description: Package ID or slug
 *     responses:
 *       200:
 *         description: Package details fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/StandardSuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         package:
 *                           type: object
 *                           properties:
 *                             _id:
 *                               type: string
 *                             title:
 *                               type: string
 *                             slug:
 *                               type: string
 *                             content:
 *                               type: string
 *                             price:
 *                               type: number
 *                             currency:
 *                               type: string
 *                             featuredImage:
 *                               type: string
 *                             gallery:
 *                               type: array
 *                               items:
 *                                 type: string
 *                             metadata:
 *                               type: object
 *                               properties:
 *                                 duration:
 *                                   type: string
 *                                 location:
 *                                   type: string
 *                                 difficulty:
 *                                   type: string
 *                                 maxParticipants:
 *                                   type: number
 *                                 inclusions:
 *                                   type: array
 *                                   items:
 *                                     type: string
 *                                 exclusions:
 *                                   type: array
 *                                   items:
 *                                     type: string
 *                             availability:
 *                               type: object
 *                               properties:
 *                                 startDate:
 *                                   type: string
 *                                   format: date
 *                                 endDate:
 *                                   type: string
 *                                   format: date
 *                                 isAvailable:
 *                                   type: boolean
 *       400:
 *         description: Package is not available for booking
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/StandardErrorResponse'
 *       404:
 *         description: Package not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/StandardErrorResponse'
 */
router.get('/packages/:identifier', getPackageDetails);

// POST /products/packages/{packageId}/purchase - Initiate package purchase
// TODO: Add proper OpenAPI documentation with correct YAML formatting
router.post('/packages/:packageId/purchase', trackBookingReferralMiddleware, enhanceBookingConfirmationMiddleware, validate(packagePurchaseSchema), initiatePackagePurchase);

// POST /products/packages/verify-payment - Verify package payment and complete purchase
// TODO: Add proper OpenAPI documentation with correct YAML formatting
router.post('/packages/verify-payment', processBookingCommissionMiddleware, validate(packagePaymentVerificationSchema), verifyPackagePayment);

// --- Visa Processing Routes ---
// POST /products/visa/apply - Initiate a new visa application
// TODO: Add proper OpenAPI documentation with correct YAML formatting
router.post('/visa/apply', optionalAuthenticateUser, trackBookingReferralMiddleware, enhanceBookingConfirmationMiddleware, validate(visaApplicationSchema), initiateVisaApplication);

// POST /products/visa/{id}/upload-document - Upload documents for a visa application
// TODO: Add proper OpenAPI documentation with correct YAML formatting
router.post('/visa/:id/upload-document', optionalAuthenticateUser, upload.single('file'), validate(visaDocumentUploadSchema), uploadVisaDocument);

// GET /products/visa/{id} - Get details of a visa application
// TODO: Add proper OpenAPI documentation with correct YAML formatting
router.get('/visa/:id', optionalAuthenticateUser, validate(mongoIdParamSchema), getVisaApplicationDetails);

// PUT /products/visa/{id}/status - Update visa application status (Staff/Admin only)
// TODO: Add proper OpenAPI documentation with correct YAML formatting
router.put('/visa/:id/status', authenticateUser, authorizeRoles(UserRoles.STAFF, UserRoles.MANAGER, UserRoles.EXECUTIVE, UserRoles.ADMIN), validate(visaStatusUpdateSchema), updateVisaApplicationStatus);

// POST /products/visa/{id}/payment - Process payment for visa application
// TODO: Add proper OpenAPI documentation with correct YAML formatting
router.post('/visa/:id/payment', optionalAuthenticateUser, validate(visaPaymentSchema), processVisaPayment);

// POST /products/visa/{id}/verify-payment - Verify visa application payment
// TODO: Add proper OpenAPI documentation with correct YAML formatting
router.post('/visa/:id/verify-payment', optionalAuthenticateUser, processBookingCommissionMiddleware, validate(visaPaymentVerificationSchema), verifyVisaPayment);


module.exports = router;