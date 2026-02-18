// v1/models/visaApplicationModel.js
const mongoose = require('mongoose');

/**
 * @description Mongoose schema for the Visa Application model.
 * Stores information and document references for visa processing with payment integration.
 */
const VisaApplicationSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: function () { return !this.guestEmail; }
  },
  guestEmail: {
    type: String,
    lowercase: true,
    trim: true,
    match: [
      /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
      'Please add a valid email address',
    ],
    required: function () { return !this.userId; },
    validate: {
      validator: function (email) {
        return !this.userId || !email; // Either userId or guestEmail, not both
      },
      message: 'Cannot have both userId and guestEmail'
    }
  },
  guestPhoneNumber: {
    type: String,
    trim: true,
    match: [
      /^\+?[1-9]\d{1,14}$/, // E.164 format
      'Please add a valid phone number',
    ],
    required: function () { return !this.userId; }
  },
  applicationReference: {
    type: String,
    unique: true,
    required: false // Generated automatically in pre-save middleware
  },
  destinationCountry: {
    type: String,
    required: [true, 'Destination country is required'],
    trim: true,
  },
  visaType: {
    type: String,
    enum: ['Tourist', 'Business', 'Student', 'Transit', 'Work'],
    required: [true, 'Visa type is required']
  },
  travelPurpose: {
    type: String,
    required: [true, 'Purpose of travel is required'],
    trim: true,
  },
  urgency: {
    type: String,
    enum: ['Standard', 'Express', 'Super Express'],
    default: 'Standard'
  },
  travelDates: {
    startDate: Date,
    endDate: Date,
  },
  passportDetails: {
    passportNumber: { type: String, trim: true },
    issueDate: Date,
    expiryDate: Date,
    placeOfIssue: String,
  },
  personalInformation: {
    firstName: String,
    lastName: String,
    otherNames: String,
    dateOfBirth: Date,
    gender: String,
    nationality: String,
    maritalStatus: String,
    occupation: String,
    address: String,
  },
  documents: [
    {
      documentType: {
        type: String,
        required: [true, 'Document type is required'],
        enum: ['International Passport', 'Passport Photograph', 'Bank Statement', 'Flight Itinerary', 'Hotel Booking', 'Invitation Letter', 'Other'],
      },
      filename: String,
      originalName: String,
      cloudinaryUrl: {
        type: String,
        required: [true, 'Cloudinary URL is required'],
      },
      mimetype: String,
      size: Number, // in bytes
      uploadedAt: {
        type: Date,
        default: Date.now,
      },
      verification: {
        status: {
          type: String,
          enum: ['verified', 'rejected', 'requires_review'],
          default: 'requires_review'
        },
        confidence: {
          type: Number,
          min: 0,
          max: 100,
          default: 0
        },
        issues: [String],
        suggestions: [String],
        extractedData: Object,
        verifiedAt: Date
      }
    },
  ],
  status: {
    type: String,
    enum: ['Pending', 'Under Review', 'Additional Documents Required', 'Approved', 'Rejected'],
    default: 'Pending',
  },
  statusHistory: [{
    status: String,
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    updatedAt: { type: Date, default: Date.now },
    notes: String
  }],
  estimatedProcessingTime: String,
  actualProcessingTime: Number, // in days
  fees: {
    visaFee: { type: Number, default: 0 },
    serviceFee: { type: Number, default: 0 },
    urgencyFee: { type: Number, default: 0 },
    total: { type: Number, default: 0 }
  },
  paymentStatus: {
    type: String,
    enum: ['Pending', 'Paid', 'Failed', 'Refunded'],
    default: 'Pending'
  },
  paymentReference: String,
  applicationNotes: [
    {
      note: String,
      timestamp: { type: Date, default: Date.now },
      addedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User', // Could be a Staff/Admin user
      },
    },
  ],
  // External API integration fields
  externalReference: {
    type: String,
    trim: true,
    required: false,
  },
  externalStatus: {
    type: String,
    trim: true,
    required: false,
  },
  trackingUrl: {
    type: String,
    trim: true,
    required: false,
  },
  lastExternalStatusCheck: {
    type: Date,
    required: false,
  },
  externalRequirements: {
    type: Object,
    required: false,
  },
  documentTypes: [{
    type: String,
    trim: true,
  }],
  appointmentDetails: {
    appointmentId: String,
    scheduledDate: Date,
    scheduledTime: String,
    location: String,
    address: String,
    confirmationCode: String,
    instructions: [String],
  },
  // Referral tracking
  referralCode: {
    type: String,
    trim: true,
    uppercase: true,
    required: false,
  },
}, {
  timestamps: true,
});

// Pre-save middleware to generate application reference
VisaApplicationSchema.pre('save', function (next) {
  if (this.isNew && !this.applicationReference) {
    this.applicationReference = `VISA-${Date.now()}-${Math.random().toString(36).substring(2, 11).toUpperCase()}`;
  }
  next();
});

// Pre-save middleware to calculate total fees
VisaApplicationSchema.pre('save', function (next) {
  if (this.fees) {
    this.fees.total = (this.fees.visaFee || 0) + (this.fees.serviceFee || 0) + (this.fees.urgencyFee || 0);
  }
  next();
});

module.exports = mongoose.model('VisaApplication', VisaApplicationSchema);