const mongoose = require('mongoose');

/**
 * Subscription Status State Machine:
 *
 *   trialing → active → past_due → canceled
 *                ↓          ↓
 *             canceled   canceled
 *                ↑
 *           (grace period → expired)
 *
 * - trialing: optional trial period before first charge
 * - active: subscription is paid and current
 * - past_due: payment failed, in dunning/retry cycle
 * - grace_period: customer requested cancellation, access continues until currentPeriodEnd
 * - canceled: subscription terminated, no access
 * - expired: grace period ended, auto-transitioned from grace_period
 */
const subscriptionSchema = new mongoose.Schema(
  {
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Customer ID is required'],
    },
    planId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Plan',
      required: [true, 'Plan ID is required'],
    },
    status: {
      type: String,
      enum: ['trialing', 'active', 'past_due', 'grace_period', 'canceled', 'expired'],
      default: 'active',
    },
    currentPeriodStart: {
      type: Date,
      required: true,
    },
    currentPeriodEnd: {
      type: Date,
      required: true,
    },
    cancelAtPeriodEnd: {
      type: Boolean,
      default: false,
    },
    canceledAt: {
      type: Date,
      default: null,
    },
    gracePeriodEnd: {
      type: Date,
      default: null,
    },
    // Proration tracking for plan changes
    prorationCredits: {
      type: Number,
      default: 0,
      comment: 'Credit in currency units from unused time on previous plan after a mid-cycle change',
    },
    previousPlanId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Plan',
      default: null,
    },
    planChangedAt: {
      type: Date,
      default: null,
    },
    // Coupon applied
    couponId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Coupon',
      default: null,
    },
    discountApplied: {
      type: Number,
      default: 0,
    },
    // Dunning metadata
    failedPaymentCount: {
      type: Number,
      default: 0,
    },
    lastPaymentAttempt: {
      type: Date,
      default: null,
    },
    nextRetryAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

subscriptionSchema.index({ customerId: 1 });
subscriptionSchema.index({ status: 1 });
subscriptionSchema.index({ currentPeriodEnd: 1 });

module.exports = mongoose.model('Subscription', subscriptionSchema);
