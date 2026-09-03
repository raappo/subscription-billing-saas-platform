const mongoose = require('mongoose');

const usageRecordSchema = new mongoose.Schema(
  {
    subscriptionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Subscription',
      required: [true, 'Subscription ID is required'],
    },
    metric: {
      type: String,
      required: [true, 'Metric name is required'],
      enum: ['api_calls', 'storage_gb', 'bandwidth_gb', 'users'],
      trim: true,
    },
    quantity: {
      type: Number,
      required: [true, 'Quantity is required'],
      min: [0, 'Quantity cannot be negative'],
    },
    unitPrice: {
      type: Number,
      default: 0,
      min: 0,
      comment: 'Price per unit for usage-based billing',
    },
    periodStart: {
      type: Date,
      required: true,
    },
    periodEnd: {
      type: Date,
      required: true,
    },
    recorded: {
      type: Boolean,
      default: false,
      comment: 'Whether this usage has been included in a generated invoice',
    },
  },
  {
    timestamps: true,
  }
);

usageRecordSchema.index({ subscriptionId: 1 });
usageRecordSchema.index({ subscriptionId: 1, periodStart: 1, periodEnd: 1 });
usageRecordSchema.index({ recorded: 1 });

module.exports = mongoose.model('UsageRecord', usageRecordSchema);
