// v1/routes/vendorAgentApplicationRoutes.js
const express = require('express');
const {
  submitApplication,
  uploadDocuments,
  getMyApplications,
  getApplication,
  getAllApplications,
  approveApplication,
  rejectApplication,
} = require('../controllers/vendorAgentApplicationController');
const { authenticateUser, requireStaffClearance } = require('../middleware/authMiddleware');
const { StaffClearanceLevel } = require('../utils/constants');
const { validate } = require('../middleware/validationMiddleware');
const { z } = require('zod');

const router = express.Router();

// Validation schemas
const applicationSchema = z.object({
  applicationType: z.enum(['Vendor', 'Agent']),
  businessName: z.string().min(2, 'Business name is required'),
  businessEmail: z.string().email('Valid business email is required'),
  businessPhone: z.string().min(7, 'Valid business phone is required'),
  businessAddress: z.object({
    street: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    country: z.string().optional(),
    zipCode: z.string().optional(),
  }).optional(),
  businessRegistrationNumber: z.string().min(1, 'Business registration number is required'),
  bankDetails: z.object({
    bankName: z.string().optional(),
    accountNumber: z.string().optional(),
    accountName: z.string().optional(),
    accountType: z.enum(['Savings', 'Checking', 'Business']).optional(),
    swiftCode: z.string().optional(),
  }).optional(),
});

const approvalSchema = z.object({
  commissionRate: z.number().min(0).max(100).optional(),
  approvalNotes: z.string().optional(),
});

const rejectionSchema = z.object({
  rejectionReason: z.string().min(5, 'Rejection reason must be at least 5 characters'),
});

/**
 * @openapi
 * /vendor-agent-applications:
 *   post:
 *     summary: Submit vendor or agent application
 *     tags: [Vendor/Agent Applications]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - applicationType
 *               - businessName
 *               - businessEmail
 *               - businessPhone
 *               - businessRegistrationNumber
 *             properties:
 *               applicationType:
 *                 type: string
 *                 enum: [Vendor, Agent]
 *               businessName:
 *                 type: string
 *               businessEmail:
 *                 type: string
 *               businessPhone:
 *                 type: string
 *               businessAddress:
 *                 type: object
 *               businessRegistrationNumber:
 *                 type: string
 *               bankDetails:
 *                 type: object
 *     responses:
 *       201:
 *         description: Application submitted successfully
 *       409:
 *         description: Pending application already exists
 */
router.post(
  '/',
  authenticateUser,
  validate(applicationSchema),
  submitApplication
);

/**
 * @openapi
 * /vendor-agent-applications/my-applications:
 *   get:
 *     summary: Get user's applications
 *     tags: [Vendor/Agent Applications]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Applications retrieved successfully
 */
router.get('/my-applications', authenticateUser, getMyApplications);

/**
 * @openapi
 * /vendor-agent-applications:
 *   get:
 *     summary: Get all applications (Staff/Admin only)
 *     tags: [Vendor/Agent Applications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [Pending, Under Review, Approved, Rejected]
 *       - in: query
 *         name: applicationType
 *         schema:
 *           type: string
 *           enum: [Vendor, Agent]
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *     responses:
 *       200:
 *         description: Applications retrieved successfully
 *       403:
 *         description: Insufficient permissions
 */
router.get(
  '/',
  authenticateUser,
  requireStaffClearance(2), // Tier 2 and above
  getAllApplications
);

/**
 * @openapi
 * /vendor-agent-applications/{id}:
 *   get:
 *     summary: Get single application
 *     tags: [Vendor/Agent Applications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Application retrieved successfully
 *       404:
 *         description: Application not found
 */
router.get('/:id', authenticateUser, getApplication);

/**
 * @openapi
 * /vendor-agent-applications/{id}/upload-documents:
 *   post:
 *     summary: Upload application documents
 *     tags: [Vendor/Agent Applications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               registrationDocument:
 *                 type: object
 *               identificationDocument:
 *                 type: object
 *               proofOfAddress:
 *                 type: object
 *     responses:
 *       200:
 *         description: Documents uploaded successfully
 */
router.post('/:id/upload-documents', authenticateUser, uploadDocuments);

/**
 * @openapi
 * /vendor-agent-applications/{id}/approve:
 *   put:
 *     summary: Approve application (Staff/Admin only)
 *     tags: [Vendor/Agent Applications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               commissionRate:
 *                 type: number
 *               approvalNotes:
 *                 type: string
 *     responses:
 *       200:
 *         description: Application approved successfully
 */
router.put(
  '/:id/approve',
  authenticateUser,
  requireStaffClearance(2), // Tier 2 and above
  validate(approvalSchema),
  approveApplication
);

/**
 * @openapi
 * /vendor-agent-applications/{id}/reject:
 *   put:
 *     summary: Reject application (Staff/Admin only)
 *     tags: [Vendor/Agent Applications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - rejectionReason
 *             properties:
 *               rejectionReason:
 *                 type: string
 *     responses:
 *       200:
 *         description: Application rejected successfully
 */
router.put(
  '/:id/reject',
  authenticateUser,
  requireStaffClearance(2), // Tier 2 and above
  validate(rejectionSchema),
  rejectApplication
);

module.exports = router;
