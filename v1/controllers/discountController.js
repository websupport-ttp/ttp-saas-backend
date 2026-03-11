const Discount = require('../models/discountModel');
const asyncHandler = require('../middleware/asyncHandler');
const ApiResponse = require('../utils/apiResponse');
const ApiError = require('../utils/apiError');

/**
 * @desc    Get all discounts
 * @route   GET /api/v1/discounts
 * @access  Private/Admin
 */
exports.getAllDiscounts = asyncHandler(async (req, res) => {
  const { isActive, type, appliesTo } = req.query;
  
  const filter = {};
  if (isActive !== undefined) filter.isActive = isActive === 'true';
  if (type) filter.type = type;
  if (appliesTo) filter.appliesTo = appliesTo;
  
  const discounts = await Discount.find(filter)
    .sort({ priority: -1, createdAt: -1 })
    .populate('createdBy', 'firstName lastName email')
    .populate('updatedBy', 'firstName lastName email');
  
  res.status(200).json(ApiResponse.success({
    count: discounts.length,
    discounts
  }, 'Discounts retrieved successfully'));
});

/**
 * @desc    Get single discount
 * @route   GET /api/v1/discounts/:id
 * @access  Private/Admin
 */
exports.getDiscount = asyncHandler(async (req, res) => {
  const discount = await Discount.findById(req.params.id)
    .populate('createdBy', 'firstName lastName email')
    .populate('updatedBy', 'firstName lastName email');
  
  if (!discount) {
    throw new ApiError(404, 'Discount not found');
  }
  
  res.status(200).json(ApiResponse.success({ discount }, 'Discount retrieved successfully'));
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
  
  res.status(201).json(ApiResponse.success({ discount }, 'Discount created successfully'));
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
  if (maxDiscountAmount !== undefined) discount.maxDiscountAmount = maxDiscountAmount;
  if (usageLimit !== undefined) discount.usageLimit = usageLimit;
  if (validFrom) discount.validFrom = validFrom;
  if (validUntil) discount.validUntil = validUntil;
  if (isActive !== undefined) discount.isActive = isActive;
  if (isStackable !== undefined) discount.isStackable = isStackable;
  if (priority !== undefined) discount.priority = priority;
  discount.updatedBy = req.user._id;
  
  await discount.save();
  
  res.status(200).json(ApiResponse.success({ discount }, 'Discount updated successfully'));
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
  
  res.status(200).json(ApiResponse.success(null, 'Discount deleted successfully'));
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
  
  res.status(200).json(ApiResponse.success({
    discount: {
      id: discount._id,
      name: discount.name,
      code: discount.code,
      type: discount.type,
      value: discountValue,
      discountAmount,
      isStackable: discount.isStackable
    }
  }, 'Discount code is valid'));
});

/**
 * @desc    Get applicable discounts for a service
 * @route   GET /api/v1/discounts/applicable/:serviceType
 * @access  Public
 */
exports.getApplicableDiscounts = asyncHandler(async (req, res) => {
  const { serviceType } = req.params;
  const { userRole, providerCode } = req.query;
  
  const filter = {
    isActive: true,
    $or: [
      { appliesTo: 'all' },
      { appliesTo: serviceType }
    ]
  };
  
  // Add date filter
  const now = new Date();
  filter.$and = [
    { $or: [{ validFrom: { $exists: false } }, { validFrom: { $lte: now } }] },
    { $or: [{ validUntil: { $exists: false } }, { validUntil: { $gte: now } }] }
  ];
  
  // Filter by provider if specified
  if (providerCode) {
    filter['provider.code'] = providerCode;
  }
  
  const discounts = await Discount.find(filter).sort({ priority: -1 });
  
  // Calculate discount values for role-based discounts
  const discountsWithValues = discounts.map(discount => {
    const discountObj = discount.toObject();
    if (discount.type === 'role-based' && userRole) {
      discountObj.applicableValue = discount.getDiscountForRole(userRole);
    }
    return discountObj;
  });
  
  res.status(200).json(ApiResponse.success({
    count: discountsWithValues.length,
    discounts: discountsWithValues
  }, 'Applicable discounts retrieved successfully'));
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
  
  res.status(200).json(ApiResponse.success({ discount }, 'Discount usage incremented'));
});
