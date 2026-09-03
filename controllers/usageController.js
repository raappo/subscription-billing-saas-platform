const UsageRecord = require('../models/UsageRecord');
const Subscription = require('../models/Subscription');
const { paginate, paginationMeta } = require('../utils/pagination');
const { logAudit } = require('../utils/auditLogger');
const AppError = require('../utils/AppError');

/**
 * POST /api/usage
 * Record usage for a subscription's add-on consumption.
 * Typically called by the application backend when metered events occur
 * (e.g., API calls, storage changes).
 */
const recordUsage = async (req, res, next) => {
  try {
    const { subscriptionId, metric, quantity, unitPrice, periodStart, periodEnd } = req.body;

    // Verify subscription exists and is active
    const subscription = await Subscription.findById(subscriptionId);
    if (!subscription) {
      throw new AppError('Subscription not found.', 404, 'SUBSCRIPTION_NOT_FOUND');
    }

    if (!['active', 'trialing'].includes(subscription.status)) {
      throw new AppError(
        `Cannot record usage for subscription with status "${subscription.status}".`,
        400,
        'INVALID_SUBSCRIPTION_STATUS'
      );
    }

    // Authorization: customer can only record usage for their own subscription
    if (req.user.role === 'customer' && subscription.customerId.toString() !== req.user._id.toString()) {
      throw new AppError('You can only record usage for your own subscription.', 403, 'FORBIDDEN');
    }

    const usageRecord = new UsageRecord({
      subscriptionId,
      metric,
      quantity,
      unitPrice: unitPrice || 0,
      periodStart,
      periodEnd,
    });

    await usageRecord.save();

    await logAudit(
      req.user._id,
      'RECORD_USAGE',
      'UsageRecord',
      usageRecord._id,
      { metric, quantity, subscriptionId },
      req.ip
    );

    res.status(201).json({
      success: true,
      message: 'Usage recorded successfully.',
      data: { usageRecord },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/usage
 * Get usage records (filtered by subscription, metric, period).
 */
const getUsageRecords = async (req, res, next) => {
  try {
    const { skip, limit, page } = paginate(req.query);
    const filter = {};

    if (req.query.subscriptionId) filter.subscriptionId = req.query.subscriptionId;
    if (req.query.metric) filter.metric = req.query.metric;
    if (req.query.recorded !== undefined) filter.recorded = req.query.recorded === 'true';

    // Customer: filter to only their subscriptions
    if (req.user.role === 'customer') {
      const customerSubs = await Subscription.find({ customerId: req.user._id }).select('_id');
      filter.subscriptionId = { $in: customerSubs.map((s) => s._id) };
    }

    const [records, total] = await Promise.all([
      UsageRecord.find(filter)
        .populate('subscriptionId', 'customerId planId status')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      UsageRecord.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      message: 'Usage records retrieved.',
      data: { usageRecords: records },
      pagination: paginationMeta(total, page, limit),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/usage/summary/:subscriptionId
 * Get aggregated usage summary for a subscription.
 */
const getUsageSummary = async (req, res, next) => {
  try {
    const subscription = await Subscription.findById(req.params.subscriptionId);
    if (!subscription) {
      throw new AppError('Subscription not found.', 404, 'NOT_FOUND');
    }

    if (req.user.role === 'customer' && subscription.customerId.toString() !== req.user._id.toString()) {
      throw new AppError('You can only view your own usage.', 403, 'FORBIDDEN');
    }

    const summary = await UsageRecord.aggregate([
      { $match: { subscriptionId: subscription._id } },
      {
        $group: {
          _id: '$metric',
          totalQuantity: { $sum: '$quantity' },
          totalCost: { $sum: { $multiply: ['$quantity', '$unitPrice'] } },
          recordCount: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    res.status(200).json({
      success: true,
      message: 'Usage summary retrieved.',
      data: {
        subscriptionId: subscription._id,
        summary,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { recordUsage, getUsageRecords, getUsageSummary };
