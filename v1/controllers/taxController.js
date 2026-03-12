const Tax = require('../models/taxModel');
const asyncHandler = require('../middleware/asyncHandler');
const ApiResponse = require('../utils/apiResponse');
const ApiError = require('../utils/apiError');

/**
 * @desc    Get all taxes
 * @route   GET /api/v1/taxes
 * @access  Private/Admin
 */
exports.getAllTaxes = asyncHandler(async (req, res) => {
  try {
    const { isActive, appliesTo, country } = req.query;
    
    const filter = {};
    if (isActive !== undefined) filter.isActive = isActive === 'true';
    if (appliesTo) filter.appliesTo = appliesTo;
    if (country) filter.country = country;
    
    const taxes = await Tax.find(filter)
      .sort({ priority: -1, createdAt: -1 })
      .populate('createdBy', 'firstName lastName email')
      .populate('updatedBy', 'firstName lastName email')
      .lean();
    
    return ApiResponse.success(res, 200, 'Taxes retrieved successfully', {
      count: taxes.length,
      taxes
    });
  } catch (error) {
    console.error('Error fetching taxes:', error);
    // Return empty array if there's an error (e.g., collection doesn't exist)
    return ApiResponse.success(res, 200, 'Taxes retrieved successfully', {
      count: 0,
      taxes: []
    });
  }
});

/**
 * @desc    Get single tax
 * @route   GET /api/v1/taxes/:id
 * @access  Private/Admin
 */
exports.getTax = asyncHandler(async (req, res) => {
  try {
    const tax = await Tax.findById(req.params.id)
      .populate('createdBy', 'firstName lastName email')
      .populate('updatedBy', 'firstName lastName email')
      .lean();
    
    if (!tax) {
      throw new ApiError(404, 'Tax not found');
    }
    
    return ApiResponse.success(res, 200, 'Tax retrieved successfully', { tax });
  } catch (error) {
    if (error instanceof ApiError) throw error;
    console.error('Error fetching tax:', error);
    throw new ApiError(404, 'Tax not found');
  }
});

/**
 * @desc    Create tax
 * @route   POST /api/v1/taxes
 * @access  Private/Admin
 */
exports.createTax = asyncHandler(async (req, res) => {
  const { name, description, type, rate, appliesTo, country, isActive, isInclusive, priority } = req.body;
  
  const tax = await Tax.create({
    name,
    description,
    type,
    rate,
    appliesTo,
    country,
    isActive,
    isInclusive,
    priority,
    createdBy: req.user._id
  });
  
  return ApiResponse.success(res, 201, 'Tax created successfully', { tax });
});

/**
 * @desc    Update tax
 * @route   PUT /api/v1/taxes/:id
 * @access  Private/Admin
 */
exports.updateTax = asyncHandler(async (req, res) => {
  const { name, description, type, rate, appliesTo, country, isActive, isInclusive, priority } = req.body;
  
  const tax = await Tax.findById(req.params.id);
  
  if (!tax) {
    throw new ApiError(404, 'Tax not found');
  }
  
  if (name) tax.name = name;
  if (description !== undefined) tax.description = description;
  if (type) tax.type = type;
  if (rate !== undefined) tax.rate = rate;
  if (appliesTo) tax.appliesTo = appliesTo;
  if (country) tax.country = country;
  if (isActive !== undefined) tax.isActive = isActive;
  if (isInclusive !== undefined) tax.isInclusive = isInclusive;
  if (priority !== undefined) tax.priority = priority;
  tax.updatedBy = req.user._id;
  
  await tax.save();
  
  return ApiResponse.success(res, 200, 'Tax updated successfully', { tax });
});

/**
 * @desc    Delete tax
 * @route   DELETE /api/v1/taxes/:id
 * @access  Private/Admin
 */
exports.deleteTax = asyncHandler(async (req, res) => {
  const tax = await Tax.findById(req.params.id);
  
  if (!tax) {
    throw new ApiError(404, 'Tax not found');
  }
  
  await tax.deleteOne();
  
  return ApiResponse.success(res, 200, 'Tax deleted successfully', null);
});

/**
 * @desc    Get applicable taxes for a service
 * @route   GET /api/v1/taxes/applicable/:serviceType
 * @access  Public
 */
exports.getApplicableTaxes = asyncHandler(async (req, res) => {
  try {
    const { serviceType } = req.params;
    const { country = 'NG' } = req.query;
    
    const taxes = await Tax.find({
      isActive: true,
      country,
      $or: [
        { appliesTo: 'all' },
        { appliesTo: serviceType }
      ]
    }).sort({ priority: -1 }).lean();
    
    return ApiResponse.success(res, 200, 'Applicable taxes retrieved successfully', {
      count: taxes.length,
      taxes
    });
  } catch (error) {
    console.error('Error fetching applicable taxes:', error);
    return ApiResponse.success(res, 200, 'Applicable taxes retrieved successfully', {
      count: 0,
      taxes: []
    });
  }
});
