// v1/utils/constants.js
/**
 * @enum {string} UserRoles
 * @description Defines the different roles for users in the system.
 */
const UserRoles = {
  USER: 'User',
  BUSINESS: 'Business',
  STAFF: 'Staff',
  MANAGER: 'Manager',
  EXECUTIVE: 'Executive',
  ADMIN: 'Admin',
};

/**
 * @enum {number} ServiceChargeEnum
 * @description Defines the service charges for different booking types.
 * These values will be stored in Redis and can be updated by admins.
 */
const serviceChargeEnum = {
  flightBookingCharges: 5000,
  hotelReservationCharges: 3000,
  travelInsuranceCharges: 1000,
  visaProcessingCharges: 7500,
  packageCharges: 2000,
};

/**
 * @enum {string} TransactionStatus
 * @description Defines the possible statuses for a transaction.
 */
const TransactionStatus = {
  PENDING: 'Pending',
  COMPLETED: 'Completed',
  FAILED: 'Failed',
  REFUNDED: 'Refunded',
};

/**
 * @enum {string} PaymentMethod
 * @description Defines the supported payment methods.
 */
const PaymentMethod = {
  PAYSTACK: 'Paystack',
  BANK_TRANSFER: 'Bank Transfer',
  GOOGLE_PAY: 'Google Pay',
};

/**
 * @enum {string} PostType
 * @description Defines the types of posts in the content management system.
 */
const PostType = {
  ARTICLES: 'Articles',
  PACKAGES: 'Packages',
};

/**
 * @enum {string} PostStatus
 * @description Defines the possible statuses for posts.
 */
const PostStatus = {
  DRAFT: 'Draft',
  PUBLISHED: 'Published',
  ARCHIVED: 'Archived',
};

/**
 * @enum {string} PackageDifficulty
 * @description Defines the difficulty levels for travel packages.
 */
const PackageDifficulty = {
  EASY: 'Easy',
  MODERATE: 'Moderate',
  CHALLENGING: 'Challenging',
  EXPERT: 'Expert',
};

module.exports = {
  UserRoles,
  serviceChargeEnum,
  TransactionStatus,
  PaymentMethod,
  PostType,
  PostStatus,
  PackageDifficulty,
};