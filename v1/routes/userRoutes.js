// v1/routes/userRoutes.js
const express = require('express');
const {
  getMe,
  updateMe,
  getAllUsers,
  getSingleUser,
  updateUser,
  updateUserRole,
  makeUserStaff,
  updateStaffClearance,
  getAllStaff,
  deleteUser,
} = require('../controllers/userController');
const { authenticateUser, authorizeRoles } = require('../middleware/authMiddleware');
const { UserRoles } = require('../utils/constants');
const { validate } = require('../middleware/validationMiddleware');
const { registerSchema } = require('../utils/validationSchemas'); // Reusing register schema for update validation

const router = express.Router();

/**
 * @openapi
 * /users/me:
 *   get:
 *     summary: Get current user profile
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User profile fetched successfully
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
 *                         user:
 *                           $ref: '#/components/schemas/User'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/StandardErrorResponse'
 *       404:
 *         description: User not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/StandardErrorResponse'
 *   put:
 *     summary: Update current user profile
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               firstName:
 *                 type: string
 *                 example: "UpdatedJohn"
 *               lastName:
 *                 type: string
 *                 example: "UpdatedDoe"
 *               otherNames:
 *                 type: string
 *                 example: "UpdatedPeter"
 *               email:
 *                 type: string
 *                 format: email
 *                 example: "updated.john@example.com"
 *               phoneNumber:
 *                 type: string
 *                 example: "+2349098765432"
 *     responses:
 *       200:
 *         description: User profile updated successfully
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
 *                         user:
 *                           $ref: '#/components/schemas/User'
 *       400:
 *         description: Bad request (validation error, email/phone already in use)
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
 *         description: User not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/StandardErrorResponse'
 */
router.route('/me').get(authenticateUser, getMe).put(authenticateUser, validate(registerSchema.partial()), updateMe);

/**
 * @openapi
 * /users:
 *   get:
 *     summary: Get all users (Admin only)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Users fetched successfully
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
 *                         count:
 *                           type: integer
 *                           example: 5
 *                         users:
 *                           type: array
 *                           items:
 *                             $ref: '#/components/schemas/User'
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
router.get('/', authenticateUser, authorizeRoles(UserRoles.ADMIN), getAllUsers);

/**
 * @openapi
 * /users/{id}:
 *   get:
 *     summary: Get a single user by ID (Admin only)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: The user ID.
 *     responses:
 *       200:
 *         description: User fetched successfully
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
 *                         user:
 *                           $ref: '#/components/schemas/User'
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
 *       404:
 *         description: User not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/StandardErrorResponse'
 *   delete:
 *     summary: Delete a user (Admin only)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: The user ID.
 *     responses:
 *       200:
 *         description: User deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/StandardSuccessResponse'
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
 *       404:
 *         description: User not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/StandardErrorResponse'
 */
router.route('/:id')
  .get(authenticateUser, authorizeRoles(UserRoles.ADMIN), getSingleUser)
  .put(authenticateUser, authorizeRoles(UserRoles.ADMIN), updateUser)
  .delete(authenticateUser, authorizeRoles(UserRoles.ADMIN), deleteUser);

/**
 * @openapi
 * /users/{id}/role:
 *   put:
 *     summary: Update user role (Admin only)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: The user ID.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - role
 *             properties:
 *               role:
 *                 type: string
 *                 enum: [User, Business, Staff, Manager, Executive, Admin]
 *                 example: "Manager"
 *     responses:
 *       200:
 *         description: User role updated successfully
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
 *                         user:
 *                           $ref: '#/components/schemas/User'
 *       400:
 *         description: Invalid role provided
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
 *       404:
 *         description: User not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/StandardErrorResponse'
 */
router.put('/:id/role', authenticateUser, authorizeRoles(UserRoles.ADMIN), updateUserRole);

/**
 * @openapi
 * /users/staff:
 *   get:
 *     summary: Get all staff members (Admin only)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: clearanceLevel
 *         schema:
 *           type: integer
 *           enum: [1, 2, 3, 4]
 *         description: Filter by clearance level
 *       - in: query
 *         name: department
 *         schema:
 *           type: string
 *         description: Filter by department
 *     responses:
 *       200:
 *         description: Staff members fetched successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.get('/staff', authenticateUser, authorizeRoles(UserRoles.ADMIN), getAllStaff);

/**
 * @openapi
 * /users/{id}/make-staff:
 *   put:
 *     summary: Make a user a staff member with clearance level (Admin only)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: The user ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - clearanceLevel
 *             properties:
 *               clearanceLevel:
 *                 type: integer
 *                 enum: [1, 2, 3, 4]
 *                 description: Staff clearance level (1=Drivers/Assistants, 2=Ticketing Officers, 3=Supervisors, 4=Management)
 *                 example: 2
 *               department:
 *                 type: string
 *                 example: "Ticketing"
 *               employeeId:
 *                 type: string
 *                 example: "EMP001"
 *     responses:
 *       200:
 *         description: User successfully made staff member
 *       400:
 *         description: Invalid clearance level
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: User not found
 *       409:
 *         description: Employee ID already in use
 */
router.put('/:id/make-staff', authenticateUser, authorizeRoles(UserRoles.ADMIN), makeUserStaff);

/**
 * @openapi
 * /users/{id}/clearance:
 *   put:
 *     summary: Update staff clearance level (Admin only)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: The user ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               clearanceLevel:
 *                 type: integer
 *                 enum: [1, 2, 3, 4]
 *                 description: Staff clearance level
 *                 example: 3
 *               department:
 *                 type: string
 *                 example: "Operations"
 *               employeeId:
 *                 type: string
 *                 example: "EMP002"
 *     responses:
 *       200:
 *         description: Staff clearance updated successfully
 *       400:
 *         description: Invalid clearance level or user is not staff
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: User not found
 *       409:
 *         description: Employee ID already in use
 */
router.put('/:id/clearance', authenticateUser, authorizeRoles(UserRoles.ADMIN), updateStaffClearance);

module.exports = router;