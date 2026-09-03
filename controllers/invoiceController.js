const Invoice = require('../models/Invoice');
const Subscription = require('../models/Subscription');
const Plan = require('../models/Plan');
const UsageRecord = require('../models/UsageRecord');
const { paginate, paginationMeta } = require('../utils/pagination');
const { calculateUsageCharges, getNextRetryDate, MAX_RETRY_ATTEMPTS } = require('../utils/invoiceMath');
const { logAudit } = require('../utils/auditLogger');
const AppError = require('../utils/AppError');

/**
 * POST /api/invoices/generate
 * Generate a periodic invoice for a subscription.
 *
 * Business rules:
 * - Subscription must be active or past_due.
 * - Collects plan cost + usage charges for the current period.
 * - Applies proration credits from plan changes.
 * - Applies coupon discounts.
 * - Marks related usage records as 'recorded'.
 * - Invoice starts in 'open' status (ready for payment).
 */
const generateInvoice = async (req, res, next) => {
  try {
    const { subscriptionId } = req.body;

    const subscription = await Subscription.findById(subscriptionId)
      .populate('planId')
      .populate('couponId');

    if (!subscription) {
      throw new AppError('Subscription not found.', 404, 'SUBSCRIPTION_NOT_FOUND');
    }

    if (!['active', 'past_due'].includes(subscription.status)) {
      throw new AppError(
        `Cannot generate invoice for subscription with status "${subscription.status}".`,
        400,
        'INVALID_SUBSCRIPTION_STATUS'
      );
    }

    // Admin only
    if (req.user.role !== 'admin') {
      throw new AppError('Only admins can generate invoices.', 403, 'FORBIDDEN');
    }

    const plan = subscription.planId;
    const lineItems = [];

    // 1. Plan cost line item
    lineItems.push({
      description: `${plan.name} plan — ${plan.billingCycle} subscription`,
      quantity: 1,
      unitPrice: plan.price,
      amount: plan.price,
      type: 'plan',
    });

    // 2. Usage charges
    const unrecordedUsage = await UsageRecord.find({
      subscriptionId: subscription._id,
      recorded: false,
    });

    for (const record of unrecordedUsage) {
      const usageAmount = record.quantity * record.unitPrice;
      if (usageAmount > 0) {
        lineItems.push({
          description: `Usage: ${record.metric} (${record.quantity} units @ ₹${record.unitPrice}/unit)`,
          quantity: record.quantity,
          unitPrice: record.unitPrice,
          amount: usageAmount,
          type: 'usage',
        });
      }
    }

    // 3. Proration credit (if any from a plan change)
    if (subscription.prorationCredits > 0) {
      lineItems.push({
        description: `Proration credit from plan change`,
        quantity: 1,
        unitPrice: -subscription.prorationCredits,
        amount: -subscription.prorationCredits,
        type: 'proration_credit',
      });
    }

    // Calculate subtotal
    const subtotal = lineItems.reduce((sum, item) => sum + item.amount, 0);

    // 4. Coupon discount
    let discount = 0;
    if (subscription.couponId && subscription.discountApplied > 0) {
      discount = subscription.discountApplied;
      lineItems.push({
        description: `Discount: coupon ${subscription.couponId.code || 'applied'}`,
        quantity: 1,
        unitPrice: -discount,
        amount: -discount,
        type: 'discount',
      });
    }

    const total = Math.max(0, Math.round((subtotal - discount) * 100) / 100);

    // Set due date: 15 days from now
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 15);

    const invoice = new Invoice({
      subscriptionId: subscription._id,
      customerId: subscription.customerId,
      lineItems,
      subtotal: Math.round(subtotal * 100) / 100,
      discount,
      total,
      amount: total,
      status: 'open',
      dueDate,
      periodStart: subscription.currentPeriodStart,
      periodEnd: subscription.currentPeriodEnd,
    });

    await invoice.save();

    // Mark usage records as recorded
    if (unrecordedUsage.length > 0) {
      await UsageRecord.updateMany(
        { _id: { $in: unrecordedUsage.map((r) => r._id) } },
        { recorded: true }
      );
    }

    // Clear proration credits after applying
    if (subscription.prorationCredits > 0) {
      subscription.prorationCredits = 0;
      await subscription.save();
    }

    await logAudit(
      req.user._id,
      'GENERATE_INVOICE',
      'Invoice',
      invoice._id,
      { total, lineItemCount: lineItems.length },
      req.ip
    );

    res.status(201).json({
      success: true,
      message: 'Invoice generated successfully.',
      data: { invoice },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/invoices/:id/pay
 * Record a payment for an invoice.
 *
 * Invoice status transitions: open/failed/retrying → paid
 * Simulates a payment gateway call (mocked).
 */
const payInvoice = async (req, res, next) => {
  try {
    const invoice = await Invoice.findById(req.params.id);

    if (!invoice) {
      throw new AppError('Invoice not found.', 404, 'NOT_FOUND');
    }

    // Authorization: customer can only pay their own invoices
    if (req.user.role === 'customer' && invoice.customerId.toString() !== req.user._id.toString()) {
      throw new AppError('You can only pay your own invoices.', 403, 'FORBIDDEN');
    }

    if (invoice.status === 'paid') {
      throw new AppError('Invoice is already paid.', 409, 'ALREADY_PAID');
    }

    if (invoice.status === 'void') {
      throw new AppError('Cannot pay a voided invoice.', 400, 'INVOICE_VOIDED');
    }

    if (!['open', 'failed', 'retrying'].includes(invoice.status)) {
      throw new AppError(
        `Cannot pay invoice with status "${invoice.status}".`,
        400,
        'INVALID_STATUS_TRANSITION'
      );
    }

    // Mock payment processing (80% success rate for testing dunning)
    const paymentSucceeded = Math.random() > 0.2;
    const { paymentMethod, gatewayRef } = req.body;

    const paymentAttempt = {
      attemptedAt: new Date(),
      status: paymentSucceeded ? 'success' : 'failed',
      amount: invoice.total,
      gatewayRef: gatewayRef || `mock_${Date.now()}`,
      failureReason: paymentSucceeded ? null : 'Insufficient funds (mock)',
    };

    invoice.paymentAttempts.push(paymentAttempt);

    if (paymentSucceeded) {
      invoice.status = 'paid';
      invoice.paidAt = new Date();

      // If subscription was past_due, restore to active
      const subscription = await Subscription.findById(invoice.subscriptionId);
      if (subscription && subscription.status === 'past_due') {
        subscription.status = 'active';
        subscription.failedPaymentCount = 0;
        subscription.lastPaymentAttempt = null;
        subscription.nextRetryAt = null;
        await subscription.save();
      }
    } else {
      invoice.retryCount += 1;

      if (invoice.retryCount >= MAX_RETRY_ATTEMPTS) {
        invoice.status = 'failed';
        invoice.notes = `Payment failed after ${MAX_RETRY_ATTEMPTS} attempts. Manual intervention required.`;

        // Move subscription to past_due if not already
        const subscription = await Subscription.findById(invoice.subscriptionId);
        if (subscription && subscription.status === 'active') {
          subscription.status = 'past_due';
          subscription.failedPaymentCount = invoice.retryCount;
          subscription.lastPaymentAttempt = new Date();
          await subscription.save();
        }
      } else {
        invoice.status = 'retrying';
        invoice.nextRetryAt = getNextRetryDate(invoice.retryCount);
      }
    }

    await invoice.save();

    await logAudit(
      req.user._id,
      paymentSucceeded ? 'PAYMENT_SUCCESS' : 'PAYMENT_FAILED',
      'Invoice',
      invoice._id,
      { paymentMethod, amount: invoice.total, retryCount: invoice.retryCount },
      req.ip
    );

    res.status(200).json({
      success: true,
      message: paymentSucceeded
        ? 'Payment successful.'
        : `Payment failed. ${invoice.retryCount >= MAX_RETRY_ATTEMPTS ? 'Max retries exceeded.' : `Retry scheduled for ${invoice.nextRetryAt?.toISOString()}`}`,
      data: {
        invoice,
        paymentResult: paymentAttempt,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/invoices — List invoices with pagination and filtering.
 */
const getInvoices = async (req, res, next) => {
  try {
    const { skip, limit, page } = paginate(req.query);
    const filter = {};

    if (req.user.role === 'customer') {
      filter.customerId = req.user._id;
    } else if (req.query.customerId) {
      filter.customerId = req.query.customerId;
    }

    if (req.query.status) filter.status = req.query.status;
    if (req.query.subscriptionId) filter.subscriptionId = req.query.subscriptionId;

    const [invoices, total] = await Promise.all([
      Invoice.find(filter)
        .populate('subscriptionId', 'planId status')
        .populate('customerId', 'name email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Invoice.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      message: 'Invoices retrieved.',
      data: { invoices },
      pagination: paginationMeta(total, page, limit),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/invoices/:id — Get a single invoice by ID.
 */
const getInvoiceById = async (req, res, next) => {
  try {
    const invoice = await Invoice.findById(req.params.id)
      .populate('subscriptionId')
      .populate('customerId', 'name email');

    if (!invoice) {
      throw new AppError('Invoice not found.', 404, 'NOT_FOUND');
    }

    if (req.user.role === 'customer' && invoice.customerId._id.toString() !== req.user._id.toString()) {
      throw new AppError('You can only view your own invoices.', 403, 'FORBIDDEN');
    }

    res.status(200).json({
      success: true,
      message: 'Invoice retrieved.',
      data: { invoice },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/invoices/:id/void — Admin voids an invoice.
 */
const voidInvoice = async (req, res, next) => {
  try {
    const invoice = await Invoice.findById(req.params.id);

    if (!invoice) {
      throw new AppError('Invoice not found.', 404, 'NOT_FOUND');
    }

    if (invoice.status === 'paid') {
      throw new AppError('Cannot void a paid invoice.', 400, 'CANNOT_VOID_PAID');
    }

    if (invoice.status === 'void') {
      throw new AppError('Invoice is already voided.', 409, 'ALREADY_VOIDED');
    }

    invoice.status = 'void';
    invoice.notes = `Voided by admin ${req.user.name} on ${new Date().toISOString()}`;
    await invoice.save();

    await logAudit(req.user._id, 'VOID_INVOICE', 'Invoice', invoice._id, {}, req.ip);

    res.status(200).json({
      success: true,
      message: 'Invoice voided.',
      data: { invoice },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/invoices/:id/retry — Dunning: retry a failed payment.
 */
const retryPayment = async (req, res, next) => {
  try {
    const invoice = await Invoice.findById(req.params.id);

    if (!invoice) {
      throw new AppError('Invoice not found.', 404, 'NOT_FOUND');
    }

    if (!['failed', 'retrying'].includes(invoice.status)) {
      throw new AppError(
        `Cannot retry payment for invoice with status "${invoice.status}".`,
        400,
        'INVALID_STATUS_FOR_RETRY'
      );
    }

    if (invoice.retryCount >= MAX_RETRY_ATTEMPTS) {
      throw new AppError(
        `Maximum retry attempts (${MAX_RETRY_ATTEMPTS}) exceeded. Manual resolution required.`,
        400,
        'MAX_RETRIES_EXCEEDED'
      );
    }

    // Mock payment retry (70% success rate on retries)
    const paymentSucceeded = Math.random() > 0.3;

    const paymentAttempt = {
      attemptedAt: new Date(),
      status: paymentSucceeded ? 'success' : 'failed',
      amount: invoice.total,
      gatewayRef: `retry_mock_${Date.now()}`,
      failureReason: paymentSucceeded ? null : 'Payment declined (mock retry)',
    };

    invoice.paymentAttempts.push(paymentAttempt);
    invoice.retryCount += 1;

    if (paymentSucceeded) {
      invoice.status = 'paid';
      invoice.paidAt = new Date();
      invoice.nextRetryAt = null;

      // Restore subscription
      const subscription = await Subscription.findById(invoice.subscriptionId);
      if (subscription && subscription.status === 'past_due') {
        subscription.status = 'active';
        subscription.failedPaymentCount = 0;
        subscription.nextRetryAt = null;
        await subscription.save();
      }
    } else {
      if (invoice.retryCount >= MAX_RETRY_ATTEMPTS) {
        invoice.status = 'failed';
        invoice.nextRetryAt = null;
        invoice.notes = `Payment permanently failed after ${MAX_RETRY_ATTEMPTS} attempts.`;
      } else {
        invoice.status = 'retrying';
        invoice.nextRetryAt = getNextRetryDate(invoice.retryCount);
      }
    }

    await invoice.save();

    await logAudit(
      req.user._id,
      paymentSucceeded ? 'RETRY_PAYMENT_SUCCESS' : 'RETRY_PAYMENT_FAILED',
      'Invoice',
      invoice._id,
      { retryCount: invoice.retryCount },
      req.ip
    );

    res.status(200).json({
      success: true,
      message: paymentSucceeded
        ? 'Retry payment successful!'
        : `Retry failed. Attempt ${invoice.retryCount}/${MAX_RETRY_ATTEMPTS}.`,
      data: { invoice, paymentResult: paymentAttempt },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  generateInvoice,
  payInvoice,
  getInvoices,
  getInvoiceById,
  voidInvoice,
  retryPayment,
};
