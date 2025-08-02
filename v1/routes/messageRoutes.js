// v1/routes/messageRoutes.js
const express = require('express');
const {
  sendEmailMessage,
  sendSmsMessage,
  sendWhatsappMessage,
} = require('../controllers/messageController');
const { authenticateUser, authorizeRoles } = require('../middleware/authMiddleware');
const { UserRoles } = require('../utils/constants');

const router = express.Router();

/**
 * @openapi
 * /messages/send-email:
 *   post:
 *     summary: Send an email message
 *     tags: [Messages]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - to
 *               - subject
 *               - html
 *             properties:
 *               to:
 *                 type: string
 *                 format: email
 *                 example: "recipient@example.com"
 *               subject:
 *                 type: string
 *                 example: "Your Travel Place Booking Confirmation"
 *               html:
 *                 type: string
 *                 example: "<h1>Thank you for your booking!</h1><p>Your flight is confirmed.</p>"
 *     responses:
 *       200:
 *         description: Email added to queue for sending
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/StandardSuccessResponse'
 *       400:
 *         description: Missing required fields
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
router.post('/send-email', authenticateUser, authorizeRoles(UserRoles.ADMIN, UserRoles.STAFF), sendEmailMessage);

/**
 * @openapi
 * /messages/send-sms:
 *   post:
 *     summary: Send an SMS message
 *     tags: [Messages]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - to
 *               - body
 *             properties:
 *               to:
 *                 type: string
 *                 example: "+2348012345678"
 *               body:
 *                 type: string
 *                 example: "Your TTP booking is confirmed. Ref: ABC123."
 *     responses:
 *       200:
 *         description: SMS added to queue for sending
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/StandardSuccessResponse'
 *       400:
 *         description: Missing required fields
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
router.post('/send-sms', authenticateUser, authorizeRoles(UserRoles.ADMIN, UserRoles.STAFF), sendSmsMessage);

/**
 * @openapi
 * /messages/send-whatsapp:
 *   post:
 *     summary: Send a WhatsApp message
 *     tags: [Messages]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - to
 *               - body
 *             properties:
 *               to:
 *                 type: string
 *                 example: "+2348012345678"
 *               body:
 *                 type: string
 *                 example: "Hello from TTP! Your visa application is processing."
 *     responses:
 *       200:
 *         description: WhatsApp message added to queue for sending
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/StandardSuccessResponse'
 *       400:
 *         description: Missing required fields
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
router.post('/send-whatsapp', authenticateUser, authorizeRoles(UserRoles.ADMIN, UserRoles.STAFF), sendWhatsappMessage);

module.exports = router;