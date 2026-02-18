// v1/services/visaStatusUpdateService.js
const VisaApplication = require('../models/visaApplicationModel');
const visaProcessingService = require('./visaProcessingService');
const logger = require('../utils/logger');

/**
 * @function updateVisaStatusesFromExternalAPI
 * @description Periodically checks and updates visa application statuses from external API.
 * This function should be called by a cron job or background worker.
 */
const updateVisaStatusesFromExternalAPI = async () => {
  try {
    logger.info('Starting visa status update job...');

    // Find all visa applications that have external references and are not in final states
    const activeApplications = await VisaApplication.find({
      externalReference: { $exists: true, $ne: null },
      status: { $nin: ['Approved', 'Rejected'] },
      $or: [
        { lastExternalStatusCheck: { $exists: false } },
        { lastExternalStatusCheck: { $lt: new Date(Date.now() - 4 * 60 * 60 * 1000) } } // 4 hours ago
      ]
    }).limit(50); // Process in batches to avoid overwhelming the external API

    logger.info(`Found ${activeApplications.length} applications to check status for`);

    let updatedCount = 0;
    let errorCount = 0;

    for (const application of activeApplications) {
      try {
        const statusResponse = await visaProcessingService.checkVisaStatus(
          application.externalReference,
          application.applicationReference
        );

        const externalStatus = statusResponse.data;
        let statusChanged = false;

        // Update external status check timestamp
        application.lastExternalStatusCheck = new Date();

        // Check if external status has changed
        if (externalStatus.status !== application.externalStatus) {
          application.externalStatus = externalStatus.status;
          statusChanged = true;

          // Map external status to internal status
          const statusMapping = {
            'Submitted': 'Under Review',
            'In Review': 'Under Review',
            'Documents Required': 'Additional Documents Required',
            'Approved': 'Approved',
            'Rejected': 'Rejected',
            'Decision Made': 'Approved' // Assuming positive decision
          };

          const mappedStatus = statusMapping[externalStatus.status];
          if (mappedStatus && mappedStatus !== application.status) {
            const oldStatus = application.status;
            application.status = mappedStatus;

            // Add to status history
            application.statusHistory.push({
              status: mappedStatus,
              updatedAt: new Date(),
              notes: `Status updated from external processor: ${externalStatus.statusDescription || externalStatus.status}`
            });

            // Handle status-specific actions
            if (mappedStatus === 'Approved') {
              application.actualProcessingTime = Math.ceil(
                (new Date() - application.createdAt) / (1000 * 60 * 60 * 24)
              );
            }

            logger.info(`Updated application ${application.applicationReference} status from ${oldStatus} to ${mappedStatus}`);
          }
        }

        // Update additional information if available
        if (externalStatus.estimatedCompletion && externalStatus.estimatedCompletion !== application.estimatedProcessingTime) {
          application.estimatedProcessingTime = externalStatus.estimatedCompletion;
          statusChanged = true;
        }

        // Update biometric appointment information if available
        if (externalStatus.biometric && externalStatus.biometric.appointment) {
          if (!application.appointmentDetails || 
              application.appointmentDetails.appointmentId !== externalStatus.biometric.appointment.id) {
            application.appointmentDetails = {
              appointmentId: externalStatus.biometric.appointment.id,
              scheduledDate: new Date(externalStatus.biometric.appointment.date),
              scheduledTime: externalStatus.biometric.appointment.time,
              location: externalStatus.biometric.appointment.location,
              address: externalStatus.biometric.appointment.address,
              instructions: externalStatus.biometric.appointment.instructions || []
            };
            statusChanged = true;
          }
        }

        if (statusChanged) {
          await application.save();
          updatedCount++;

          // TODO: Send notification to user about status change
          // This could be implemented using the existing notification queues
        }

        // Add small delay to avoid overwhelming the external API
        await new Promise(resolve => setTimeout(resolve, 1000));

      } catch (error) {
        logger.error(`Failed to update status for application ${application.applicationReference}:`, error.message);
        errorCount++;
        
        // Continue with next application even if one fails
        continue;
      }
    }

    logger.info(`Visa status update job completed. Updated: ${updatedCount}, Errors: ${errorCount}`);

    return {
      success: true,
      processed: activeApplications.length,
      updated: updatedCount,
      errors: errorCount
    };

  } catch (error) {
    logger.error('Visa status update job failed:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * @function checkSingleApplicationStatus
 * @description Checks and updates status for a single visa application.
 * @param {string} applicationId - The visa application ID.
 * @returns {object} Update result.
 */
const checkSingleApplicationStatus = async (applicationId) => {
  try {
    const application = await VisaApplication.findById(applicationId);

    if (!application) {
      throw new Error('Visa application not found');
    }

    if (!application.externalReference) {
      throw new Error('Application has no external reference');
    }

    const statusResponse = await visaProcessingService.checkVisaStatus(
      application.externalReference,
      application.applicationReference
    );

    const externalStatus = statusResponse.data;
    const oldStatus = application.status;
    let statusChanged = false;

    // Update external status check timestamp
    application.lastExternalStatusCheck = new Date();

    // Check if external status has changed
    if (externalStatus.status !== application.externalStatus) {
      application.externalStatus = externalStatus.status;
      statusChanged = true;

      // Map external status to internal status
      const statusMapping = {
        'Submitted': 'Under Review',
        'In Review': 'Under Review',
        'Documents Required': 'Additional Documents Required',
        'Approved': 'Approved',
        'Rejected': 'Rejected'
      };

      const mappedStatus = statusMapping[externalStatus.status];
      if (mappedStatus && mappedStatus !== application.status) {
        application.status = mappedStatus;

        // Add to status history
        application.statusHistory.push({
          status: mappedStatus,
          updatedAt: new Date(),
          notes: `Status updated from external processor: ${externalStatus.statusDescription || externalStatus.status}`
        });

        statusChanged = true;
      }
    }

    if (statusChanged) {
      await application.save();
    }

    return {
      success: true,
      statusChanged,
      oldStatus,
      newStatus: application.status,
      externalStatus: externalStatus.status
    };

  } catch (error) {
    logger.error(`Failed to check single application status:`, error.message);
    throw error;
  }
};

/**
 * @function getVisaStatusSummary
 * @description Gets a summary of visa applications by status.
 * @returns {object} Status summary.
 */
const getVisaStatusSummary = async () => {
  try {
    const summary = await VisaApplication.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          avgProcessingTime: { $avg: '$actualProcessingTime' }
        }
      },
      {
        $sort: { count: -1 }
      }
    ]);

    const externalSummary = await VisaApplication.aggregate([
      {
        $match: { externalReference: { $exists: true, $ne: null } }
      },
      {
        $group: {
          _id: '$externalStatus',
          count: { $sum: 1 }
        }
      },
      {
        $sort: { count: -1 }
      }
    ]);

    const totalApplications = await VisaApplication.countDocuments();
    const externalApplications = await VisaApplication.countDocuments({
      externalReference: { $exists: true, $ne: null }
    });

    return {
      success: true,
      data: {
        totalApplications,
        externalApplications,
        integrationRate: totalApplications > 0 ? (externalApplications / totalApplications * 100).toFixed(2) : 0,
        statusBreakdown: summary,
        externalStatusBreakdown: externalSummary
      }
    };

  } catch (error) {
    logger.error('Failed to get visa status summary:', error.message);
    throw error;
  }
};

module.exports = {
  updateVisaStatusesFromExternalAPI,
  checkSingleApplicationStatus,
  getVisaStatusSummary
};