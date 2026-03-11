// v1/controllers/emailTemplateController.js
const { StatusCodes } = require('http-status-codes');
const EmailTemplate = require('../models/emailTemplateModel');
const { ApiError } = require('../utils/apiError');
const ApiResponse = require('../utils/apiResponse');
const asyncHandler = require('../middleware/asyncHandler');
const logger = require('../utils/logger');

/**
 * @description Get all email templates
 * @route GET /api/v1/email-templates
 * @access Private (Admin/Staff)
 */
const getAllEmailTemplates = asyncHandler(async (req, res) => {
  const { category, isActive } = req.query;

  const filter = {};
  if (category) filter.category = category;
  if (isActive !== undefined) filter.isActive = isActive === 'true';

  const templates = await EmailTemplate.find(filter).sort({ category: 1, name: 1 });

  ApiResponse.success(
    res,
    StatusCodes.OK,
    'Email templates retrieved successfully',
    { templates, count: templates.length }
  );
});

/**
 * @description Get single email template by ID
 * @route GET /api/v1/email-templates/:id
 * @access Private (Admin/Staff)
 */
const getEmailTemplateById = asyncHandler(async (req, res) => {
  const template = await EmailTemplate.findById(req.params.id);

  if (!template) {
    throw new ApiError('Email template not found', StatusCodes.NOT_FOUND);
  }

  ApiResponse.success(
    res,
    StatusCodes.OK,
    'Email template retrieved successfully',
    { template }
  );
});

/**
 * @description Get email template by name
 * @route GET /api/v1/email-templates/name/:name
 * @access Private (Admin/Staff)
 */
const getEmailTemplateByName = asyncHandler(async (req, res) => {
  const template = await EmailTemplate.findOne({ name: req.params.name });

  if (!template) {
    throw new ApiError('Email template not found', StatusCodes.NOT_FOUND);
  }

  ApiResponse.success(
    res,
    StatusCodes.OK,
    'Email template retrieved successfully',
    { template }
  );
});

/**
 * @description Create new email template
 * @route POST /api/v1/email-templates
 * @access Private (Admin)
 */
const createEmailTemplate = asyncHandler(async (req, res) => {
  const template = await EmailTemplate.create(req.body);

  logger.info(`Email template created: ${template.name} by user ${req.user._id}`);

  ApiResponse.success(
    res,
    StatusCodes.CREATED,
    'Email template created successfully',
    { template }
  );
});

/**
 * @description Update email template
 * @route PUT /api/v1/email-templates/:id
 * @access Private (Admin)
 */
const updateEmailTemplate = asyncHandler(async (req, res) => {
  const template = await EmailTemplate.findById(req.params.id);

  if (!template) {
    throw new ApiError('Email template not found', StatusCodes.NOT_FOUND);
  }

  // Prevent updating system templates' name
  if (template.isSystem && req.body.name && req.body.name !== template.name) {
    throw new ApiError('Cannot change name of system templates', StatusCodes.BAD_REQUEST);
  }

  Object.assign(template, req.body);
  await template.save();

  logger.info(`Email template updated: ${template.name} by user ${req.user._id}`);

  ApiResponse.success(
    res,
    StatusCodes.OK,
    'Email template updated successfully',
    { template }
  );
});

/**
 * @description Delete email template
 * @route DELETE /api/v1/email-templates/:id
 * @access Private (Admin)
 */
const deleteEmailTemplate = asyncHandler(async (req, res) => {
  const template = await EmailTemplate.findById(req.params.id);

  if (!template) {
    throw new ApiError('Email template not found', StatusCodes.NOT_FOUND);
  }

  if (template.isSystem) {
    throw new ApiError('Cannot delete system templates', StatusCodes.BAD_REQUEST);
  }

  await template.deleteOne();

  logger.info(`Email template deleted: ${template.name} by user ${req.user._id}`);

  ApiResponse.success(
    res,
    StatusCodes.OK,
    'Email template deleted successfully'
  );
});

/**
 * @description Preview email template with sample data
 * @route POST /api/v1/email-templates/:id/preview
 * @access Private (Admin/Staff)
 */
const previewEmailTemplate = asyncHandler(async (req, res) => {
  const template = await EmailTemplate.findById(req.params.id);

  if (!template) {
    throw new ApiError('Email template not found', StatusCodes.NOT_FOUND);
  }

  const { generateEmailFromTemplate } = require('../utils/emailTemplates');
  const sampleData = req.body.sampleData || {};

  const html = generateEmailFromTemplate(template, sampleData);

  ApiResponse.success(
    res,
    StatusCodes.OK,
    'Email preview generated successfully',
    { html }
  );
});

module.exports = {
  getAllEmailTemplates,
  getEmailTemplateById,
  getEmailTemplateByName,
  createEmailTemplate,
  updateEmailTemplate,
  deleteEmailTemplate,
  previewEmailTemplate,
};
