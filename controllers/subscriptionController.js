const Subscription = require('../models/Subscription');
const Plan = require('../models/Plan');
const Coupon = require('../models/Coupon');
const { paginate, paginationMeta } = require('../utils/pagination');
const { calculateProration, getNextPeriodEnd } = require('../utils/invoiceMath');
const { logAudit } = require('../utils/auditLogger');
const AppError = require('../utils/AppError');

/**
 * POST /api/subscriptions
 * Customer subscribes to a plan. Starts a new billing cycle.
 *
 * Business rules:
 * - Customer must not already have an active/trialing subscription.
 * - Plan must exist and be active.
 * - Optional coupon code validation and application.
 */
const createSubscription = async (req, res, next) => {
  try {
    const { planId, couponCode } = req.body;
    const customerId = req.user._id;

    // Check for existing active subscription
    const existingSub = await Subscription.findOne({
      customerId,
      status: { $in: ['active', 'trialing', 'past_due'] },
    });

    if (existingSub) {
      throw new AppError(
        'You already have an active subscription. Please cancel or change your current plan instead.',
        409,
        'SUBSCRIPTION_EXISTS'
      );
    }

    // Validate plan
    const plan = await Plan.findById(planId);
    if (!plan) {
      throw new AppError('Plan not found.', 404, 'PLAN_NOT_FOUND');
    }
    if (!plan.isActive) {
      throw new AppError('This plan is no longer available.', 400, 'PLAN_INACTIVE');
    }

    const now = new Date();
    const periodEnd = getNextPeriodEnd(now, plan.billingCycle);

    const subscriptionData = {
      customerId,
      planId: plan._id,
      status: 'active',
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
    };

    // Handle coupon if provided
    if (couponCode) {
      const coupon = await Coupon.findOne({ code: couponCode.toUpperCase() });
      if (!coupon) {
        throw new AppError('Coupon not found.', 404, 'COUPON_NOT_FOUND');
      }
      if (!coupon.isValid()) {
        throw new AppError('Coupon is invalid or expired.', 400, 'COUPON_INVALID');
      }
      if (coupon.applicablePlans.length > 0 && !coupon.applicablePlans.includes(plan._id.toString())) {
        throw new AppError('Coupon is not applicable to this plan.', 400, 'COUPON_NOT_APPLICABLE');
      }

      const discount = coupon.calculateDiscount(plan.price);
      subscriptionData.couponId = coupon._id;
      subscriptionData.discountApplied = discount;

      // Increment redemption count
      coupon.currentRedemptions += 1;
      await coupon.save();
    }

    const subscription = new Subscription(subscriptionData);
    await subscription.save();

    await subscription.populate('planId');

    await logAudit(
      customerId,
      'CREATE_SUBSCRIPTION',
      'Subscription',
      subscription._id,
      { planName: plan.name, couponCode: couponCode || null },
      req.ip
    );

    res.status(201).json({
      success: true,
      message: 'Subscription created successfully.',
      data: { subscription },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/subscriptions/:id/change-plan
 * Upgrade or downgrade a subscription's plan mid-cycle.
 *
 * Business rules:
 * - Subscription must be active.
 * - New plan must be different from current plan.
 * - Calculates proration credit for unused days on old plan.
 * - Determines if this is an upgrade (higher tier) or downgrade (lower tier).
 */
const changePlan = async (req, res, next) => {
  try {
    const { newPlanId } = req.body;
    const subscription = await Subscription.findById(req.params.id);

    if (!subscription) {
      throw new AppError('Subscription not found.', 404, 'NOT_FOUND');
    }

    // Authorization: customer can only change their own subscription
    if (req.user.role === 'customer' && subscription.customerId.toString() !== req.user._id.toString()) {
      throw new AppError('You can only modify your own subscription.', 403, 'FORBIDDEN');
    }

    if (!['active', 'trialing'].includes(subscription.status)) {
      throw new AppError(
        `Cannot change plan on a subscription with status "${subscription.status}". Only active or trialing subscriptions can be changed.`,
        400,
        'INVALID_STATUS_TRANSITION'
      );
    }

    if (subscription.planId.toString() === newPlanId) {
      throw new AppError('New plan is the same as the current plan.', 400, 'SAME_PLAN');
    }

    const [currentPlan, newPlan] = await Promise.all([
      Plan.findById(subscription.planId),
      Plan.findById(newPlanId),
    ]);

    if (!newPlan) {
      throw new AppError('New plan not found.', 404, 'PLAN_NOT_FOUND');
    }
    if (!newPlan.isActive) {
      throw new AppError('The new plan is no longer available.', 400, 'PLAN_INACTIVE');
    }

    const changeType = newPlan.tier > currentPlan.tier ? 'upgrade' : 'downgrade';
    const now = new Date();

    // Calculate proration credit for remaining days on old plan
    const prorationCredit = calculateProration(
      currentPlan.price,
      currentPlan.billingCycle,
      now,
      subscription.currentPeriodEnd
    );

    // Store old plan reference and update
    subscription.previousPlanId = subscription.planId;
    subscription.planId = newPlan._id;
    subscription.prorationCredits = prorationCredit;
    subscription.planChangedAt = now;

    // For upgrades, keep current period end. For downgrades, also keep it.
    // Both take effect immediately but billing adjustment is via proration credit on next invoice.
    await subscription.save();
    await subscription.populate('planId previousPlanId');

    await logAudit(
      req.user._id,
      `PLAN_${changeType.toUpperCase()}`,
      'Subscription',
      subscription._id,
      {
        from: currentPlan.name,
        to: newPlan.name,
        prorationCredit,
        changeType,
      },
      req.ip
    );

    res.status(200).json({
      success: true,
      message: `Plan ${changeType}d successfully. Proration credit of ₹${prorationCredit} will be applied to your next invoice.`,
      data: {
        subscription,
        changeType,
        prorationCredit,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/subscriptions/:id/cancel
 * Cancel a subscription at period end with a grace period.
 *
 * Business rules:
 * - Only active/trialing/past_due subscriptions can be canceled.
 * - Cancellation takes effect at end of current billing period (not immediately).
 * - Grace period of 7 days after period end for data access.
 * - Already-canceled subscriptions return a conflict error.
 */
const cancelSubscription = async (req, res, next) => {
  try {
    const subscription = await Subscription.findById(req.params.id);

    if (!subscription) {
      throw new AppError('Subscription not found.', 404, 'NOT_FOUND');
    }

    // Authorization
    if (req.user.role === 'customer' && subscription.customerId.toString() !== req.user._id.toString()) {
      throw new AppError('You can only cancel your own subscription.', 403, 'FORBIDDEN');
    }

    if (['canceled', 'expired'].includes(subscription.status)) {
      throw new AppError('Subscription is already canceled or expired.', 409, 'ALREADY_CANCELED');
    }

    if (!['active', 'trialing', 'past_due', 'grace_period'].includes(subscription.status)) {
      throw new AppError(
        `Cannot cancel subscription with status "${subscription.status}".`,
        400,
        'INVALID_STATUS_TRANSITION'
      );
    }

    const now = new Date();

    // Set to grace_period — access continues until gracePeriodEnd
    subscription.cancelAtPeriodEnd = true;
    subscription.canceledAt = now;
    subscription.status = 'grace_period';

    // Grace period: 7 days after the current billing period end
    const gracePeriodEnd = new Date(subscription.currentPeriodEnd);
    gracePeriodEnd.setDate(gracePeriodEnd.getDate() + 7);
    subscription.gracePeriodEnd = gracePeriodEnd;

    await subscription.save();
    await subscription.populate('planId');

    await logAudit(
      req.user._id,
      'CANCEL_SUBSCRIPTION',
      'Subscription',
      subscription._id,
      { gracePeriodEnd },
      req.ip
    );

    res.status(200).json({
      success: true,
      message: `Subscription canceled. Access continues until ${gracePeriodEnd.toISOString()} (grace period).`,
      data: { subscription },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/subscriptions — List subscriptions.
 * Customer sees own; Admin sees all (with filtering).
 */
const getSubscriptions = async (req, res, next) => {
  try {
    const { skip, limit, page } = paginate(req.query);
    const filter = {};

    if (req.user.role === 'customer') {
      filter.customerId = req.user._id;
    } else if (req.query.customerId) {
      filter.customerId = req.query.customerId;
    }

    if (req.query.status) {
      filter.status = req.query.status;
    }

    const [subscriptions, total] = await Promise.all([
      Subscription.find(filter)
        .populate('planId', 'name price billingCycle tier')
        .populate('customerId', 'name email')
        .populate('couponId', 'code discountType discountValue')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Subscription.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      message: 'Subscriptions retrieved.',
      data: { subscriptions },
      pagination: paginationMeta(total, page, limit),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/subscriptions/:id — Get a single subscription.
 */
const getSubscriptionById = async (req, res, next) => {
  try {
    const subscription = await Subscription.findById(req.params.id)
      .populate('planId')
      .populate('customerId', 'name email')
      .populate('couponId', 'code discountType discountValue')
      .populate('previousPlanId', 'name price billingCycle');

    if (!subscription) {
      throw new AppError('Subscription not found.', 404, 'NOT_FOUND');
    }

    // Customer can only view own subscription
    if (req.user.role === 'customer' && subscription.customerId._id.toString() !== req.user._id.toString()) {
      throw new AppError('You can only view your own subscription.', 403, 'FORBIDDEN');
    }

    res.status(200).json({
      success: true,
      message: 'Subscription retrieved.',
      data: { subscription },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createSubscription,
  changePlan,
  cancelSubscription,
  getSubscriptions,
  getSubscriptionById,
};
