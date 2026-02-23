// v1/utils/constants.js
/**
 * @enum {string} UserRoles
 * @description Defines the different roles for users in the system.
 */
const UserRoles = {
  CUSTOMER: 'Customer', // Regular users (renamed from USER for clarity)
  BUSINESS: 'Business', // Business customers
  STAFF: 'Staff', // All staff members (department-based)
  VENDOR: 'Vendor', // Car rental vendors
  AGENT: 'Agent', // Travel agents
  MANAGER: 'Manager', // Department managers (legacy, can be removed later)
  EXECUTIVE: 'Executive', // Executives (legacy, can be removed later)
  ADMIN: 'Admin', // System administrators
};

/**
 * @enum {string} Departments
 * @description Defines the departments in the organization.
 */
const Departments = {
  OPERATIONS: 'Operations',
  SALES: 'Sales',
  ACCOUNTING: 'Accounting',
  IT: 'IT',
};

/**
 * @enum {number} StaffTier
 * @description Defines the tier levels for staff members.
 * Tier 1: Staff (Entry level)
 * Tier 2: Officers (Mid level)
 * Tier 3: Department Heads/Supervisors (Management)
 */
const StaffTier = {
  TIER_1: 1, // Staff (Entry level)
  TIER_2: 2, // Officers (Mid level)
  TIER_3: 3, // Department Heads/Supervisors (Management)
};

/**
 * @enum {string} StaffDesignation
 * @description Defines specific designations for staff members.
 */
const StaffDesignation = {
  // Operations Department
  TICKETING_OFFICER: 'Ticketing Officer',
  VISA_OFFICER: 'Visa Officer',
  CUSTOMER_CARE_REP: 'Customer Care Representative',
  HEAD_OF_OPERATIONS: 'Head of Operations',
  
  // Sales Department
  SALES_OFFICER: 'Sales Officer',
  HEAD_OF_SALES: 'Head of Sales',
  
  // Accounting Department
  ACCOUNTING_STAFF: 'Accounting Staff',
  ACCOUNTANT: 'Accountant',
  HEAD_OF_ACCOUNTING: 'Head of Accounting',
  
  // IT Department
  IT_STAFF: 'IT Staff',
  SOCIAL_MEDIA_MANAGER: 'Social Media Manager',
  CONTENT_CREATOR: 'Content Creator',
  IT_MANAGER: 'IT Manager',
  
  // General
  GENERAL_STAFF: 'General Staff',
};

/**
 * @description Staff tier descriptions
 */
const StaffTierDescription = {
  1: 'Tier 1 - Staff (Entry Level)',
  2: 'Tier 2 - Officers (Mid Level)',
  3: 'Tier 3 - Department Heads/Supervisors',
};

/**
 * @description Department-Designation mapping
 */
const DepartmentDesignations = {
  [Departments.OPERATIONS]: [
    StaffDesignation.CUSTOMER_CARE_REP,
    StaffDesignation.TICKETING_OFFICER,
    StaffDesignation.VISA_OFFICER,
    StaffDesignation.HEAD_OF_OPERATIONS,
  ],
  [Departments.SALES]: [
    StaffDesignation.SALES_OFFICER,
    StaffDesignation.HEAD_OF_SALES,
  ],
  [Departments.ACCOUNTING]: [
    StaffDesignation.ACCOUNTING_STAFF,
    StaffDesignation.ACCOUNTANT,
    StaffDesignation.HEAD_OF_ACCOUNTING,
  ],
  [Departments.IT]: [
    StaffDesignation.IT_STAFF,
    StaffDesignation.CONTENT_CREATOR,
    StaffDesignation.SOCIAL_MEDIA_MANAGER,
    StaffDesignation.IT_MANAGER,
  ],
};

/**
 * @enum {string} RoleChangeStatus
 * @description Status for role change requests
 */
const RoleChangeStatus = {
  PENDING: 'Pending',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
};

/**
 * @enum {string} NotificationStatus
 * @description Status for notification queue items
 */
const NotificationStatus = {
  PENDING: 'Pending',
  ASSIGNED: 'Assigned',
  IN_PROGRESS: 'In Progress',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
};

/**
 * @enum {string} NotificationType
 * @description Types of notifications in the queue
 */
const NotificationType = {
  ABANDONED_BOOKING: 'Abandoned Booking',
  VISA_REQUEST: 'Visa Request',
  CUSTOMER_INQUIRY: 'Customer Inquiry',
  PAYMENT_ISSUE: 'Payment Issue',
  BOOKING_MODIFICATION: 'Booking Modification',
};

/**
 * @enum {string} NotificationPriority
 * @description Priority levels for notifications
 */
const NotificationPriority = {
  LOW: 'Low',
  MEDIUM: 'Medium',
  HIGH: 'High',
  URGENT: 'Urgent',
};

/**
 * @enum {string} AbandonedBookingStatus
 * @description Status for abandoned bookings
 */
const AbandonedBookingStatus = {
  ABANDONED: 'Abandoned',
  CONTACTED: 'Contacted',
  CONVERTED: 'Converted',
  LOST: 'Lost',
};

// Legacy - keeping for backward compatibility
const StaffClearanceLevel = StaffTier;
const StaffClearanceDescription = StaffTierDescription;

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
  Departments,
  StaffTier,
  StaffDesignation,
  StaffTierDescription,
  DepartmentDesignations,
  RoleChangeStatus,
  NotificationStatus,
  NotificationType,
  NotificationPriority,
  AbandonedBookingStatus,
  // Legacy exports for backward compatibility
  StaffClearanceLevel,
  StaffClearanceDescription,
  // Existing exports
  serviceChargeEnum,
  TransactionStatus,
  PaymentMethod,
  PostType,
  PostStatus,
  PackageDifficulty,
};