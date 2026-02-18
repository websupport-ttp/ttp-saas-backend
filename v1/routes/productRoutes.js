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
  verifyTravelInsurancePayment,
  searchFlights,
  bookFlight,
  verifyFlightPayment,
  searchHotels,
  bookHotel,
  verifyHotelPayment,
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
  getVisaRequirements,
  calculateVisaApplicationFees,
  getVisaProcessingCenters,
  scheduleVisaAppointment,
  checkVisaApplicationStatus,
  checkSanlamAllianzApiHealth,
} = require('../controllers/productController');
const { authenticateUser, authorizeRoles, optionalAuthenticateUser } = require('../middleware/authMiddleware');
const { UserRoles } = require('../utils/constants');
const { validate } = require('../middleware/validationMiddleware');
const {
  trackBookingReferralMiddleware,
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
  visaRequirementsSchema,
  visaFeesCalculationSchema,
  visaProcessingCentersSchema,
  visaAppointmentSchema,
  guestCheckoutSchema,
  packagePurchaseSchema,
  packagePaymentVerificationSchema,
  mongoIdParamSchema,
} = require('../utils/validationSchemas');

const router = express.Router();

// Configure multer for serverless environment compatibility
const multerConfig = {
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  }
};

// Ensure no disk operations in serverless environments
if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
  // Explicitly prevent any disk storage attempts
  multerConfig.dest = undefined;
  multerConfig.fileFilter = (req, file, cb) => {
    // Additional validation can be added here
    cb(null, true);
  };
}

const upload = multer(multerConfig);

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
/*
*
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
router.post('/travel-insurance/purchase/individual', optionalAuthenticateUser, trackBookingReferralMiddleware, enhanceBookingConfirmationMiddleware, validate(travelInsurancePurchaseIndividualSchema), purchaseTravelInsuranceIndividual);

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
router.post('/travel-insurance/purchase/family', optionalAuthenticateUser, trackBookingReferralMiddleware, enhanceBookingConfirmationMiddleware, purchaseTravelInsuranceFamily);

/**
 * @openapi
 * /products/travel-insurance/verify-payment:
 *   post:
 *     summary: Verify travel insurance payment and complete booking
 *     tags: [Products, Travel Insurance]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - reference
 *             properties:
 *               reference:
 *                 type: string
 *                 description: Payment reference from Paystack
 *                 example: "TTP-TI-1678888888888"
 *     responses:
 *       200:
 *         description: Travel insurance payment verified successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/StandardSuccessResponse'
 *       400:
 *         description: Invalid payment reference or verification failed
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/StandardErrorResponse'
 *       404:
 *         description: Transaction not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/StandardErrorResponse'
 */
router.post('/travel-insurance/verify-payment', verifyTravelInsurancePayment);

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
 *             required:
 *               - originLocationCode
 *               - destinationLocationCode
 *               - departureDate
 *               - adults
 *             properties:
 *               originLocationCode:
 *                 type: string
 *                 pattern: "^[A-Z]{3}$"
 *                 description: Origin airport IATA code (3 letters)
 *                 example: "LOS"
 *               destinationLocationCode:
 *                 type: string
 *                 pattern: "^[A-Z]{3}$"
 *                 description: Destination airport IATA code (3 letters)
 *                 example: "JFK"
 *               departureDate:
 *                 type: string
 *                 format: date
 *                 description: Departure date (YYYY-MM-DD)
 *                 example: "2024-12-15"
 *               returnDate:
 *                 type: string
 *                 format: date
 *                 description: Return date for round trip (optional)
 *                 example: "2024-12-22"
 *               adults:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 9
 *                 description: Number of adult passengers
 *                 example: 2
 *               children:
 *                 type: integer
 *                 minimum: 0
 *                 maximum: 9
 *                 description: Number of child passengers (2-11 years)
 *                 example: 1
 *               infants:
 *                 type: integer
 *                 minimum: 0
 *                 maximum: 9
 *                 description: Number of infant passengers (under 2 years)
 *                 example: 0
 *               currencyCode:
 *                 type: string
 *                 enum: [NGN, USD, EUR, GBP]
 *                 description: Preferred currency for pricing
 *                 example: "NGN"
 *                 default: "USD"
 *               max:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 100
 *                 description: Maximum number of flight offers to return
 *                 example: 50
 *                 default: 50
 *               travelClass:
 *                 type: string
 *                 enum: [ECONOMY, PREMIUM_ECONOMY, BUSINESS, FIRST]
 *                 description: Preferred travel class
 *                 example: "ECONOMY"
 *                 default: "ECONOMY"
 *               nonStop:
 *                 type: boolean
 *                 description: Search for non-stop flights only
 *                 example: false
 *                 default: false
 *     responses:
 *       200:
 *         description: Flight search results retrieved successfully
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
 *                         meta:
 *                           type: object
 *                           properties:
 *                             count:
 *                               type: integer
 *                               description: Number of flight offers returned
 *                               example: 25
 *                             currency:
 *                               type: string
 *                               example: "NGN"
 *                             links:
 *                               type: object
 *                               properties:
 *                                 self:
 *                                   type: string
 *                                   example: "https://api.amadeus.com/v2/shopping/flight-offers"
 *                         data:
 *                           type: array
 *                           items:
 *                             type: object
 *                             properties:
 *                               type:
 *                                 type: string
 *                                 example: "flight-offer"
 *                               id:
 *                                 type: string
 *                                 example: "1"
 *                               source:
 *                                 type: string
 *                                 example: "GDS"
 *                               instantTicketingRequired:
 *                                 type: boolean
 *                                 example: false
 *                               nonHomogeneous:
 *                                 type: boolean
 *                                 example: false
 *                               oneWay:
 *                                 type: boolean
 *                                 example: false
 *                               lastTicketingDate:
 *                                 type: string
 *                                 format: date
 *                                 example: "2024-12-10"
 *                               numberOfBookableSeats:
 *                                 type: integer
 *                                 example: 9
 *                               itineraries:
 *                                 type: array
 *                                 items:
 *                                   type: object
 *                                   properties:
 *                                     duration:
 *                                       type: string
 *                                       example: "PT15H30M"
 *                                     segments:
 *                                       type: array
 *                                       items:
 *                                         type: object
 *                                         properties:
 *                                           departure:
 *                                             type: object
 *                                             properties:
 *                                               iataCode:
 *                                                 type: string
 *                                                 example: "LOS"
 *                                               terminal:
 *                                                 type: string
 *                                                 example: "1"
 *                                               at:
 *                                                 type: string
 *                                                 format: date-time
 *                                                 example: "2024-12-15T10:30:00"
 *                                           arrival:
 *                                             type: object
 *                                             properties:
 *                                               iataCode:
 *                                                 type: string
 *                                                 example: "JFK"
 *                                               terminal:
 *                                                 type: string
 *                                                 example: "4"
 *                                               at:
 *                                                 type: string
 *                                                 format: date-time
 *                                                 example: "2024-12-16T06:00:00"
 *                                           carrierCode:
 *                                             type: string
 *                                             example: "DL"
 *                                           number:
 *                                             type: string
 *                                             example: "156"
 *                                           aircraft:
 *                                             type: object
 *                                             properties:
 *                                               code:
 *                                                 type: string
 *                                                 example: "763"
 *                                           operating:
 *                                             type: object
 *                                             properties:
 *                                               carrierCode:
 *                                                 type: string
 *                                                 example: "DL"
 *                                           duration:
 *                                             type: string
 *                                             example: "PT10H30M"
 *                                           id:
 *                                             type: string
 *                                             example: "1"
 *                                           numberOfStops:
 *                                             type: integer
 *                                             example: 0
 *                                           blacklistedInEU:
 *                                             type: boolean
 *                                             example: false
 *                               price:
 *                                 type: object
 *                                 properties:
 *                                   currency:
 *                                     type: string
 *                                     example: "NGN"
 *                                   total:
 *                                     type: string
 *                                     example: "850000.00"
 *                                   base:
 *                                     type: string
 *                                     example: "750000.00"
 *                                   fees:
 *                                     type: array
 *                                     items:
 *                                       type: object
 *                                       properties:
 *                                         amount:
 *                                           type: string
 *                                           example: "50000.00"
 *                                         type:
 *                                           type: string
 *                                           example: "SUPPLIER"
 *                                   grandTotal:
 *                                     type: string
 *                                     example: "855000.00"
 *                               pricingOptions:
 *                                 type: object
 *                                 properties:
 *                                   fareType:
 *                                     type: array
 *                                     items:
 *                                       type: string
 *                                     example: ["PUBLISHED"]
 *                                   includedCheckedBagsOnly:
 *                                     type: boolean
 *                                     example: true
 *                               validatingAirlineCodes:
 *                                 type: array
 *                                 items:
 *                                   type: string
 *                                 example: ["DL"]
 *                               travelerPricings:
 *                                 type: array
 *                                 items:
 *                                   type: object
 *                                   properties:
 *                                     travelerId:
 *                                       type: string
 *                                       example: "1"
 *                                     fareOption:
 *                                       type: string
 *                                       example: "STANDARD"
 *                                     travelerType:
 *                                       type: string
 *                                       example: "ADULT"
 *                                     price:
 *                                       type: object
 *                                       properties:
 *                                         currency:
 *                                           type: string
 *                                           example: "NGN"
 *                                         total:
 *                                           type: string
 *                                           example: "425000.00"
 *                                         base:
 *                                           type: string
 *                                           example: "375000.00"
 *                                     fareDetailsBySegment:
 *                                       type: array
 *                                       items:
 *                                         type: object
 *                                         properties:
 *                                           segmentId:
 *                                             type: string
 *                                             example: "1"
 *                                           cabin:
 *                                             type: string
 *                                             example: "ECONOMY"
 *                                           fareBasis:
 *                                             type: string
 *                                             example: "UU1YXFII"
 *                                           class:
 *                                             type: string
 *                                             example: "U"
 *                                           includedCheckedBags:
 *                                             type: object
 *                                             properties:
 *                                               quantity:
 *                                                 type: integer
 *                                                 example: 1
 *                         dictionaries:
 *                           type: object
 *                           properties:
 *                             locations:
 *                               type: object
 *                               additionalProperties:
 *                                 type: object
 *                                 properties:
 *                                   cityCode:
 *                                     type: string
 *                                     example: "NYC"
 *                                   countryCode:
 *                                     type: string
 *                                     example: "US"
 *                             aircraft:
 *                               type: object
 *                               additionalProperties:
 *                                 type: string
 *                               example:
 *                                 "763": "BOEING 767-300"
 *                             currencies:
 *                               type: object
 *                               additionalProperties:
 *                                 type: string
 *                               example:
 *                                 "NGN": "NIGERIAN NAIRA"
 *                             carriers:
 *                               type: object
 *                               additionalProperties:
 *                                 type: string
 *                               example:
 *                                 "DL": "DELTA AIR LINES"
 *       400:
 *         description: Invalid search criteria
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/StandardErrorResponse'
 *       500:
 *         description: Internal server error or Amadeus API error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/StandardErrorResponse'
 */
router.post('/flights/search', validate(flightSearchSchema), searchFlights);

/**
 * @openapi
 * /products/flights/verify-payment:
 *   post:
 *     summary: Verify flight payment and complete booking
 *     description: Verify Paystack payment and complete Amadeus flight booking
 *     tags: [Products, Flights, Payments]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - reference
 *             properties:
 *               reference:
 *                 type: string
 *                 description: Paystack payment reference
 *                 example: "TTP-FL-1678888888888"
 *     responses:
 *       200:
 *         description: Payment verified and booking confirmed
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
 *                         paymentStatus:
 *                           type: string
 *                           enum: ["success", "failed"]
 *                           example: "success"
 *                         transactionReference:
 *                           type: string
 *                           example: "TTP-FL-1678888888888"
 *                         amountPaid:
 *                           type: number
 *                           example: 860000
 *                         currency:
 *                           type: string
 *                           example: "NGN"
 *                         paidAt:
 *                           type: string
 *                           format: date-time
 *                           example: "2024-01-15T10:30:00Z"
 *                         applicationStatus:
 *                           type: string
 *                           description: Booking status after payment
 *                           example: "Booking Confirmed"
 *                         bookingReference:
 *                           type: string
 *                           description: Amadeus booking reference
 *                           example: "AMADEUS-1678888888888"
 *                         nextSteps:
 *                           type: string
 *                           description: Instructions for what happens next
 *                           example: "Your flight has been successfully booked. You will receive your e-ticket via email shortly."
 *       400:
 *         description: Invalid payment reference or verification failed
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/StandardErrorResponse'
 *       404:
 *         description: Transaction not found
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
router.post('/flights/verify-payment', verifyFlightPayment);

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
 *             required:
 *               - flightDetails
 *               - passengerDetails
 *             properties:
 *               flightDetails:
 *                 type: object
 *                 required:
 *                   - id
 *                   - price
 *                 properties:
 *                   id:
 *                     type: string
 *                     description: Flight offer ID from search results
 *                     example: "1"
 *                   price:
 *                     type: number
 *                     description: Total flight price
 *                     example: 855000
 *                   currency:
 *                     type: string
 *                     description: Price currency
 *                     example: "NGN"
 *                   itineraries:
 *                     type: array
 *                     description: Flight itinerary details
 *                     items:
 *                       type: object
 *                       properties:
 *                         segments:
 *                           type: array
 *                           items:
 *                             type: object
 *                             properties:
 *                               departure:
 *                                 type: object
 *                                 properties:
 *                                   iataCode:
 *                                     type: string
 *                                     example: "LOS"
 *                                   at:
 *                                     type: string
 *                                     format: date-time
 *                                     example: "2024-12-15T10:30:00"
 *                               arrival:
 *                                 type: object
 *                                 properties:
 *                                   iataCode:
 *                                     type: string
 *                                     example: "JFK"
 *                                   at:
 *                                     type: string
 *                                     format: date-time
 *                                     example: "2024-12-16T06:00:00"
 *                               carrierCode:
 *                                 type: string
 *                                 example: "DL"
 *                               number:
 *                                 type: string
 *                                 example: "156"
 *               passengerDetails:
 *                 type: array
 *                 description: Array of passenger information
 *                 items:
 *                   type: object
 *                   required:
 *                     - id
 *                     - dateOfBirth
 *                     - name
 *                     - gender
 *                     - contact
 *                     - documents
 *                   properties:
 *                     id:
 *                       type: string
 *                       description: Unique passenger identifier
 *                       example: "1"
 *                     dateOfBirth:
 *                       type: string
 *                       format: date
 *                       description: Passenger date of birth (YYYY-MM-DD)
 *                       example: "1990-05-15"
 *                     name:
 *                       type: object
 *                       required:
 *                         - firstName
 *                         - lastName
 *                       properties:
 *                         firstName:
 *                           type: string
 *                           description: Passenger first name
 *                           example: "John"
 *                         lastName:
 *                           type: string
 *                           description: Passenger last name
 *                           example: "Doe"
 *                         middleName:
 *                           type: string
 *                           description: Passenger middle name (optional)
 *                           example: "Michael"
 *                     gender:
 *                       type: string
 *                       enum: [MALE, FEMALE]
 *                       description: Passenger gender
 *                       example: "MALE"
 *                     contact:
 *                       type: object
 *                       required:
 *                         - emailAddress
 *                         - phones
 *                       properties:
 *                         emailAddress:
 *                           type: string
 *                           format: email
 *                           description: Contact email address
 *                           example: "john.doe@example.com"
 *                         phones:
 *                           type: array
 *                           items:
 *                             type: object
 *                             properties:
 *                               deviceType:
 *                                 type: string
 *                                 enum: [MOBILE, LANDLINE]
 *                                 example: "MOBILE"
 *                               countryCallingCode:
 *                                 type: string
 *                                 example: "234"
 *                               number:
 *                                 type: string
 *                                 example: "8012345678"
 *                         address:
 *                           type: object
 *                           properties:
 *                             lines:
 *                               type: array
 *                               items:
 *                                 type: string
 *                               example: ["123 Main Street"]
 *                             postalCode:
 *                               type: string
 *                               example: "100001"
 *                             cityName:
 *                               type: string
 *                               example: "Lagos"
 *                             countryCode:
 *                               type: string
 *                               example: "NG"
 *                     documents:
 *                       type: array
 *                       description: Travel documents (passport, etc.)
 *                       items:
 *                         type: object
 *                         required:
 *                           - documentType
 *                           - number
 *                           - expiryDate
 *                           - issuanceCountry
 *                           - nationality
 *                         properties:
 *                           documentType:
 *                             type: string
 *                             enum: [PASSPORT]
 *                             example: "PASSPORT"
 *                           number:
 *                             type: string
 *                             description: Document number
 *                             example: "A12345678"
 *                           expiryDate:
 *                             type: string
 *                             format: date
 *                             description: Document expiry date (YYYY-MM-DD)
 *                             example: "2030-05-15"
 *                           issuanceCountry:
 *                             type: string
 *                             description: Country that issued the document
 *                             example: "NG"
 *                           nationality:
 *                             type: string
 *                             description: Passenger nationality
 *                             example: "NG"
 *                           issuanceDate:
 *                             type: string
 *                             format: date
 *                             description: Document issuance date (optional)
 *                             example: "2020-05-15"
 *                           validityCountry:
 *                             type: string
 *                             description: Country where document is valid (optional)
 *                             example: "NG"
 *                           holder:
 *                             type: boolean
 *                             description: Whether passenger is the document holder
 *                             example: true
 *               paymentDetails:
 *                 type: object
 *                 description: Payment information for Paystack integration
 *                 properties:
 *                   email:
 *                     type: string
 *                     format: email
 *                     description: Email for payment receipt
 *                     example: "john.doe@example.com"
 *                   currency:
 *                     type: string
 *                     enum: [NGN, USD, GHS, ZAR, KES]
 *                     description: Payment currency
 *                     example: "NGN"
 *                   callback_url:
 *                     type: string
 *                     format: uri
 *                     description: URL to redirect after payment
 *                     example: "https://yourapp.com/payment/callback"
 *                   metadata:
 *                     type: object
 *                     description: Additional payment metadata
 *                     properties:
 *                       booking_type:
 *                         type: string
 *                         example: "flight"
 *                       passenger_count:
 *                         type: integer
 *                         example: 2
 *               referralCode:
 *                 type: string
 *                 description: Optional referral code for affiliate tracking
 *                 example: "REF123456"
 *               guestCheckout:
 *                 type: object
 *                 description: Guest checkout information (if not authenticated)
 *                 properties:
 *                   email:
 *                     type: string
 *                     format: email
 *                     example: "guest@example.com"
 *                   phoneNumber:
 *                     type: string
 *                     example: "+2348012345678"
 *                   firstName:
 *                     type: string
 *                     example: "Jane"
 *                   lastName:
 *                     type: string
 *                     example: "Smith"
 *     responses:
 *       200:
 *         description: Flight booking initiated successfully. Redirect to payment gateway.
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
 *                         bookingReference:
 *                           type: string
 *                           description: Temporary booking reference
 *                           example: "TTP-FL-1678888888888"
 *                         authorizationUrl:
 *                           type: string
 *                           description: Paystack payment URL
 *                           example: "https://checkout.paystack.com/mock_auth_url"
 *                         paymentReference:
 *                           type: string
 *                           description: Payment transaction reference
 *                           example: "TTP-FL-PAY-1678888888888"
 *                         amount:
 *                           type: number
 *                           description: Total amount to be paid (including service charges)
 *                           example: 860000
 *                         currency:
 *                           type: string
 *                           description: Payment currency
 *                           example: "NGN"
 *                         expiresAt:
 *                           type: string
 *                           format: date-time
 *                           description: Booking hold expiry time
 *                           example: "2024-12-15T11:30:00Z"
 *                         passengers:
 *                           type: array
 *                           description: Confirmed passenger details
 *                           items:
 *                             type: object
 *                             properties:
 *                               id:
 *                                 type: string
 *                                 example: "1"
 *                               name:
 *                                 type: object
 *                                 properties:
 *                                   firstName:
 *                                     type: string
 *                                     example: "John"
 *                                   lastName:
 *                                     type: string
 *                                     example: "Doe"
 *                         flightDetails:
 *                           type: object
 *                           description: Confirmed flight details
 *                           properties:
 *                             id:
 *                               type: string
 *                               example: "1"
 *                             price:
 *                               type: object
 *                               properties:
 *                                 total:
 *                                   type: string
 *                                   example: "855000.00"
 *                                 currency:
 *                                   type: string
 *                                   example: "NGN"
 *                         serviceCharges:
 *                           type: object
 *                           properties:
 *                             flightBookingCharges:
 *                               type: number
 *                               example: 5000
 *                         instructions:
 *                           type: object
 *                           properties:
 *                             payment:
 *                               type: string
 *                               example: "Complete payment within 30 minutes to confirm booking"
 *                             documents:
 *                               type: string
 *                               example: "Ensure passport is valid for at least 6 months from travel date"
 *       400:
 *         description: Invalid booking data or validation errors
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/StandardErrorResponse'
 *       401:
 *         description: Unauthorized (authentication required)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/StandardErrorResponse'
 *       409:
 *         description: Flight no longer available or price changed
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/StandardErrorResponse'
 *       500:
 *         description: Internal server error or Amadeus API error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/StandardErrorResponse'
 */
router.post('/flights/book', optionalAuthenticateUser, trackBookingReferralMiddleware, enhanceBookingConfirmationMiddleware, validate(flightBookSchema), bookFlight);

// --- Hotel Routes ---

/**
 * @openapi
 * /products/hotels/search:
 *   post:
 *     summary: Search for hotels using Ratehawk API
 *     tags: [Products, Hotels]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/HotelSearchRequest'
 *     responses:
 *       200:
 *         description: Hotel search results retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/StandardSuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/HotelSearchResponse'
 *       400:
 *         description: Invalid search criteria
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/StandardErrorResponse'
 *       500:
 *         description: Internal server error (Ratehawk API failure)
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
 *     summary: Book a hotel room
 *     tags: [Products, Hotels]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/HotelBookingRequest'
 *     responses:
 *       200:
 *         description: Hotel booking initiated successfully. Redirect to payment gateway.
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/StandardSuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/HotelBookingResponse'
 *       400:
 *         description: Invalid booking request or missing data
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/StandardErrorResponse'
 *       401:
 *         description: Unauthorized - Authentication required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/StandardErrorResponse'
 *       500:
 *         description: Internal server error (Paystack or service failure)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/StandardErrorResponse'
 */
router.post('/hotels/book', optionalAuthenticateUser, trackBookingReferralMiddleware, enhanceBookingConfirmationMiddleware, validate(hotelBookSchema), bookHotel);

/**
 * @openapi
 * /products/hotels/verify-payment:
 *   post:
 *     summary: Verify hotel payment and complete booking
 *     tags: [Products, Hotels]
 *     description: |
 *       Verifies payment with Paystack and completes the hotel booking with Ratehawk API.
 *       This endpoint is typically called by Paystack webhook or frontend after payment.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/HotelPaymentVerificationRequest'
 *     responses:
 *       200:
 *         description: Payment verified and hotel booking confirmed
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/StandardSuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/HotelPaymentVerificationResponse'
 *       400:
 *         description: Payment verification failed or invalid reference
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/StandardErrorResponse'
 *       404:
 *         description: Transaction not found
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
router.post('/hotels/verify-payment', verifyHotelPayment);

// --- Package Routes ---
router.get('/packages', getAvailablePackages);
router.get('/packages/:id', validate(mongoIdParamSchema), getPackageDetails);
router.post('/packages/:id/purchase', authenticateUser, trackBookingReferralMiddleware, enhanceBookingConfirmationMiddleware, validate(packagePurchaseSchema), initiatePackagePurchase);
router.post('/packages/verify-payment', validate(packagePaymentVerificationSchema), verifyPackagePayment);

// --- Visa Consultancy Routes ---

/**
 * @openapi
 * /products/visa/apply:
 *   post:
 *     summary: Submit a new visa consultancy application
 *     description: Simple visa consultancy service where users fill bio data, upload documents, and pay consultancy fee
 *     tags: [Products, Visa Consultancy]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - destinationCountry
 *               - visaType
 *               - personalInformation
 *               - contactInformation
 *             properties:
 *               destinationCountry:
 *                 type: string
 *                 description: Country for which visa is required
 *                 example: "United States"
 *               visaType:
 *                 type: string
 *                 enum: [Tourist, Business, Student, Transit, Work, Family Visit]
 *                 description: Type of visa being applied for
 *                 example: "Tourist"
 *               urgency:
 *                 type: string
 *                 enum: [Standard, Express]
 *                 description: Processing urgency level
 *                 example: "Standard"
 *                 default: "Standard"
 *               personalInformation:
 *                 type: object
 *                 required:
 *                   - firstName
 *                   - lastName
 *                   - dateOfBirth
 *                   - nationality
 *                   - passportNumber
 *                 properties:
 *                   firstName:
 *                     type: string
 *                     description: Applicant's first name
 *                     example: "John"
 *                   lastName:
 *                     type: string
 *                     description: Applicant's last name
 *                     example: "Doe"
 *                   otherNames:
 *                     type: string
 *                     description: Applicant's middle name(s)
 *                     example: "Michael"
 *                   dateOfBirth:
 *                     type: string
 *                     format: date
 *                     description: Date of birth (YYYY-MM-DD)
 *                     example: "1990-05-15"
 *                   gender:
 *                     type: string
 *                     enum: [Male, Female]
 *                     description: Applicant's gender
 *                     example: "Male"
 *                   nationality:
 *                     type: string
 *                     description: Applicant's nationality
 *                     example: "Nigerian"
 *                   maritalStatus:
 *                     type: string
 *                     enum: [Single, Married, Divorced, Widowed]
 *                     description: Marital status
 *                     example: "Single"
 *                   occupation:
 *                     type: string
 *                     description: Current occupation
 *                     example: "Software Engineer"
 *                   passportNumber:
 *                     type: string
 *                     description: International passport number
 *                     example: "A12345678"
 *                   passportExpiryDate:
 *                     type: string
 *                     format: date
 *                     description: Passport expiry date
 *                     example: "2030-05-15"
 *               contactInformation:
 *                 type: object
 *                 required:
 *                   - email
 *                   - phoneNumber
 *                   - address
 *                 properties:
 *                   email:
 *                     type: string
 *                     format: email
 *                     description: Contact email address
 *                     example: "john.doe@example.com"
 *                   phoneNumber:
 *                     type: string
 *                     description: Contact phone number
 *                     example: "+2348012345678"
 *                   address:
 *                     type: string
 *                     description: Residential address
 *                     example: "123 Main Street, Lagos, Nigeria"
 *                   city:
 *                     type: string
 *                     description: City of residence
 *                     example: "Lagos"
 *                   state:
 *                     type: string
 *                     description: State of residence
 *                     example: "Lagos State"
 *               travelInformation:
 *                 type: object
 *                 properties:
 *                   purposeOfTravel:
 *                     type: string
 *                     description: Purpose of travel
 *                     example: "Tourism and sightseeing"
 *                   intendedTravelDate:
 *                     type: string
 *                     format: date
 *                     description: Intended travel date
 *                     example: "2024-12-15"
 *                   durationOfStay:
 *                     type: string
 *                     description: Expected duration of stay
 *                     example: "2 weeks"
 *               additionalNotes:
 *                 type: string
 *                 description: Any additional information or special requests
 *                 example: "First time traveling to the US"
 *     responses:
 *       201:
 *         description: Visa consultancy application created successfully
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
 *                         applicationId:
 *                           type: string
 *                           description: Unique application ID
 *                           example: "VISA-APP-1678888888888"
 *                         status:
 *                           type: string
 *                           description: Application status
 *                           example: "Pending Document Upload"
 *                         consultancyFee:
 *                           type: number
 *                           description: Consultancy fee amount
 *                           example: 25000
 *                         currency:
 *                           type: string
 *                           description: Fee currency
 *                           example: "NGN"
 *                         requiredDocuments:
 *                           type: array
 *                           description: List of required documents to upload
 *                           items:
 *                             type: string
 *                           example: [
 *                             "International Passport Bio-data Page",
 *                             "Passport Photograph",
 *                             "Bank Statement (3 months)",
 *                             "Employment Letter"
 *                           ]
 *                         nextSteps:
 *                           type: string
 *                           description: Instructions for next steps
 *                           example: "Please upload the required documents and proceed to payment"
 *       400:
 *         description: Invalid request data
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
 */
router.post('/visa/apply', optionalAuthenticateUser, validate(visaApplicationSchema), initiateVisaApplication);

/**
 * @openapi
 * /products/visa/{id}/upload-document:
 *   post:
 *     summary: Upload document for visa consultancy application
 *     description: Upload required documents for visa consultancy service
 *     tags: [Products, Visa Consultancy]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Visa application ID
 *         example: "VISA-APP-1678888888888"
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - document
 *               - documentType
 *             properties:
 *               document:
 *                 type: string
 *                 format: binary
 *                 description: Document file to upload (PDF, JPG, PNG - max 5MB)
 *               documentType:
 *                 type: string
 *                 enum: [
 *                   "International Passport Bio-data Page",
 *                   "Passport Photograph", 
 *                   "Bank Statement",
 *                   "Employment Letter",
 *                   "Birth Certificate",
 *                   "Marriage Certificate",
 *                   "Educational Certificate",
 *                   "Invitation Letter",
 *                   "Other"
 *                 ]
 *                 description: Type of document being uploaded
 *                 example: "International Passport Bio-data Page"
 *               description:
 *                 type: string
 *                 description: Optional description or notes about the document
 *                 example: "Passport bio-data page showing personal details"
 *     responses:
 *       200:
 *         description: Document uploaded successfully
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
 *                         documentId:
 *                           type: string
 *                           description: Unique document ID
 *                           example: "DOC-1678888888888"
 *                         fileName:
 *                           type: string
 *                           description: Original file name
 *                           example: "passport_biodata.pdf"
 *                         documentType:
 *                           type: string
 *                           description: Type of document uploaded
 *                           example: "International Passport Bio-data Page"
 *                         uploadedAt:
 *                           type: string
 *                           format: date-time
 *                           description: Upload timestamp
 *                           example: "2024-01-15T10:30:00Z"
 *                         fileSize:
 *                           type: number
 *                           description: File size in bytes
 *                           example: 1048576
 *                         status:
 *                           type: string
 *                           description: Document verification status
 *                           example: "Pending Review"
 *                         remainingDocuments:
 *                           type: array
 *                           description: List of remaining required documents
 *                           items:
 *                             type: string
 *                           example: ["Passport Photograph", "Bank Statement"]
 *       400:
 *         description: Invalid file, document type, or file size exceeded
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
 *       404:
 *         description: Visa application not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/StandardErrorResponse'
 */
router.post('/visa/:id/upload-document', authenticateUser, upload.single('document'), validate(visaDocumentUploadSchema), uploadVisaDocument);

/**
 * @openapi
 * /products/visa/{id}:
 *   get:
 *     summary: Get visa consultancy application details
 *     description: Retrieve complete details of a visa consultancy application including status and documents
 *     tags: [Products, Visa Consultancy]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Visa application ID
 *         example: "VISA-APP-1678888888888"
 *     responses:
 *       200:
 *         description: Visa application details retrieved successfully
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
 *                         applicationId:
 *                           type: string
 *                           example: "VISA-APP-1678888888888"
 *                         status:
 *                           type: string
 *                           enum: [
 *                             "Pending Document Upload",
 *                             "Documents Under Review", 
 *                             "Payment Pending",
 *                             "In Progress",
 *                             "Completed",
 *                             "Rejected"
 *                           ]
 *                           example: "Documents Under Review"
 *                         destinationCountry:
 *                           type: string
 *                           example: "United States"
 *                         visaType:
 *                           type: string
 *                           example: "Tourist"
 *                         urgency:
 *                           type: string
 *                           example: "Standard"
 *                         personalInformation:
 *                           type: object
 *                           properties:
 *                             firstName:
 *                               type: string
 *                               example: "John"
 *                             lastName:
 *                               type: string
 *                               example: "Doe"
 *                             email:
 *                               type: string
 *                               example: "john.doe@example.com"
 *                             phoneNumber:
 *                               type: string
 *                               example: "+2348012345678"
 *                         consultancyFee:
 *                           type: object
 *                           properties:
 *                             amount:
 *                               type: number
 *                               example: 25000
 *                             currency:
 *                               type: string
 *                               example: "NGN"
 *                             paymentStatus:
 *                               type: string
 *                               enum: ["Pending", "Paid", "Failed"]
 *                               example: "Pending"
 *                         uploadedDocuments:
 *                           type: array
 *                           items:
 *                             type: object
 *                             properties:
 *                               documentId:
 *                                 type: string
 *                                 example: "DOC-1678888888888"
 *                               documentType:
 *                                 type: string
 *                                 example: "International Passport Bio-data Page"
 *                               fileName:
 *                                 type: string
 *                                 example: "passport_biodata.pdf"
 *                               uploadedAt:
 *                                 type: string
 *                                 format: date-time
 *                                 example: "2024-01-15T10:30:00Z"
 *                               status:
 *                                 type: string
 *                                 enum: ["Pending Review", "Approved", "Rejected"]
 *                                 example: "Approved"
 *                         requiredDocuments:
 *                           type: array
 *                           items:
 *                             type: string
 *                           example: ["Passport Photograph", "Bank Statement"]
 *                         applicationDate:
 *                           type: string
 *                           format: date-time
 *                           example: "2024-01-15T09:00:00Z"
 *                         lastUpdated:
 *                           type: string
 *                           format: date-time
 *                           example: "2024-01-15T10:30:00Z"
 *                         notes:
 *                           type: array
 *                           description: Staff notes and updates
 *                           items:
 *                             type: object
 *                             properties:
 *                               note:
 *                                 type: string
 *                                 example: "Documents received and under review"
 *                               addedBy:
 *                                 type: string
 *                                 example: "Staff Member"
 *                               addedAt:
 *                                 type: string
 *                                 format: date-time
 *                                 example: "2024-01-15T10:30:00Z"
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/StandardErrorResponse'
 *       404:
 *         description: Visa application not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/StandardErrorResponse'
 */
router.get('/visa/:id', authenticateUser, getVisaApplicationDetails);

/**
 * @openapi
 * /products/visa/{id}/status:
 *   put:
 *     summary: Update visa application status (Staff only)
 *     tags: [Products, Visa Processing, Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Visa application ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [Pending, Under Review, Additional Documents Required, Approved, Rejected]
 *                 description: New status for the application
 *               note:
 *                 type: string
 *                 description: Optional note about the status change
 *     responses:
 *       200:
 *         description: Status updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/StandardSuccessResponse'
 *       403:
 *         description: Insufficient permissions
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/StandardErrorResponse'
 */
router.put('/visa/:id/status', authenticateUser, authorizeRoles(UserRoles.STAFF, UserRoles.MANAGER, UserRoles.EXECUTIVE, UserRoles.ADMIN), validate(visaStatusUpdateSchema), updateVisaApplicationStatus);

/**
 * @openapi
 * /products/visa/{id}/payment:
 *   post:
 *     summary: Process payment for visa consultancy fee
 *     description: Initiate payment for visa consultancy service using Paystack
 *     tags: [Products, Visa Consultancy, Payments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Visa application ID
 *         example: "VISA-APP-1678888888888"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               paymentMethod:
 *                 type: string
 *                 enum: [paystack]
 *                 default: "paystack"
 *                 description: Payment gateway to use
 *               currency:
 *                 type: string
 *                 enum: [NGN, USD, GHS, ZAR, KES]
 *                 default: "NGN"
 *                 description: Payment currency
 *                 example: "NGN"
 *               callback_url:
 *                 type: string
 *                 format: uri
 *                 description: URL to redirect after payment completion
 *                 example: "https://yourapp.com/visa/payment/callback"
 *     responses:
 *       200:
 *         description: Payment initiated successfully
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
 *                         paymentReference:
 *                           type: string
 *                           description: Payment transaction reference
 *                           example: "TTP-VISA-PAY-1678888888888"
 *                         authorizationUrl:
 *                           type: string
 *                           description: Paystack payment URL
 *                           example: "https://checkout.paystack.com/mock_auth_url"
 *                         amount:
 *                           type: number
 *                           description: Total amount to be paid
 *                           example: 25000
 *                         currency:
 *                           type: string
 *                           description: Payment currency
 *                           example: "NGN"
 *                         consultancyFee:
 *                           type: number
 *                           description: Base consultancy fee
 *                           example: 25000
 *                         serviceCharges:
 *                           type: object
 *                           properties:
 *                             visaProcessingCharges:
 *                               type: number
 *                               example: 0
 *                         expiresAt:
 *                           type: string
 *                           format: date-time
 *                           description: Payment link expiry time
 *                           example: "2024-01-15T11:30:00Z"
 *       400:
 *         description: Payment already completed, invalid amount, or missing documents
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
 *       404:
 *         description: Visa application not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/StandardErrorResponse'
 */
router.post('/visa/:id/payment', authenticateUser, validate(visaPaymentSchema), processVisaPayment);

/**
 * @openapi
 * /products/visa/{id}/verify-payment:
 *   post:
 *     summary: Verify visa consultancy payment
 *     description: Verify payment completion for visa consultancy service
 *     tags: [Products, Visa Consultancy, Payments]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Visa application ID
 *         example: "VISA-APP-1678888888888"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - reference
 *             properties:
 *               reference:
 *                 type: string
 *                 description: Paystack payment reference
 *                 example: "TTP-VISA-PAY-1678888888888"
 *     responses:
 *       200:
 *         description: Payment verified successfully
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
 *                         paymentStatus:
 *                           type: string
 *                           enum: ["success", "failed"]
 *                           example: "success"
 *                         transactionReference:
 *                           type: string
 *                           example: "TTP-VISA-PAY-1678888888888"
 *                         amountPaid:
 *                           type: number
 *                           example: 25000
 *                         currency:
 *                           type: string
 *                           example: "NGN"
 *                         paidAt:
 *                           type: string
 *                           format: date-time
 *                           example: "2024-01-15T10:30:00Z"
 *                         applicationStatus:
 *                           type: string
 *                           description: Updated application status after payment
 *                           example: "In Progress"
 *                         nextSteps:
 *                           type: string
 *                           description: Instructions for what happens next
 *                           example: "Your payment has been confirmed. Our team will begin processing your visa consultancy within 24 hours."
 *       400:
 *         description: Invalid payment reference or verification failed
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/StandardErrorResponse'
 *       404:
 *         description: Visa application not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/StandardErrorResponse'
 */
router.post('/visa/:id/verify-payment', validate(visaPaymentVerificationSchema), verifyVisaPayment);

// Note: Additional visa endpoints like requirements lookup, fee calculation, 
// processing centers, and appointment scheduling are not implemented in this 
// simple visa consultancy service. The service focuses on basic application 
// submission, document upload, and payment processing.

/**
 * @openapi
 * /products/visa/requirements/{countryCode}:
 *   get:
 *     summary: Get visa requirements for a country
 *     tags: [Products, Visa Processing]
 *     parameters:
 *       - in: path
 *         name: countryCode
 *         required: true
 *         schema:
 *           type: string
 *         description: Destination country code (e.g., US, UK, CA)
 *       - in: query
 *         name: visaType
 *         required: true
 *         schema:
 *           type: string
 *           enum: [Tourist, Business, Student, Transit, Work]
 *         description: Type of visa
 *       - in: query
 *         name: nationality
 *         schema:
 *           type: string
 *           default: "Nigeria"
 *         description: Applicant's nationality
 *     responses:
 *       200:
 *         description: Visa requirements retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/StandardSuccessResponse'
 *       400:
 *         description: Missing required parameters
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/StandardErrorResponse'
 */
router.get('/visa/requirements/:countryCode', validate(visaRequirementsSchema), getVisaRequirements);

/**
 * @openapi
 * /products/visa/calculate-fees:
 *   post:
 *     summary: Calculate visa application fees
 *     tags: [Products, Visa Processing]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - destinationCountry
 *               - visaType
 *             properties:
 *               destinationCountry:
 *                 type: string
 *                 description: Destination country code
 *                 example: "US"
 *               visaType:
 *                 type: string
 *                 enum: [Tourist, Business, Student, Transit, Work]
 *                 example: "Tourist"
 *               urgency:
 *                 type: string
 *                 enum: [Standard, Express, Super Express]
 *                 default: "Standard"
 *               nationality:
 *                 type: string
 *                 default: "Nigeria"
 *                 description: Applicant's nationality
 *     responses:
 *       200:
 *         description: Visa fees calculated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/StandardSuccessResponse'
 *       400:
 *         description: Missing required parameters
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/StandardErrorResponse'
 */
router.post('/visa/calculate-fees', validate(visaFeesCalculationSchema), calculateVisaApplicationFees);

/**
 * @openapi
 * /products/visa/processing-centers/{countryCode}:
 *   get:
 *     summary: Get visa processing centers for a country
 *     tags: [Products, Visa Processing]
 *     parameters:
 *       - in: path
 *         name: countryCode
 *         required: true
 *         schema:
 *           type: string
 *         description: Destination country code
 *       - in: query
 *         name: applicantLocation
 *         schema:
 *           type: string
 *           default: "Lagos"
 *         description: Applicant's location/city
 *     responses:
 *       200:
 *         description: Processing centers retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/StandardSuccessResponse'
 *       400:
 *         description: Missing required parameters
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/StandardErrorResponse'
 */
router.get('/visa/processing-centers/:countryCode', validate(visaProcessingCentersSchema), getVisaProcessingCenters);

/**
 * @openapi
 * /products/visa/{id}/schedule-appointment:
 *   post:
 *     summary: Schedule biometric appointment for visa application
 *     tags: [Products, Visa Processing]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Visa application ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - preferredDate
 *               - preferredTime
 *               - location
 *             properties:
 *               preferredDate:
 *                 type: string
 *                 format: date
 *                 description: Preferred appointment date
 *               preferredTime:
 *                 type: string
 *                 description: Preferred appointment time
 *                 example: "10:00 AM"
 *               location:
 *                 type: string
 *                 description: Processing center location
 *               type:
 *                 type: string
 *                 enum: [biometric, interview]
 *                 default: "biometric"
 *               specialRequirements:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Any special requirements or accommodations
 *     responses:
 *       200:
 *         description: Appointment scheduled successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/StandardSuccessResponse'
 *       400:
 *         description: Invalid appointment data or no external reference
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/StandardErrorResponse'
 */
router.post('/visa/:id/schedule-appointment', authenticateUser, validate(visaAppointmentSchema), scheduleVisaAppointment);

/**
 * @openapi
 * /products/visa/{id}/status:
 *   get:
 *     summary: Check real-time visa application status
 *     tags: [Products, Visa Processing]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Visa application ID
 *     responses:
 *       200:
 *         description: Status retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/StandardSuccessResponse'
 *       404:
 *         description: Application not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/StandardErrorResponse'
 */
router.get('/visa/:id/status', checkVisaApplicationStatus);

// --- Flight Routes ---
router.post('/flights/search', searchFlights);

// --- Health Check Route ---
router.get('/health/sanlam-allianz', checkSanlamAllianzApiHealth);

module.exports = router;