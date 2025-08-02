// v1/utils/validationSchemas.js
const { z } = require('zod');

// Common validation patterns
const phoneRegex = /^\+?[1-9]\d{1,14}$/;
const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/;

// Base schemas for reuse
const emailSchema = z.string().email('Invalid email address').max(255, 'Email cannot exceed 255 characters');
const phoneSchema = z.string().regex(phoneRegex, 'Invalid phone number format (E.164)').min(7, 'Phone number must be at least 7 digits').max(15, 'Phone number cannot exceed 15 digits');
const nameSchema = z.string().min(2, 'Name must be at least 2 characters long').max(50, 'Name cannot exceed 50 characters').regex(/^[a-zA-Z\s'-]+$/, 'Name can only contain letters, spaces, hyphens, and apostrophes');
const strongPasswordSchema = z.string().min(8, 'Password must be at least 8 characters long').max(128, 'Password cannot exceed 128 characters').regex(passwordRegex, 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character');

// Auth Schemas
const registerSchema = z.object({
  body: z.object({
    firstName: nameSchema,
    lastName: nameSchema,
    otherNames: nameSchema.optional(),
    email: emailSchema,
    phoneNumber: phoneSchema,
    password: strongPasswordSchema,
    role: z.enum(['User', 'Business', 'Staff', 'Manager', 'Executive', 'Admin']).default('User'),
  }),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

const loginSchema = z.object({
  body: z.object({
    emailOrPhone: z.string().min(1, 'Email or Phone is required').max(255, 'Email or Phone cannot exceed 255 characters'),
    password: z.string().min(1, 'Password is required').max(128, 'Password cannot exceed 128 characters'),
  }),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

const forgotPasswordSchema = z.object({
  body: z.object({
    emailOrPhone: z.string().min(1, 'Email or Phone is required').max(255, 'Email or Phone cannot exceed 255 characters'),
  }),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

const resetPasswordSchema = z.object({
  body: z.object({
    token: z.string().min(1, 'Reset token is required').max(500, 'Invalid token format'),
    newPassword: strongPasswordSchema,
  }),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

const verifyEmailSchema = z.object({
  body: z.object({}).optional(),
  query: z.object({
    token: z.string().min(1, 'Verification token is required').max(500, 'Invalid token format'),
  }),
  params: z.object({}).optional(),
});

const verifyPhoneSchema = z.object({
  body: z.object({
    phoneNumber: phoneSchema,
    otp: z.string().length(6, 'OTP must be 6 digits').regex(/^\d{6}$/, 'OTP must contain only digits'),
  }),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

const googleLoginSchema = z.object({
  body: z.object({
    googleId: z.string().min(1, 'Google ID is required').max(100, 'Invalid Google ID format'),
    email: emailSchema,
    firstName: nameSchema,
    lastName: nameSchema,
    otherNames: nameSchema.optional(),
  }),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

// Product Schemas
const updateServiceChargeSchema = z.object({
  body: z.object({
    value: z.number().min(0, 'Service charge value cannot be negative').max(1000000, 'Service charge value is too high'),
  }),
  query: z.object({}).optional(),
  params: z.object({
    chargeName: z.string().min(1, 'Charge name is required').max(100, 'Charge name is too long'),
  }),
});

const travelInsuranceQuoteSchema = z.object({
  body: z.object({
    DateOfBirth: z.string().regex(/^\d{2}-[A-Za-z]{3}-\d{4}$/, 'Date of birth must be in DD-MMM-YYYY format'),
    Email: emailSchema,
    Telephone: phoneSchema,
    CoverBegins: z.string().regex(/^\d{2}-[A-Za-z]{3}-\d{4}$/, 'Cover begins date must be in DD-MMM-YYYY format'),
    CoverEnds: z.string().regex(/^\d{2}-[A-Za-z]{3}-\d{4}$/, 'Cover ends date must be in DD-MMM-YYYY format'),
    CountryId: z.number().int().positive('Country ID must be a positive integer'),
    PurposeOfTravel: z.string().min(1, 'Purpose of travel is required').max(100, 'Purpose of travel is too long'),
    TravelPlanId: z.number().int().positive('Travel plan ID must be a positive integer'),
    BookingTypeId: z.number().int().positive('Booking type ID must be a positive integer'),
    IsRoundTrip: z.boolean(),
    NoOfPeople: z.number().int().min(1, 'Number of people must be at least 1').max(20, 'Number of people cannot exceed 20'),
    NoOfChildren: z.number().int().min(0, 'Number of children cannot be negative').max(10, 'Number of children cannot exceed 10'),
    IsMultiTrip: z.boolean(),
  }),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

const travelInsurancePurchaseIndividualSchema = z.object({
  body: z.object({
    quoteId: z.number().int().positive('Quote ID must be a positive integer'),
    customerDetails: z.object({
      Surname: nameSchema,
      MiddleName: nameSchema.optional(),
      FirstName: nameSchema,
      GenderId: z.number().int().min(1).max(2, 'Gender ID must be 1 or 2'),
      TitleId: z.number().int().positive('Title ID must be a positive integer'),
      DateOfBirth: z.string().regex(/^\d{2}-[A-Za-z]{3}-\d{4}$/, 'Date of birth must be in DD-MMM-YYYY format'),
      Email: emailSchema,
      Telephone: phoneSchema,
      StateId: z.number().int().positive('State ID must be a positive integer'),
      Address: z.string().min(10, 'Address must be at least 10 characters').max(500, 'Address cannot exceed 500 characters'),
      ZipCode: z.string().min(3, 'Zip code must be at least 3 characters').max(20, 'Zip code cannot exceed 20 characters'),
      Nationality: z.string().min(2, 'Nationality must be at least 2 characters').max(50, 'Nationality cannot exceed 50 characters'),
      PassportNo: z.string().min(6, 'Passport number must be at least 6 characters').max(20, 'Passport number cannot exceed 20 characters'),
      IdentificationPath: z.string().optional(),
      Occupation: z.string().min(2, 'Occupation must be at least 2 characters').max(100, 'Occupation cannot exceed 100 characters'),
      MaritalStatusId: z.number().int().positive('Marital status ID must be a positive integer'),
      PreExistingMedicalCondition: z.boolean(),
      MedicalCondition: z.string().max(1000, 'Medical condition description cannot exceed 1000 characters').optional(),
      NextOfKin: z.object({
        FullName: z.string().min(2, 'Next of kin name must be at least 2 characters').max(100, 'Next of kin name cannot exceed 100 characters'),
        Address: z.string().min(10, 'Next of kin address must be at least 10 characters').max(500, 'Next of kin address cannot exceed 500 characters'),
        Relationship: z.string().min(2, 'Relationship must be at least 2 characters').max(50, 'Relationship cannot exceed 50 characters'),
        Telephone: phoneSchema,
      }),
    }),
    paymentDetails: z.object({}).optional(),
    referralCode: z.string().min(3, 'Referral code must be at least 3 characters').max(50, 'Referral code cannot exceed 50 characters').trim().toUpperCase().optional(),
  }),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

const flightSearchSchema = z.object({
  body: z.object({
    originLocationCode: z.string().length(3, 'Origin location code must be 3 characters').regex(/^[A-Z]{3}$/, 'Origin location code must be uppercase letters'),
    destinationLocationCode: z.string().length(3, 'Destination location code must be 3 characters').regex(/^[A-Z]{3}$/, 'Destination location code must be uppercase letters'),
    departureDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Departure date must be in YYYY-MM-DD format'),
    returnDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Return date must be in YYYY-MM-DD format').optional(),
    adults: z.number().int().min(1, 'At least 1 adult is required').max(9, 'Maximum 9 adults allowed'),
    children: z.number().int().min(0, 'Children count cannot be negative').max(9, 'Maximum 9 children allowed').default(0),
    travelClass: z.enum(['ECONOMY', 'PREMIUM_ECONOMY', 'BUSINESS', 'FIRST']).default('ECONOMY'),
    currencyCode: z.string().length(3, 'Currency code must be 3 characters').regex(/^[A-Z]{3}$/, 'Currency code must be uppercase letters').default('NGN'),
  }),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

const flightBookSchema = z.object({
  body: z.object({
    flightDetails: z.object({
      id: z.string().min(1, 'Flight ID is required').max(100, 'Flight ID is too long'),
      price: z.number().positive('Flight price must be positive'),
    }),
    passengerDetails: z.object({
      firstName: nameSchema,
      lastName: nameSchema,
      email: emailSchema,
      phoneNumber: phoneSchema,
      dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date of birth must be in YYYY-MM-DD format').optional(),
      gender: z.enum(['Male', 'Female', 'Other']).optional(),
      passportNumber: z.string().min(6, 'Passport number must be at least 6 characters').max(20, 'Passport number cannot exceed 20 characters').optional(),
    }),
    paymentDetails: z.object({}).optional(),
    referralCode: z.string().min(3, 'Referral code must be at least 3 characters').max(50, 'Referral code cannot exceed 50 characters').trim().toUpperCase().optional(),
  }),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

const hotelSearchSchema = z.object({
  body: z.object({
    checkin: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Check-in date must be in YYYY-MM-DD format'),
    checkout: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Check-out date must be in YYYY-MM-DD format'),
    country: z.string().length(2, 'Country code must be 2 characters').regex(/^[A-Z]{2}$/, 'Country code must be uppercase letters'),
    city: z.string().min(2, 'City name must be at least 2 characters').max(100, 'City name cannot exceed 100 characters'),
    adults: z.number().int().min(1, 'At least 1 adult is required').max(20, 'Maximum 20 adults allowed'),
    children: z.array(z.number().int().min(0).max(17, 'Child age cannot exceed 17')).max(10, 'Maximum 10 children allowed').default([]),
    currency: z.string().length(3, 'Currency code must be 3 characters').regex(/^[A-Z]{3}$/, 'Currency code must be uppercase letters').default('NGN'),
  }),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

const hotelBookSchema = z.object({
  body: z.object({
    hotelDetails: z.object({
      id: z.string().min(1, 'Hotel ID is required').max(100, 'Hotel ID is too long'),
      price: z.number().positive('Hotel price must be positive'),
    }),
    guestDetails: z.object({
      firstName: nameSchema,
      lastName: nameSchema,
      email: emailSchema,
      phoneNumber: phoneSchema,
    }),
    paymentDetails: z.object({}).optional(),
    referralCode: z.string().min(3, 'Referral code must be at least 3 characters').max(50, 'Referral code cannot exceed 50 characters').trim().toUpperCase().optional(),
  }),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

const visaApplicationSchema = z.object({
  body: z.object({
    destinationCountry: z.string().min(2, 'Destination country must be at least 2 characters').max(100, 'Destination country cannot exceed 100 characters'),
    visaType: z.enum(['Tourist', 'Business', 'Student', 'Transit', 'Work'], {
      errorMap: () => ({ message: 'Visa type must be one of: Tourist, Business, Student, Transit, Work' })
    }),
    travelPurpose: z.string().min(2, 'Purpose of travel must be at least 2 characters').max(200, 'Purpose of travel cannot exceed 200 characters'),
    urgency: z.enum(['Standard', 'Express', 'Super Express']).optional(),
    travelDates: z.object({
      startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Start date must be in YYYY-MM-DD format').optional(),
      endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'End date must be in YYYY-MM-DD format').optional(),
    }).optional(),
    personalInformation: z.object({
      firstName: nameSchema,
      lastName: nameSchema,
      otherNames: nameSchema.optional(),
      dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date of birth must be in YYYY-MM-DD format'),
      gender: z.enum(['Male', 'Female', 'Other']),
      nationality: z.string().min(2, 'Nationality must be at least 2 characters').max(50, 'Nationality cannot exceed 50 characters'),
      maritalStatus: z.enum(['Single', 'Married', 'Divorced', 'Widowed']),
      occupation: z.string().min(2, 'Occupation must be at least 2 characters').max(100, 'Occupation cannot exceed 100 characters'),
      address: z.string().min(10, 'Address must be at least 10 characters').max(500, 'Address cannot exceed 500 characters'),
    }).optional(),
    passportDetails: z.object({
      passportNumber: z.string().min(6, 'Passport number must be at least 6 characters').optional(),
      issueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Issue date must be in YYYY-MM-DD format').optional(),
      expiryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expiry date must be in YYYY-MM-DD format').optional(),
      placeOfIssue: z.string().min(2, 'Place of issue must be at least 2 characters').optional(),
    }).optional(),
    guestEmail: emailSchema.optional(),
    guestPhoneNumber: phoneSchema.optional(),
    referralCode: z.string().min(3, 'Referral code must be at least 3 characters').max(50, 'Referral code cannot exceed 50 characters').trim().toUpperCase().optional(),
  }),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

const visaDocumentUploadSchema = z.object({
  body: z.object({
    documentType: z.enum(['International Passport', 'Passport Photograph', 'Bank Statement', 'Flight Itinerary', 'Hotel Booking', 'Invitation Letter', 'Other']),
  }),
  query: z.object({}).optional(),
  params: z.object({
    id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid visa application ID format'),
  }),
});

const visaStatusUpdateSchema = z.object({
  body: z.object({
    status: z.enum(['Pending', 'Under Review', 'Additional Documents Required', 'Approved', 'Rejected']),
    note: z.string().max(1000, 'Note cannot exceed 1000 characters').optional(),
  }),
  query: z.object({}).optional(),
  params: z.object({
    id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid visa application ID format'),
  }),
});

const visaPaymentSchema = z.object({
  body: z.object({
    paymentMethod: z.enum(['paystack']).optional(),
  }),
  query: z.object({}).optional(),
  params: z.object({
    id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid visa application ID format'),
  }),
});

const visaPaymentVerificationSchema = z.object({
  body: z.object({
    reference: z.string().min(1, 'Payment reference is required'),
  }),
  query: z.object({}).optional(),
  params: z.object({
    id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid visa application ID format'),
  }),
});

// Guest checkout schema
const guestCheckoutSchema = z.object({
  body: z.object({
    email: emailSchema.optional(),
    phoneNumber: phoneSchema.optional(),
  }).refine(data => data.email || data.phoneNumber, {
    message: "Either email or phone number is required for guest checkout.",
    path: ["emailOrPhone"],
  }),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

// Content Management Schemas
const createPostSchema = z.object({
  body: z.object({
    title: z.string().min(1, 'Title is required').max(200, 'Title cannot exceed 200 characters').trim(),
    content: z.string().min(1, 'Content is required'),
    excerpt: z.string().max(500, 'Excerpt cannot exceed 500 characters').trim().optional(),
    postType: z.enum(['Articles', 'Packages'], { required_error: 'Post type is required' }),
    price: z.number().min(0, 'Price cannot be negative').optional(),
    currency: z.enum(['NGN', 'USD', 'EUR', 'GBP']).default('NGN'),
    categories: z.array(z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid category ID format')).optional(),
    tags: z.array(z.string().trim().max(50, 'Tag cannot exceed 50 characters')).optional(),
    status: z.enum(['Draft', 'Published', 'Archived']).default('Draft'),
    featuredImage: z.string().url('Featured image must be a valid URL').optional(),
    gallery: z.array(z.string().url('Gallery image must be a valid URL')).optional(),
    metadata: z.object({
      seoTitle: z.string().max(60, 'SEO title cannot exceed 60 characters').trim().optional(),
      seoDescription: z.string().max(160, 'SEO description cannot exceed 160 characters').trim().optional(),
      duration: z.string().trim().optional(),
      location: z.string().trim().optional(),
      inclusions: z.array(z.string().trim()).optional(),
      exclusions: z.array(z.string().trim()).optional(),
      maxParticipants: z.number().min(1, 'Max participants must be at least 1').optional(),
      difficulty: z.enum(['Easy', 'Moderate', 'Challenging', 'Expert']).optional(),
      readingTime: z.number().min(1, 'Reading time must be at least 1 minute').optional(),
      wordCount: z.number().min(0, 'Word count cannot be negative').optional(),
    }).optional(),
    isFeatured: z.boolean().default(false),
    availability: z.object({
      startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Start date must be in YYYY-MM-DD format').optional(),
      endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'End date must be in YYYY-MM-DD format').optional(),
      isAvailable: z.boolean().default(true),
    }).optional(),
  }).refine(data => {
    // Price is required for Packages
    if (data.postType === 'Packages' && (data.price === undefined || data.price === null)) {
      return false;
    }
    return true;
  }, {
    message: 'Price is required for Packages',
    path: ['price'],
  }).refine(data => {
    // Package-specific metadata validation
    if (data.postType === 'Packages') {
      const metadata = data.metadata || {};
      return metadata.duration && metadata.location && metadata.maxParticipants && metadata.difficulty;
    }
    return true;
  }, {
    message: 'Duration, location, max participants, and difficulty are required for Packages',
    path: ['metadata'],
  }).refine(data => {
    // Availability dates validation for Packages
    if (data.postType === 'Packages' && data.availability) {
      const { startDate, endDate } = data.availability;
      if (startDate && endDate) {
        return new Date(startDate) < new Date(endDate);
      }
    }
    return true;
  }, {
    message: 'End date must be after start date',
    path: ['availability'],
  }),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

const updatePostSchema = z.object({
  body: z.object({
    title: z.string().min(1, 'Title is required').max(200, 'Title cannot exceed 200 characters').trim().optional(),
    content: z.string().min(1, 'Content is required').optional(),
    excerpt: z.string().max(500, 'Excerpt cannot exceed 500 characters').trim().optional(),
    postType: z.enum(['Articles', 'Packages']).optional(),
    price: z.number().min(0, 'Price cannot be negative').optional(),
    currency: z.enum(['NGN', 'USD', 'EUR', 'GBP']).optional(),
    categories: z.array(z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid category ID format')).optional(),
    tags: z.array(z.string().trim().max(50, 'Tag cannot exceed 50 characters')).optional(),
    status: z.enum(['Draft', 'Published', 'Archived']).optional(),
    featuredImage: z.string().url('Featured image must be a valid URL').optional(),
    gallery: z.array(z.string().url('Gallery image must be a valid URL')).optional(),
    metadata: z.object({
      seoTitle: z.string().max(60, 'SEO title cannot exceed 60 characters').trim().optional(),
      seoDescription: z.string().max(160, 'SEO description cannot exceed 160 characters').trim().optional(),
      duration: z.string().trim().optional(),
      location: z.string().trim().optional(),
      inclusions: z.array(z.string().trim()).optional(),
      exclusions: z.array(z.string().trim()).optional(),
      maxParticipants: z.number().min(1, 'Max participants must be at least 1').optional(),
      difficulty: z.enum(['Easy', 'Moderate', 'Challenging', 'Expert']).optional(),
      readingTime: z.number().min(1, 'Reading time must be at least 1 minute').optional(),
      wordCount: z.number().min(0, 'Word count cannot be negative').optional(),
    }).optional(),
    isFeatured: z.boolean().optional(),
    availability: z.object({
      startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Start date must be in YYYY-MM-DD format').optional(),
      endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'End date must be in YYYY-MM-DD format').optional(),
      isAvailable: z.boolean().optional(),
    }).optional(),
  }),
  query: z.object({}).optional(),
  params: z.object({
    id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid post ID format'),
  }),
});

const createCategorySchema = z.object({
  body: z.object({
    name: z.string().min(1, 'Category name is required').max(100, 'Category name cannot exceed 100 characters').trim(),
    description: z.string().max(1000, 'Description cannot exceed 1000 characters').trim().optional(),
    parentCategory: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid parent category ID format').optional(),
    sortOrder: z.number().min(0, 'Sort order cannot be negative').default(0),
    metadata: z.object({
      seoTitle: z.string().max(60, 'SEO title cannot exceed 60 characters').trim().optional(),
      seoDescription: z.string().max(160, 'SEO description cannot exceed 160 characters').trim().optional(),
      color: z.string().regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, 'Color must be a valid hex color').optional(),
      icon: z.string().trim().optional(),
    }).optional(),
  }),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

const updateCategorySchema = z.object({
  body: z.object({
    name: z.string().min(1, 'Category name is required').max(100, 'Category name cannot exceed 100 characters').trim().optional(),
    description: z.string().max(1000, 'Description cannot exceed 1000 characters').trim().optional(),
    parentCategory: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid parent category ID format').optional(),
    sortOrder: z.number().min(0, 'Sort order cannot be negative').optional(),
    metadata: z.object({
      seoTitle: z.string().max(60, 'SEO title cannot exceed 60 characters').trim().optional(),
      seoDescription: z.string().max(160, 'SEO description cannot exceed 160 characters').trim().optional(),
      color: z.string().regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, 'Color must be a valid hex color').optional(),
      icon: z.string().trim().optional(),
    }).optional(),
  }),
  query: z.object({}).optional(),
  params: z.object({
    id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid category ID format'),
  }),
});

const getPostsQuerySchema = z.object({
  body: z.object({}).optional(),
  query: z.object({
    page: z.string().regex(/^\d+$/, 'Page must be a number').transform(Number).refine(val => val > 0, 'Page must be greater than 0').default('1'),
    limit: z.string().regex(/^\d+$/, 'Limit must be a number').transform(Number).refine(val => val > 0 && val <= 100, 'Limit must be between 1 and 100').default('10'),
    postType: z.enum(['Articles', 'Packages']).optional(),
    status: z.enum(['Draft', 'Published', 'Archived']).optional(),
    category: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid category ID format').optional(),
    tag: z.string().trim().optional(),
    author: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid author ID format').optional(),
    featured: z.enum(['true', 'false']).transform(val => val === 'true').optional(),
    search: z.string().trim().optional(),
    sortBy: z.enum(['createdAt', 'publishedAt', 'title', 'viewCount']).default('createdAt'),
    sortOrder: z.enum(['asc', 'desc']).default('desc'),
  }).optional(),
  params: z.object({}).optional(),
});

// Bulk operations schemas
const bulkPostOperationSchema = z.object({
  body: z.object({
    postIds: z.array(z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid post ID format'))
      .min(1, 'At least one post ID is required')
      .max(50, 'Maximum 50 posts allowed for bulk operations'),
  }),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

const contentSchedulingSchema = z.object({
  body: z.object({
    publishAt: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?$/, 'Invalid publish date format (ISO 8601)').optional(),
    archiveAt: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?$/, 'Invalid archive date format (ISO 8601)').optional(),
  }),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

const duplicatePostSchema = z.object({
  body: z.object({
    sourcePostId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid source post ID format'),
    newTitle: z.string().min(1, 'New title is required').max(200, 'Title cannot exceed 200 characters').trim().optional(),
    newSlug: z.string().min(1, 'New slug is required').max(100, 'Slug cannot exceed 100 characters').trim().optional(),
    copyCategories: z.boolean().default(true),
    copyTags: z.boolean().default(true),
    copyMetadata: z.boolean().default(true),
    status: z.enum(['Draft', 'Published', 'Archived']).default('Draft'),
  }),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

// Package schemas
const packagePurchaseSchema = z.object({
  body: z.object({
    customerDetails: z.object({
      email: emailSchema.optional(),
      phoneNumber: phoneSchema.optional(),
      firstName: nameSchema.optional(),
      lastName: nameSchema.optional(),
    }).refine(data => {
      // For guest checkout, email and phone are required
      // For authenticated users, they're optional
      return true; // We'll handle this validation in the controller
    }),
    participants: z.number().int().min(1, 'At least 1 participant is required').max(50, 'Maximum 50 participants allowed').default(1),
    specialRequests: z.string().max(1000, 'Special requests cannot exceed 1000 characters').trim().optional(),
    referralCode: z.string().min(3, 'Referral code must be at least 3 characters').max(50, 'Referral code cannot exceed 50 characters').trim().toUpperCase().optional(),
  }),
  query: z.object({}).optional(),
  params: z.object({
    packageId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid package ID format'),
  }),
});

const packagePaymentVerificationSchema = z.object({
  body: z.object({
    reference: z.string().min(1, 'Payment reference is required').max(100, 'Payment reference is too long'),
  }),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

// Generic ID parameter validation
const mongoIdParamSchema = z.object({
  body: z.object({}).optional(),
  query: z.object({}).optional(),
  params: z.object({
    id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid ID format'),
  }),
});

module.exports = {
  // Auth schemas
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  verifyEmailSchema,
  verifyPhoneSchema,
  googleLoginSchema,
  
  // Product schemas
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
  
  // Package schemas
  packagePurchaseSchema,
  packagePaymentVerificationSchema,
  
  // Content Management schemas
  createPostSchema,
  updatePostSchema,
  createCategorySchema,
  updateCategorySchema,
  getPostsQuerySchema,
  bulkPostOperationSchema,
  contentSchedulingSchema,
  duplicatePostSchema,
  
  // Generic schemas
  mongoIdParamSchema,
};