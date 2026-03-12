const ServiceCharge = require('../models/serviceChargeModel');
const asyncHandler = require('../middleware/asyncHandler');
const ApiResponse = require('../utils/apiResponse');
const ApiError = require('../utils/apiError');

/**
 * @desc    Get all service charges
 * @route   GET /api/v1/service-charges
 * @access  Private/Admin
 */
exports.getAllServiceCharges = asyncHandler(async (req, res) => {
  try {
    const { isActive, appliesTo } = req.query;
    
    const filter = {};
    if (isActive !== undefined) filter.isActive = isActive === 'true';
    if (appliesTo) filter.appliesTo = appliesTo;
    
    const serviceCharges = await ServiceCharge.find(filter)
      .sort({ priority: -1, createdAt: -1 })
      .populate('createdBy', 'firstName lastName email')
      .populate('updatedBy', 'firstName lastName email')
      .lean();
    
    res.status(200).json(ApiResponse.success({
      count: serviceCharges.length,
      serviceCharges
    }, 'Service charges retrieved successfully'));
  } catch (error) {
    console.error('Error fetching service charges:', error);
    // Return empty array if there's an error (e.g., collection doesn't exist)
    res.status(200).json(ApiResponse.success({
      count: 0,
      serviceCharges: []
    }, 'Service charges retrieved successfully'));
  }
});

/**
 * @desc    Get single service charge
 * @route   GET /api/v1/service-charges/:id
 * @access  Private/Admin
 */
exports.getServiceCharge = asyncHandler(async (req, res) => {
  try {
    const serviceCharge = await ServiceCharge.findById(req.params.id)
      .populate('createdBy', 'firstName lastName email')
      .populate('updatedBy', 'firstName lastName email')
      .lean();
    
    if (!serviceCharge) {
      throw new ApiError(404, 'Service charge not found');
    }
    
    res.status(200).json(ApiResponse.success({ serviceCharge }, 'Service charge retrieved successfully'));
  } catch (error) {
    if (error instanceof ApiError) throw error;
    console.error('Error fetching service charge:', error);
    throw new ApiError(404, 'Service charge not found');
  }
});

/**
 * @desc    Create service charge
 * @route   POST /api/v1/service-charges
 * @access  Private/Admin
 */
exports.createServiceCharge = asyncHandler(async (req, res) => {
  const { name, description, type, value, appliesTo, isActive, priority } = req.body;
  
  const serviceCharge = await ServiceCharge.create({
    name,
    description,
    type,
    value,
    appliesTo,
    isActive,
    priority,
    createdBy: req.user._id
  });
  
  res.status(201).json(ApiResponse.success({ serviceCharge }, 'Service charge created successfully'));
});

/**
 * @desc    Update service charge
 * @route   PUT /api/v1/service-charges/:id
 * @access  Private/Admin
 */
exports.updateServiceCharge = asyncHandler(async (req, res) => {
  const { name, description, type, value, appliesTo, isActive, priority } = req.body;
  
  const serviceCharge = await ServiceCharge.findById(req.params.id);
  
  if (!serviceCharge) {
    throw new ApiError(404, 'Service charge not found');
  }
  
  if (name) serviceCharge.name = name;
  if (description !== undefined) serviceCharge.description = description;
  if (type) serviceCharge.type = type;
  if (value !== undefined) serviceCharge.value = value;
  if (appliesTo) serviceCharge.appliesTo = appliesTo;
  if (isActive !== undefined) serviceCharge.isActive = isActive;
  if (priority !== undefined) serviceCharge.priority = priority;
  serviceCharge.updatedBy = req.user._id;
  
  await serviceCharge.save();
  
  res.status(200).json(ApiResponse.success({ serviceCharge }, 'Service charge updated successfully'));
});

/**
 * @desc    Delete service charge
 * @route   DELETE /api/v1/service-charges/:id
 * @access  Private/Admin
 */
exports.deleteServiceCharge = asyncHandler(async (req, res) => {
  const serviceCharge = await ServiceCharge.findById(req.params.id);
  
  if (!serviceCharge) {
    throw new ApiError(404, 'Service charge not found');
  }
  
  await serviceCharge.deleteOne();
  
  res.status(200).json(ApiResponse.success(null, 'Service charge deleted successfully'));
});

/**
 * @desc    Get applicable service charges for a service
 * @route   GET /api/v1/service-charges/applicable/:serviceType
 * @access  Public
 */
exports.getApplicableServiceCharges = asyncHandler(async (req, res) => {
  try {
    const { serviceType } = req.params;
    
    const serviceCharges = await ServiceCharge.find({
      isActive: true,
      $or: [
        { appliesTo: 'all' },
        { appliesTo: serviceType }
      ]
    }).sort({ priority: -1 }).lean();
    
    res.status(200).json(ApiResponse.success({
      count: serviceCharges.length,
      serviceCharges
    }, 'Applicable service charges retrieved successfully'));
  } catch (error) {
    console.error('Error fetching applicable service charges:', error);
    res.status(200).json(ApiResponse.success({
      count: 0,
      serviceCharges: []
    }, 'Applicable service charges retrieved successfully'));
  }
});
