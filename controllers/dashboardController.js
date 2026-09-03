const Subscription = require('../models/Subscription');
const Invoice = require('../models/Invoice');
const UsageRecord = require('../models/UsageRecord');
const User = require('../models/User');
const AppError = require('../utils/AppError');

/**
 * GET /api/dashboard/customer
 * Customer billing dashboard — current plan, usage summary, recent invoices.
 * Module 10: Customer Billing Dashboard.
 */
const getCustomerDashboard = async (req, res, next) => {
  try {
    const customerId = req.user._id;

    // Get active subscription
    const activeSubscription = await Subscription.findOne({
      customerId,
      status: { $in: ['active', 'trialing', 'past_due', 'grace_period'] },
    })
      .populate('planId')
      .populate('couponId', 'code discountType discountValue');

    // Get all subscriptions for history
    const subscriptionHistory = await Subscription.find({ customerId })
      .populate('planId', 'name price billingCycle')
      .sort({ createdAt: -1 })
      .limit(10);

    // Get recent invoices
    const recentInvoices = await Invoice.find({ customerId })
      .sort({ createdAt: -1 })
      .limit(10);

    // Get usage summary for active subscription
    let usageSummary = [];
    if (activeSubscription) {
      usageSummary = await UsageRecord.aggregate([
        { $match: { subscriptionId: activeSubscription._id } },
        {
          $group: {
            _id: '$metric',
            totalQuantity: { $sum: '$quantity' },
            totalCost: { $sum: { $multiply: ['$quantity', '$unitPrice'] } },
          },
        },
        { $sort: { _id: 1 } },
      ]);
    }

    // Calculate total spent
    const totalSpent = await Invoice.aggregate([
      { $match: { customerId, status: 'paid' } },
      { $group: { _id: null, total: { $sum: '$total' } } },
    ]);

    res.status(200).json({
      success: true,
      message: 'Customer dashboard retrieved.',
      data: {
        activeSubscription,
        subscriptionHistory,
        recentInvoices,
        usageSummary,
        totalSpent: totalSpent[0]?.total || 0,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/admin/reports/revenue
 * Admin revenue reports — MRR, churn rate, plan-wise subscriber counts.
 * Module 12: Admin Revenue Reports.
 */
const getRevenueReport = async (req, res, next) => {
  try {
    // 1. Monthly Recurring Revenue (MRR)
    // MRR = sum of all active subscriptions' monthly-equivalent plan prices
    const activeSubscriptions = await Subscription.find({
      status: { $in: ['active', 'trialing'] },
    }).populate('planId');

    let mrr = 0;
    activeSubscriptions.forEach((sub) => {
      if (!sub.planId) return;
      const plan = sub.planId;
      switch (plan.billingCycle) {
        case 'monthly':
          mrr += plan.price;
          break;
        case 'quarterly':
          mrr += plan.price / 3;
          break;
        case 'yearly':
          mrr += plan.price / 12;
          break;
      }
      // Subtract discount
      if (sub.discountApplied > 0) {
        mrr -= sub.discountApplied / (plan.billingCycle === 'monthly' ? 1 : plan.billingCycle === 'quarterly' ? 3 : 12);
      }
    });
    mrr = Math.round(mrr * 100) / 100;

    // 2. Churn rate
    // Churn = (canceled in last 30 days / total at start of period) * 100
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const canceledLast30 = await Subscription.countDocuments({
      status: { $in: ['canceled', 'expired'] },
      canceledAt: { $gte: thirtyDaysAgo },
    });

    const totalSubscriptions = await Subscription.countDocuments();
    const activeCount = activeSubscriptions.length;
    const churnRate = totalSubscriptions > 0
      ? Math.round((canceledLast30 / totalSubscriptions) * 10000) / 100
      : 0;

    // 3. Plan-wise subscriber counts
    const planWiseCount = await Subscription.aggregate([
      { $match: { status: { $in: ['active', 'trialing', 'past_due'] } } },
      {
        $lookup: {
          from: 'plans',
          localField: 'planId',
          foreignField: '_id',
          as: 'plan',
        },
      },
      { $unwind: '$plan' },
      {
        $group: {
          _id: '$plan._id',
          planName: { $first: '$plan.name' },
          planPrice: { $first: '$plan.price' },
          billingCycle: { $first: '$plan.billingCycle' },
          subscriberCount: { $sum: 1 },
          revenue: { $sum: '$plan.price' },
        },
      },
      { $sort: { subscriberCount: -1 } },
    ]);

    // 4. Revenue from paid invoices (last 30 days)
    const revenueRecent = await Invoice.aggregate([
      { $match: { status: 'paid', paidAt: { $gte: thirtyDaysAgo } } },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$total' },
          invoiceCount: { $sum: 1 },
          avgInvoiceAmount: { $avg: '$total' },
        },
      },
    ]);

    // 5. Status breakdown
    const statusBreakdown = await Subscription.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // 6. Invoice status breakdown
    const invoiceStatusBreakdown = await Invoice.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalAmount: { $sum: '$total' },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // 7. Customer count
    const totalCustomers = await User.countDocuments({ role: 'customer' });

    res.status(200).json({
      success: true,
      message: 'Revenue report generated.',
      data: {
        mrr,
        churnRate,
        activeSubscriptions: activeCount,
        totalSubscriptions,
        totalCustomers,
        canceledLast30Days: canceledLast30,
        planWiseBreakdown: planWiseCount,
        recentRevenue: revenueRecent[0] || { totalRevenue: 0, invoiceCount: 0, avgInvoiceAmount: 0 },
        subscriptionStatusBreakdown: statusBreakdown,
        invoiceStatusBreakdown,
        reportGeneratedAt: new Date(),
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { getCustomerDashboard, getRevenueReport };
