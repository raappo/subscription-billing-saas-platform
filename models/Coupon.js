const mongoose = require('mongoose');

const couponSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: [true, 'Coupon code is required'],
      unique: true,
      uppercase: true,
      trim: true,
    },
    discountType: {
      type: String,
      enum: ['percentage', 'fixed'],
      required: [true, 'Discount type is required'],
    },
    discountValue: {
      type: Number,
      required: [true, 'Discount value is required'],
      min: [0, 'Discount value cannot be negative'],
    },
    maxRedemptions: {
      type: Number,
      default: null,
      comment: 'null = unlimited redemptions',
    },
    currentRedemptions: {
      type: Number,
      default: 0,
    },
    validFrom: {
      type: Date,
      default: Date.now,
    },
    validUntil: {
      type: Date,
      default: null,
      comment: 'null = no expiry',
    },
    applicablePlans: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Plan',
      },
    ],
    isActive: {
      type: Boolean,
      default: true,
    },
    description: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

// Index declared via schema-level unique:true on code field.
couponSchema.index({ isActive: 1 });

// Check if coupon is currently valid
couponSchema.methods.isValid = function () {
  const now = new Date();
  if (!this.isActive) return false;
  if (this.validUntil && now > this.validUntil) return false;
  if (now < this.validFrom) return false;
  if (this.maxRedemptions !== null && this.currentRedemptions >= this.maxRedemptions) return false;
  return true;
};

// Calculate discount amount for a given price
couponSchema.methods.calculateDiscount = function (price) {
  if (this.discountType === 'percentage') {
    return Math.round((price * this.discountValue) / 100 * 100) / 100;
  }
  return Math.min(this.discountValue, price);
};

module.exports = mongoose.model('Coupon', couponSchema);
