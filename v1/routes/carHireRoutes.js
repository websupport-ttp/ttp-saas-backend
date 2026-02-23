// v1/routes/carHireRoutes.js
const express = require('express');
const multer = require('multer');
const {
  getAllCars,
  getCarById,
  createCar,
  updateCar,
  deleteCar,
  bookCar,
  verifyCarPayment,
  getMyBookings,
  getAllBookings,
  processBooking,
} = require('../controllers/carHireController');
const { authenticateUser, requireStaffClearance, authorizeRoles } = require('../middleware/authMiddleware');
const { StaffClearanceLevel } = require('../utils/constants');
const { uploadFile } = require('../services/fileService');
const ApiResponse = require('../utils/apiResponse');
const { StatusCodes } = require('http-status-codes');

const router = express.Router();

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    // Only allow images
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  },
});

// Image upload endpoint (Admin and Staff Tier 2+)
router.post('/upload-image', authenticateUser, authorizeRoles('Admin', 'Staff'), upload.single('image'), async (req, res, next) => {
  try {
    if (!req.file) {
      return ApiResponse.error(res, StatusCodes.BAD_REQUEST, 'No image file provided');
    }

    const os = require('os');
    const path = require('path');
    const fs = require('fs');
    
    // Use OS temp directory (works on both Windows and Unix)
    const tempDir = os.tmpdir();
    const tempPath = path.join(tempDir, `${Date.now()}-${req.file.originalname}`);
    
    // Write buffer to temp file
    fs.writeFileSync(tempPath, req.file.buffer);

    // Upload to S3 with public access for car images
    const result = await uploadFile(tempPath, 'car-hire', {
      resource_type: 'image',
      public: true,
    });

    // Clean up temp file
    fs.unlinkSync(tempPath);

    ApiResponse.success(res, StatusCodes.OK, 'Image uploaded successfully', {
      url: result.publicUrl || result.url,
      publicId: result.public_id,
    });
  } catch (error) {
    next(error);
  }
});

// Public routes
router.get('/', getAllCars);

// User routes (must be before /:id to avoid conflicts)
router.post('/book', bookCar); // Allow guest bookings
router.post('/verify-payment', verifyCarPayment); // Public - verify payment
router.get('/my-bookings', authenticateUser, getMyBookings);

// Admin and Staff routes (must be before /:id to avoid conflicts)
router.get('/bookings/all', authenticateUser, requireStaffClearance(StaffClearanceLevel.TIER_2), getAllBookings);
router.put('/bookings/:id/process', authenticateUser, requireStaffClearance(StaffClearanceLevel.TIER_2), processBooking);
router.post('/', authenticateUser, requireStaffClearance(StaffClearanceLevel.TIER_2), createCar);
router.put('/:id', authenticateUser, requireStaffClearance(StaffClearanceLevel.TIER_2), updateCar);
router.delete('/:id', authenticateUser, requireStaffClearance(StaffClearanceLevel.TIER_2), deleteCar);

// Get car by ID (must be last to avoid matching other routes)
router.get('/:id', getCarById);

module.exports = router;
