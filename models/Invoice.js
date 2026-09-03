const mongoose = require('mongoose');

/**
 * Invoice Status State Machine:
 *
 *   draft → open → paid
 *                → failed → retrying → paid
 *                                    → failed (max retries exceeded)
 *                → void
 *
 * - draft: invoice generated but not yet finalized
 * - open: finalized, awaiting payment
 * - paid: successfully paid
 * - failed: payment attempt failed
 * - retrying: dunning in progress, scheduled for re-attempt
 * - void: invoice cancelled/voided by admin
 */
const paymentAttemptSchema = new mongoose.Schema(
  {
    attemptedAt: { type: Date, default: Date.now },
    status: {
      type: String,
      enum: ['success', 'failed'],
      required: true,
    },
    amount: { type: Number, required: true },
    failureReason: { type: String, default: null },
    gatewayRef: {
      type: String,
      default: null,
      comment: 'Mock payment gateway reference ID',
    },
  },
  { _id: true }
);

const invoiceLineItemSchema = new mongoose.Schema(
  {
    description: { type: String, required: true },
    quantity: { type: Number, default: 1 },
    unitPrice: { type: Number, required: true },
    amount: { type: Number, required: true },
    type: {
      type: String,
      enum: ['plan', 'usage', 'proration_credit', 'discount'],
      required: true,
    },
  },
  { _id: true }
);

const invoiceSchema = new mongoose.Schema(
  {
    invoiceNumber: {
      type: String,
      unique: true,
      required: true,
    },
    subscriptionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Subscription',
      required: [true, 'Subscription ID is required'],
    },
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Customer ID is required'],
    },
    // Line items: embedded because they're always read with the invoice and
    // never updated independently after generation.
    lineItems: [invoiceLineItemSchema],
    subtotal: {
      type: Number,
      required: true,
      min: 0,
    },
    discount: {
      type: Number,
      default: 0,
      min: 0,
    },
    total: {
      type: Number,
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      comment: 'Alias for total — kept for backward compat with sample endpoints',
    },
    currency: {
      type: String,
      default: 'INR',
    },
    status: {
      type: String,
      enum: ['draft', 'open', 'paid', 'failed', 'retrying', 'void'],
      default: 'draft',
    },
    dueDate: {
      type: Date,
      required: true,
    },
    paidAt: {
      type: Date,
      default: null,
    },
    periodStart: { type: Date, required: true },
    periodEnd: { type: Date, required: true },
    // Embedded payment attempts — small, bounded array (max ~5 retries),
    // always read alongside the invoice, so embedding is correct.
    paymentAttempts: [paymentAttemptSchema],
    retryCount: {
      type: Number,
      default: 0,
    },
    nextRetryAt: {
      type: Date,
      default: null,
    },
    notes: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

invoiceSchema.index({ subscriptionId: 1 });
invoiceSchema.index({ customerId: 1 });
invoiceSchema.index({ status: 1 });
invoiceSchema.index({ dueDate: 1 });
invoiceSchema.index({ invoiceNumber: 1 }, { unique: true });

// Auto-generate invoice number
invoiceSchema.pre('validate', async function (next) {
  if (!this.invoiceNumber) {
    const count = await mongoose.model('Invoice').countDocuments();
    this.invoiceNumber = `INV-${String(count + 1).padStart(6, '0')}`;
  }
  next();
});

module.exports = mongoose.model('Invoice', invoiceSchema);
