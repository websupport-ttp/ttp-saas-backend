const Discount = require('../models/discountModel');
const asyncHandler = require('../middleware/asyncHandler');
const ApiResponse = require('../utils/apiResponse');
const ApiError = require('../utils/apiError');
const { StatusCodes } = require('http-status-codes');

/**
 * @desc    Get all discounts
 * @route   GET /api/v1/discounts
 * @access  Private/Admin
 */
exports.getAllDiscounts = asyncHandler(async (req, res) => {
  try {
    const { isActive, type, appliesTo } = req.query;
    
    const filter = {};
    if (isActive !== undefined) filter.isActive = isActive === 'true';
    if (type) filter.type = type;
    if (appliesTo) filter.appliesTo = appliesTo;
    
    console.log('getAllDiscounts - Filter:', filter);
    console.log('getAllDiscounts - Query params:', { isActive, type, appliesTo });
    
    const discounts = await Discount.find(filter)
      .sort({ priority: -1, createdAt: -1 })
      .populate('createdBy', 'firstName lastName email')
      .populate('updatedBy', 'firstName lastName email')
      .lean();
    
    console.log('getAllDiscounts - Found discounts:', discounts.length);
    
    return ApiResponse.success(res, StatusCodes.OK, 'Discounts retrieved successfully', {
      count: discounts.length,
      discounts
    });
  } catch (error) {
    console.error('Error fetching discounts:', error);
    // Return empty array if there's an error (e.g., collection doesn't exist)
    return ApiResponse.success(res, StatusCodes.OK, 'Discounts retrieved successfully', {
      count: 0,
      discounts: []
    });
  }
});

/**
 * @desc    Get single discount
 * @route   GET /api/v1/discounts/:id
 * @access  Private/Admin
 */
exports.getDiscount = asyncHandler(async (req, res) => {
  try {
    const discount = await Discount.findById(req.params.id)
      .populate('createdBy', 'firstName lastName email')
      .populate('updatedBy', 'firstName lastName email')
      .lean();
    
    if (!discount) {
      throw new ApiError(404, 'Discount not found');
    }
    
    return ApiResponse.success(res, StatusCodes.OK, 'Discount retrieved successfully', { discount });
  } catch (error) {
    if (error instanceof ApiError) throw error;
    console.error('Error fetching discount:', error);
    throw new ApiError(404, 'Discount not found');
  }
});

/**
 * @desc    Create discount
 * @route   POST /api/v1/discounts
 * @access  Private/Admin
 */
exports.createDiscount = asyncHandler(async (req, res) => {
  const {
    name,
    description,
    code,
    type,
    value,
    roleDiscounts,
    provider,
    appliesTo,
    minPurchaseAmount,
    maxDiscountAmount,
    usageLimit,
    validFrom,
    validUntil,
    isActive,
    isStackable,
    priority
  } = req.body;
  
  // Check if code already exists
  if (code) {
    const existingDiscount = await Discount.findOne({ code: code.toUpperCase() });
    if (existingDiscount) {
      throw new ApiError(400, 'Discount code already exists');
    }
  }
  
  const discount = await Discount.create({
    name,
    description,
    code: code ? code.toUpperCase() : undefined,
    type,
    value,
    roleDiscounts,
    provider,
    appliesTo,
    minPurchaseAmount,
    maxDiscountAmount,
    usageLimit,
    validFrom,
    validUntil,
    isActive,
    isStackable,
    priority,
    createdBy: req.user._id
  });
  
  return ApiResponse.success(res, StatusCodes.CREATED, 'Discount created successfully', { discount });
});

/**
 * @desc    Update discount
 * @route   PUT /api/v1/discounts/:id
 * @access  Private/Admin
 */
exports.updateDiscount = asyncHandler(async (req, res) => {
  const {
    name,
    description,
    code,
    type,
    value,
    roleDiscounts,
    provider,
    appliesTo,
    minPurchaseAmount,
    maxDiscountAmount,
    usageLimit,
    validFrom,
    validUntil,
    isActive,
    isStackable,
    priority
  } = req.body;
  
  const discount = await Discount.findById(req.params.id);
  
  if (!discount) {
    throw new ApiError(404, 'Discount not found');
  }
  
  // Check if code is being changed and if new code already exists
  if (code && code.toUpperCase() !== discount.code) {
    const existingDiscount = await Discount.findOne({ code: code.toUpperCase() });
    if (existingDiscount) {
      throw new ApiError(400, 'Discount code already exists');
    }
  }
  
  if (name) discount.name = name;
  if (description !== undefined) discount.description = description;
  if (code !== undefined) discount.code = code ? code.toUpperCase() : undefined;
  if (type) discount.type = type;
  if (value !== undefined) discount.value = value;
  if (roleDiscounts) discount.roleDiscounts = roleDiscounts;
  if (provider) discount.provider = provider;
  if (appliesTo) discount.appliesTo = appliesTo;
  if (minPurchaseAmount !== undefined) discount.minPurchaseAmount = minPurchaseAmount;
  // Explicitly allow clearing maxDiscountAmount and usageLimit by setting to undefined
  discount.maxDiscountAmount = maxDiscountAmount || undefined;
  discount.usageLimit = usageLimit || undefined;
  if (validFrom) discount.validFrom = validFrom;
  if (validUntil) discount.validUntil = validUntil;
  if (isActive !== undefined) discount.isActive = isActive;
  if (isStackable !== undefined) discount.isStackable = isStackable;
  if (priority !== undefined) discount.priority = priority;
  discount.updatedBy = req.user._id;
  
  await discount.save();
  
  return ApiResponse.success(res, StatusCodes.OK, 'Discount updated successfully', { discount });
});

/**
 * @desc    Delete discount
 * @route   DELETE /api/v1/discounts/:id
 * @access  Private/Admin
 */
exports.deleteDiscount = asyncHandler(async (req, res) => {
  const discount = await Discount.findById(req.params.id);
  
  if (!discount) {
    throw new ApiError(404, 'Discount not found');
  }
  
  await discount.deleteOne();
  
  return ApiResponse.success(res, StatusCodes.OK, 'Discount deleted successfully', {});
});

/**
 * @desc    Validate discount code
 * @route   POST /api/v1/discounts/validate
 * @access  Public
 */
exports.validateDiscountCode = asyncHandler(async (req, res) => {
  const { code, serviceType, amount, userRole } = req.body;
  
  if (!code) {
    throw new ApiError(400, 'Discount code is required');
  }
  
  const discount = await Discount.findOne({ code: code.toUpperCase() });
  
  if (!discount) {
    throw new ApiError(404, 'Invalid discount code');
  }
  
  if (!discount.isValid()) {
    throw new ApiError(400, 'Discount code is expired or no longer valid');
  }
  
  if (serviceType && !discount.canApplyToService(serviceType)) {
    throw new ApiError(400, `Discount code cannot be applied to ${serviceType}`);
  }
  
  if (amount && discount.minPurchaseAmount && amount < discount.minPurchaseAmount) {
    throw new ApiError(400, `Minimum purchase amount of ${discount.minPurchaseAmount} required`);
  }
  
  let discountValue = 0;
  if (discount.type === 'role-based' && userRole) {
    discountValue = discount.getDiscountForRole(userRole);
  } else {
    discountValue = discount.value || 0;
  }
  
  let discountAmount = 0;
  if (discount.type === 'percentage' || discount.type === 'role-based') {
    discountAmount = (amount * discountValue) / 100;
  } else {
    discountAmount = discountValue;
  }
  
  // Apply max discount limit
  if (discount.maxDiscountAmount && discountAmount > discount.maxDiscountAmount) {
    discountAmount = discount.maxDiscountAmount;
  }
  
  return ApiResponse.success(res, StatusCodes.OK, 'Discount code is valid', {
    discount: {
      id: discount._id,
      name: discount.name,
      code: discount.code,
      type: discount.type,
      value: discountValue,
      discountAmount,
      isStackable: discount.isStackable
    }
  });
});

/**
 * @desc    Get applicable discounts for a service
 * @route   GET /api/v1/discounts/applicable/:serviceType
 * @access  Public
 */
exports.getApplicableDiscounts = asyncHandler(async (req, res) => {
  try {
    const { serviceType } = req.params;
    const { userRole, providerCode } = req.query;
    
    const filter = {
      isActive: true,
      appliesTo: { $in: ['all', serviceType] }
    };
    
    // Add date filter
    const now = new Date();
    filter.$and = [
      { $or: [{ validFrom: { $exists: false } }, { validFrom: { $lte: now } }] },
      { $or: [{ validUntil: { $exists: false } }, { validUntil: { $gte: now } }] }
    ];
    
    // Filter by provider if specified
    if (providerCode) {
      filter.type = { $in: ['provider-specific', 'provider-role-based'] };
      filter['provider.code'] = providerCode.toUpperCase();
    }
    
    const discounts = await Discount.find(filter).sort({ priority: -1 }).lean();
    
    // Calculate discount values for role-based / provider-role-based discounts
    const discountsWithValues = discounts.map(discount => {
      if ((discount.type === 'role-based' || discount.type === 'provider-role-based') && discount.roleDiscounts) {
        const roleMap = {
          customer: 'customer', Customer: 'customer',
          user: 'customer', User: 'customer',
          guest: 'customer', Guest: 'customer',
          business: 'business', Business: 'business',
          staff: 'staff', Staff: 'staff',
          vendor: 'vendor', Vendor: 'vendor',
          agent: 'agent', Agent: 'agent',
          manager: 'manager', Manager: 'manager',
          executive: 'executive', Executive: 'executive',
          admin: 'admin', Admin: 'admin'
        };
        const role = roleMap[userRole] || 'customer';
        const effectiveValue = discount.roleDiscounts[role] ?? 0;
        discount.applicableValue = effectiveValue;
        // Normalise: always expose as `value` so frontend has one field to read
        discount.value = effectiveValue;
      }
      return discount;
    // Filter out discounts with zero effective value
    }).filter(d => {
      const v = d.value ?? 0;
      return v > 0;
    });
    
    return ApiResponse.success(res, StatusCodes.OK, 'Applicable discounts retrieved successfully', {
      count: discountsWithValues.length,
      discounts: discountsWithValues
    });
  } catch (error) {
    console.error('Error fetching applicable discounts:', error);
    return ApiResponse.success(res, StatusCodes.OK, 'Applicable discounts retrieved successfully', {
      count: 0,
      discounts: []
    });
  }
});

/**
 * @desc    Increment discount usage
 * @route   POST /api/v1/discounts/:id/use
 * @access  Private
 */
exports.incrementDiscountUsage = asyncHandler(async (req, res) => {
  const discount = await Discount.findById(req.params.id);
  
  if (!discount) {
    throw new ApiError(404, 'Discount not found');
  }
  
  if (!discount.isValid()) {
    throw new ApiError(400, 'Discount is no longer valid');
  }
  
  discount.usageCount += 1;
  await discount.save();
  
  return ApiResponse.success(res, StatusCodes.OK, 'Discount usage incremented', { discount });
});
