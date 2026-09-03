const mongoose = require('mongoose');

const planSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Plan name is required'],
      trim: true,
      unique: true,
    },
    description: {
      type: String,
      trim: true,
      default: '',
    },
    price: {
      type: Number,
      required: [true, 'Price is required'],
      min: [0, 'Price cannot be negative'],
    },
    billingCycle: {
      type: String,
      required: [true, 'Billing cycle is required'],
      enum: ['monthly', 'quarterly', 'yearly'],
    },
    featureLimits: {
      apiCalls: { type: Number, default: 1000 },
      storage: { type: Number, default: 5 }, // in GB
      users: { type: Number, default: 1 },
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    tier: {
      type: Number,
      required: [true, 'Plan tier is required'],
      min: 1,
      comment: 'Numeric tier for upgrade/downgrade comparison: 1=basic, 2=pro, 3=enterprise, etc.',
    },
  },
  {
    timestamps: true,
  }
);

planSchema.index({ name: 1 }, { unique: true });
planSchema.index({ isActive: 1 });

module.exports = mongoose.model('Plan', planSchema);
