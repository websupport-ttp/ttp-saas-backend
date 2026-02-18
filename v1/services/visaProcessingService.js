// v1/services/visaProcessingService.js
const axios = require('axios');
const logger = require('../utils/logger');
const { ApiError } = require('../utils/apiError');
const { StatusCodes } = require('http-status-codes');

// VFS Global API Configuration
const VFS_BASE_URL = process.env.VFS_BASE_URL || 'https://api.vfsglobal.com/v1';
const VFS_API_KEY = process.env.VFS_API_KEY;
const VFS_CLIENT_ID = process.env.VFS_CLIENT_ID;
const VFS_CLIENT_SECRET = process.env.VFS_CLIENT_SECRET;

// Alternative visa processing APIs
const VISA_PROCESSING_PROVIDER = process.env.VISA_PROCESSING_PROVIDER || 'VFS_GLOBAL';
const EMBASSY_API_BASE_URL = process.env.EMBASSY_API_BASE_URL;
const EMBASSY_API_KEY = process.env.EMBASSY_API_KEY;

let vfsAuthToken = null;
let tokenExpiryTime = null;

/**
 * @function authenticateVFS
 * @description Authenticates with the VFS Global API to get an access token.
 * @returns {string} The VFS API authentication token.
 * @throws {ApiError} If authentication fails.
 */
const authenticateVFS = async () => {
  if (vfsAuthToken && tokenExpiryTime && Date.now() < tokenExpiryTime) {
    logger.info('Using cached VFS token.');
    return vfsAuthToken;
  }

  logger.info('Authenticating with VFS Global API...');
  try {
    const response = await axios.post(`${VFS_BASE_URL}/auth/token`, {
      client_id: VFS_CLIENT_ID,
      client_secret: VFS_CLIENT_SECRET,
      grant_type: 'client_credentials'
    }, {
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': VFS_API_KEY
      }
    });

    if (response.data && response.data.access_token) {
      vfsAuthToken = response.data.access_token;
      // Token expires in seconds, convert to milliseconds
      tokenExpiryTime = Date.now() + (response.data.expires_in * 1000);
      
      logger.info('VFS Global API authenticated successfully. Token acquired.');
      return vfsAuthToken;
    } else {
      throw new ApiError('VFS authentication failed: Invalid response structure', StatusCodes.UNAUTHORIZED);
    }
  } catch (error) {
    logger.error('VFS authentication error:', error.message);
    if (error.response) {
      logger.error('VFS API response error:', error.response.data);
    }
    throw new ApiError('Failed to authenticate with VFS Global API', StatusCodes.INTERNAL_SERVER_ERROR);
  }
};

/**
 * @function vfsApiCall
 * @description Generic function to make authenticated calls to the VFS Global API.
 * @param {string} endpoint - The API endpoint.
 * @param {object} data - The request payload.
 * @param {string} method - HTTP method (GET, POST, PUT, DELETE).
 * @returns {object} The API response data.
 * @throws {ApiError} If the API call fails.
 */
const vfsApiCall = async (endpoint, data = null, method = 'POST') => {
  const token = await authenticateVFS();
  
  try {
    const config = {
      method,
      url: `${VFS_BASE_URL}${endpoint}`,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'X-API-Key': VFS_API_KEY
      }
    };

    if (data && (method === 'POST' || method === 'PUT')) {
      config.data = data;
    } else if (data && method === 'GET') {
      config.params = data;
    }

    const response = await axios(config);
    return response.data;
  } catch (error) {
    logger.error(`VFS API call to ${endpoint} failed:`, error.message);
    if (error.response) {
      logger.error('VFS API response error:', error.response.data);
      throw new ApiError(
        error.response.data.message || 'VFS API request failed',
        error.response.status || StatusCodes.INTERNAL_SERVER_ERROR
      );
    }
    throw new ApiError('VFS API request failed', StatusCodes.INTERNAL_SERVER_ERROR);
  }
};

/**
 * @function getVisaRequirements
 * @description Gets visa requirements for a specific country and visa type.
 * @param {string} destinationCountry - The destination country code.
 * @param {string} visaType - The type of visa.
 * @param {string} nationality - The applicant's nationality.
 * @returns {object} Visa requirements and fees.
 */
const getVisaRequirements = async (destinationCountry, visaType, nationality) => {
  try {
    const response = await vfsApiCall('/visa/requirements', {
      destination_country: destinationCountry,
      visa_type: visaType,
      nationality: nationality
    }, 'GET');

    return {
      success: true,
      data: {
        requirements: response.requirements || [],
        fees: response.fees || {},
        processingTime: response.processing_time || {},
        documentTypes: response.document_types || [],
        additionalInfo: response.additional_info || {}
      }
    };
  } catch (error) {
    logger.error('Failed to get visa requirements:', error.message);
    throw new ApiError('Failed to retrieve visa requirements', StatusCodes.INTERNAL_SERVER_ERROR);
  }
};

/**
 * @function calculateVisaFees
 * @description Calculates visa fees based on real-time embassy requirements.
 * @param {string} destinationCountry - The destination country code.
 * @param {string} visaType - The type of visa.
 * @param {string} urgency - Processing urgency (Standard, Express, Super Express).
 * @param {string} nationality - The applicant's nationality.
 * @returns {object} Calculated fees breakdown.
 */
const calculateVisaFees = async (destinationCountry, visaType, urgency, nationality) => {
  try {
    const response = await vfsApiCall('/visa/fees/calculate', {
      destination_country: destinationCountry,
      visa_type: visaType,
      urgency: urgency.toLowerCase(),
      nationality: nationality
    });

    return {
      success: true,
      data: {
        visaFee: response.visa_fee || 0,
        serviceFee: response.service_fee || 0,
        urgencyFee: response.urgency_fee || 0,
        biometricFee: response.biometric_fee || 0,
        courierFee: response.courier_fee || 0,
        total: response.total_fee || 0,
        currency: response.currency || 'USD',
        exchangeRate: response.exchange_rate || 1,
        localTotal: response.local_total || 0,
        localCurrency: response.local_currency || 'NGN'
      }
    };
  } catch (error) {
    logger.error('Failed to calculate visa fees:', error.message);
    // Fallback to default fee calculation if external API fails
    return calculateFallbackFees(destinationCountry, visaType, urgency);
  }
};

/**
 * @function calculateFallbackFees
 * @description Fallback fee calculation when external API is unavailable.
 * @param {string} destinationCountry - The destination country code.
 * @param {string} visaType - The type of visa.
 * @param {string} urgency - Processing urgency.
 * @returns {object} Fallback fees breakdown.
 */
const calculateFallbackFees = (destinationCountry, visaType, urgency) => {
  // Default fee structure (in NGN)
  const baseFees = {
    'US': { Tourist: 50000, Business: 60000, Student: 45000, Transit: 30000, Work: 80000 },
    'UK': { Tourist: 35000, Business: 45000, Student: 40000, Transit: 25000, Work: 70000 },
    'CA': { Tourist: 30000, Business: 40000, Student: 35000, Transit: 20000, Work: 65000 },
    'AU': { Tourist: 40000, Business: 50000, Student: 45000, Transit: 25000, Work: 75000 },
    'DE': { Tourist: 25000, Business: 35000, Student: 30000, Transit: 15000, Work: 55000 }
  };

  const urgencyMultipliers = {
    'Standard': 1.0,
    'Express': 1.5,
    'Super Express': 2.0
  };

  const countryCode = destinationCountry.toUpperCase();
  const baseVisaFee = baseFees[countryCode]?.[visaType] || 40000;
  const urgencyMultiplier = urgencyMultipliers[urgency] || 1.0;
  
  const visaFee = Math.round(baseVisaFee * urgencyMultiplier);
  const serviceFee = 15000; // Fixed service fee
  const urgencyFee = urgency !== 'Standard' ? Math.round(baseVisaFee * (urgencyMultiplier - 1)) : 0;
  
  return {
    success: true,
    data: {
      visaFee,
      serviceFee,
      urgencyFee,
      biometricFee: 5000,
      courierFee: 3000,
      total: visaFee + serviceFee + urgencyFee + 5000 + 3000,
      currency: 'NGN',
      exchangeRate: 1,
      localTotal: visaFee + serviceFee + urgencyFee + 5000 + 3000,
      localCurrency: 'NGN',
      fallback: true
    }
  };
};

/**
 * @function submitVisaApplication
 * @description Submits a visa application to the external processing API.
 * @param {object} applicationData - The visa application data.
 * @returns {object} Submission response with tracking reference.
 */
const submitVisaApplication = async (applicationData) => {
  try {
    const submissionPayload = {
      application_reference: applicationData.applicationReference,
      destination_country: applicationData.destinationCountry,
      visa_type: applicationData.visaType,
      urgency: applicationData.urgency,
      applicant: {
        first_name: applicationData.personalInformation.firstName,
        last_name: applicationData.personalInformation.lastName,
        other_names: applicationData.personalInformation.otherNames,
        date_of_birth: applicationData.personalInformation.dateOfBirth,
        gender: applicationData.personalInformation.gender,
        nationality: applicationData.personalInformation.nationality,
        marital_status: applicationData.personalInformation.maritalStatus,
        occupation: applicationData.personalInformation.occupation,
        address: applicationData.personalInformation.address
      },
      passport: {
        number: applicationData.passportDetails.passportNumber,
        issue_date: applicationData.passportDetails.issueDate,
        expiry_date: applicationData.passportDetails.expiryDate,
        place_of_issue: applicationData.passportDetails.placeOfIssue
      },
      travel: {
        purpose: applicationData.travelPurpose,
        start_date: applicationData.travelDates.startDate,
        end_date: applicationData.travelDates.endDate
      },
      contact: {
        email: applicationData.guestEmail || applicationData.userId,
        phone: applicationData.guestPhoneNumber
      },
      documents: applicationData.documents.map(doc => ({
        type: doc.documentType,
        filename: doc.filename,
        url: doc.cloudinaryUrl,
        uploaded_at: doc.uploadedAt
      }))
    };

    const response = await vfsApiCall('/visa/applications', submissionPayload);

    return {
      success: true,
      data: {
        externalReference: response.application_id || response.reference_number,
        status: response.status || 'Submitted',
        estimatedProcessingTime: response.estimated_processing_time,
        nextSteps: response.next_steps || [],
        trackingUrl: response.tracking_url,
        biometricAppointment: response.biometric_appointment || null
      }
    };
  } catch (error) {
    logger.error('Failed to submit visa application:', error.message);
    throw new ApiError('Failed to submit visa application to external processor', StatusCodes.INTERNAL_SERVER_ERROR);
  }
};

/**
 * @function checkVisaStatus
 * @description Checks the real-time status of a visa application.
 * @param {string} externalReference - The external processing reference.
 * @param {string} applicationReference - The internal application reference.
 * @returns {object} Current application status and updates.
 */
const checkVisaStatus = async (externalReference, applicationReference) => {
  try {
    const response = await vfsApiCall(`/visa/applications/${externalReference}/status`, null, 'GET');

    return {
      success: true,
      data: {
        status: response.status,
        statusDescription: response.status_description,
        lastUpdated: response.last_updated,
        currentStage: response.current_stage,
        nextSteps: response.next_steps || [],
        estimatedCompletion: response.estimated_completion,
        documents: {
          required: response.documents_required || [],
          received: response.documents_received || [],
          pending: response.documents_pending || []
        },
        biometric: {
          required: response.biometric_required || false,
          completed: response.biometric_completed || false,
          appointment: response.biometric_appointment || null
        },
        decision: {
          made: response.decision_made || false,
          result: response.decision_result || null,
          reason: response.decision_reason || null,
          validFrom: response.visa_valid_from || null,
          validUntil: response.visa_valid_until || null
        }
      }
    };
  } catch (error) {
    logger.error('Failed to check visa status:', error.message);
    throw new ApiError('Failed to retrieve visa application status', StatusCodes.INTERNAL_SERVER_ERROR);
  }
};

/**
 * @function verifyDocuments
 * @description Performs automated document verification.
 * @param {Array} documents - Array of document objects to verify.
 * @param {string} visaType - The type of visa being applied for.
 * @param {string} destinationCountry - The destination country.
 * @returns {object} Document verification results.
 */
const verifyDocuments = async (documents, visaType, destinationCountry) => {
  try {
    const verificationPayload = {
      visa_type: visaType,
      destination_country: destinationCountry,
      documents: documents.map(doc => ({
        type: doc.documentType,
        url: doc.cloudinaryUrl,
        filename: doc.filename,
        mimetype: doc.mimetype,
        size: doc.size
      }))
    };

    const response = await vfsApiCall('/visa/documents/verify', verificationPayload);

    return {
      success: true,
      data: {
        overallStatus: response.overall_status, // 'passed', 'failed', 'warning'
        verificationScore: response.verification_score || 0,
        documents: response.document_results.map(result => ({
          documentType: result.document_type,
          status: result.status, // 'verified', 'rejected', 'requires_review'
          confidence: result.confidence || 0,
          issues: result.issues || [],
          suggestions: result.suggestions || [],
          extractedData: result.extracted_data || {}
        })),
        missingDocuments: response.missing_documents || [],
        recommendations: response.recommendations || []
      }
    };
  } catch (error) {
    logger.error('Failed to verify documents:', error.message);
    // Return a fallback verification result
    return {
      success: true,
      data: {
        overallStatus: 'requires_review',
        verificationScore: 75,
        documents: documents.map(doc => ({
          documentType: doc.documentType,
          status: 'requires_review',
          confidence: 75,
          issues: [],
          suggestions: ['Document uploaded successfully, manual review required'],
          extractedData: {}
        })),
        missingDocuments: [],
        recommendations: ['All documents received, proceeding with manual verification'],
        fallback: true
      }
    };
  }
};

/**
 * @function scheduleAppointment
 * @description Schedules a biometric appointment or embassy visit.
 * @param {string} externalReference - The external processing reference.
 * @param {object} appointmentData - Appointment preferences and details.
 * @returns {object} Appointment scheduling result.
 */
const scheduleAppointment = async (externalReference, appointmentData) => {
  try {
    const response = await vfsApiCall(`/visa/applications/${externalReference}/appointment`, {
      preferred_date: appointmentData.preferredDate,
      preferred_time: appointmentData.preferredTime,
      location: appointmentData.location,
      appointment_type: appointmentData.type || 'biometric',
      contact_phone: appointmentData.contactPhone,
      special_requirements: appointmentData.specialRequirements || []
    });

    return {
      success: true,
      data: {
        appointmentId: response.appointment_id,
        scheduledDate: response.scheduled_date,
        scheduledTime: response.scheduled_time,
        location: response.location,
        address: response.address,
        instructions: response.instructions || [],
        confirmationCode: response.confirmation_code,
        rescheduleAllowed: response.reschedule_allowed || false,
        cancellationDeadline: response.cancellation_deadline
      }
    };
  } catch (error) {
    logger.error('Failed to schedule appointment:', error.message);
    throw new ApiError('Failed to schedule visa appointment', StatusCodes.INTERNAL_SERVER_ERROR);
  }
};

/**
 * @function getProcessingCenters
 * @description Gets available visa processing centers for a country.
 * @param {string} destinationCountry - The destination country code.
 * @param {string} applicantLocation - The applicant's location/city.
 * @returns {object} Available processing centers.
 */
const getProcessingCenters = async (destinationCountry, applicantLocation) => {
  try {
    const response = await vfsApiCall('/visa/processing-centers', {
      destination_country: destinationCountry,
      applicant_location: applicantLocation
    }, 'GET');

    return {
      success: true,
      data: {
        centers: response.centers.map(center => ({
          id: center.id,
          name: center.name,
          address: center.address,
          city: center.city,
          phone: center.phone,
          email: center.email,
          workingHours: center.working_hours,
          services: center.services || [],
          appointmentRequired: center.appointment_required || false,
          distance: center.distance || null
        }))
      }
    };
  } catch (error) {
    logger.error('Failed to get processing centers:', error.message);
    throw new ApiError('Failed to retrieve processing centers', StatusCodes.INTERNAL_SERVER_ERROR);
  }
};

module.exports = {
  getVisaRequirements,
  calculateVisaFees,
  submitVisaApplication,
  checkVisaStatus,
  verifyDocuments,
  scheduleAppointment,
  getProcessingCenters,
  authenticateVFS,
  vfsApiCall
};