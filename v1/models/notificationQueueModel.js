// v1/models/notificationQueueModel.js
const mongoose = require('mongoose');
const { NotificationStatus, NotificationType, NotificationPriority } = require('../utils/constants');

/**
 * @description Schema for notification queue
 * Manages task assignments and notifications for staff
 */
const NotificationQueueSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: Object.values(NotificationType),
    required: true,
  },
  priority: {
    type: String,
    enum: Object.values(NotificationPriority),
    default: NotificationPriority.MEDIUM,
  },
  title: {
    type: String,
    required: true,
    trim: true,
  },
  description: {
    type: String,
    trim: true,
  },
  relatedEntity: {
    entityType: {
      type: String,
      enum: ['AbandonedBooking', 'CarBooking', 'FlightBooking', 'HotelBooking', 'VisaApplication', 'User', 'Other'],
    },
    entityId: {
      type: mongoose.Schema.Types.ObjectId,
    },
  },
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  assignedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  status: {
    type: String,
    enum: Object.values(NotificationStatus),
    default: NotificationStatus.PENDING,
  },
  assignedAt: Date,
  startedAt: Date,
  completedAt: Date,
  dueDate: Date,
  notes: [{
    note: String,
    addedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    addedAt: {
      type: Date,
      default: Date.now,
    },
  }],
  metadata: {
    type: mongoose.Schema.Types.Mixed,
  },
}, {
  timestamps: true,
});

// Indexes
NotificationQueueSchema.index({ type: 1, status: 1 });
NotificationQueueSchema.index({ assignedTo: 1, status: 1 });
NotificationQueueSchema.index({ priority: 1, createdAt: -1 });
NotificationQueueSchema.index({ status: 1, createdAt: -1 });
NotificationQueueSchema.index({ dueDate: 1, status: 1 });

// Method to assign notification
NotificationQueueSchema.methods.assign = function(userId, assignedByUserId) {
  this.assignedTo = userId;
  this.assignedBy = assignedByUserId;
  this.assignedAt = new Date();
  this.status = NotificationStatus.ASSIGNED;
  return this.save();
};

// Method to start work on notification
NotificationQueueSchema.methods.startWork = function() {
  this.status = NotificationStatus.IN_PROGRESS;
  this.startedAt = new Date();
  return this.save();
};

// Method to complete notification
NotificationQueueSchema.methods.complete = function(note) {
  this.status = NotificationStatus.COMPLETED;
  this.completedAt = new Date();
  if (note) {
    this.notes.push({ note, addedAt: new Date() });
  }
  return this.save();
};

module.exports = mongoose.model('NotificationQueue', NotificationQueueSchema);
