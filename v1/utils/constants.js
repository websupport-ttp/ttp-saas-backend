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
 * @enum {number} StaffClearanceLevel
 * @description Defines the clearance levels for staff members.
 * Tier 1: Drivers and Office Assistants (basic access)
 * Tier 2: Ticketing Officers (booking and customer management)
 * Tier 3: Supervisors (team oversight and reporting)
 * Tier 4: Management (full operational access)
 */
const StaffClearanceLevel = {
  TIER_1: 1, // Drivers and Office Assistants
  TIER_2: 2, // Ticketing Officers
  TIER_3: 3, // Supervisors
  TIER_4: 4, // Management
};

/**
 * @description Staff clearance level descriptions
 */
const StaffClearanceDescription = {
  1: 'Tier 1 - Drivers and Office Assistants',
  2: 'Tier 2 - Ticketing Officers',
  3: 'Tier 3 - Supervisors',
  4: 'Tier 4 - Management',
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
  StaffClearanceLevel,
  StaffClearanceDescription,
  serviceChargeEnum,
  TransactionStatus,
  PaymentMethod,
  PostType,
  PostStatus,
  PackageDifficulty,
};