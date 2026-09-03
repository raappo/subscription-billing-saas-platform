/**
 * Seed script — populates the database with sample data for demo/testing.
 *
 * Creates:
 * - 1 billing admin
 * - 3 customers
 * - 3 subscription plans (Basic, Pro, Enterprise)
 * - 2 coupons
 * - Subscriptions in various states
 * - Usage records
 * - Invoices in various states
 *
 * Run: npm run seed
 */

require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const connectDB = require('../config/db');

const User = require('../models/User');
const Plan = require('../models/Plan');
const Subscription = require('../models/Subscription');
const UsageRecord = require('../models/UsageRecord');
const Invoice = require('../models/Invoice');
const Coupon = require('../models/Coupon');

const seed = async () => {
  try {
    await connectDB();
    console.log('🌱 Seeding database...\n');

    // Clear existing data
    await Promise.all([
      User.deleteMany({}),
      Plan.deleteMany({}),
      Subscription.deleteMany({}),
      UsageRecord.deleteMany({}),
      Invoice.deleteMany({}),
      Coupon.deleteMany({}),
    ]);
    console.log('✅ Cleared existing data');

    // ─── Users ──────────────────────────────────────────────────────────────
    const passwordHash = await bcrypt.hash('password123', 12);

    const admin = await User.create({
      name: 'Admin User',
      email: 'admin@saas.com',
      passwordHash,
      role: 'admin',
    });

    const customer1 = await User.create({
      name: 'Alice Johnson',
      email: 'alice@example.com',
      passwordHash,
      role: 'customer',
    });

    const customer2 = await User.create({
      name: 'Bob Smith',
      email: 'bob@example.com',
      passwordHash,
      role: 'customer',
    });

    const customer3 = await User.create({
      name: 'Charlie Brown',
      email: 'charlie@example.com',
      passwordHash,
      role: 'customer',
    });

    console.log('✅ Users created (admin + 3 customers)');
    console.log(`   Admin:    admin@saas.com / password123`);
    console.log(`   Customer: alice@example.com / password123`);
    console.log(`   Customer: bob@example.com / password123`);
    console.log(`   Customer: charlie@example.com / password123`);

    // ─── Plans ──────────────────────────────────────────────────────────────
    const basicPlan = await Plan.create({
      name: 'Basic',
      description: 'Perfect for individuals and small projects',
      price: 499,
      billingCycle: 'monthly',
      featureLimits: { apiCalls: 1000, storage: 5, users: 1 },
      tier: 1,
    });

    const proPlan = await Plan.create({
      name: 'Professional',
      description: 'Best for growing businesses and teams',
      price: 1999,
      billingCycle: 'monthly',
      featureLimits: { apiCalls: 10000, storage: 50, users: 10 },
      tier: 2,
    });

    const enterprisePlan = await Plan.create({
      name: 'Enterprise',
      description: 'For large organizations with custom needs',
      price: 4999,
      billingCycle: 'monthly',
      featureLimits: { apiCalls: 100000, storage: 500, users: 100 },
      tier: 3,
    });

    console.log('✅ Plans created (Basic ₹499, Pro ₹1999, Enterprise ₹4999)');

    // ─── Coupons ────────────────────────────────────────────────────────────
    const coupon1 = await Coupon.create({
      code: 'WELCOME20',
      discountType: 'percentage',
      discountValue: 20,
      maxRedemptions: 100,
      validFrom: new Date('2026-01-01'),
      validUntil: new Date('2027-12-31'),
      description: '20% off for new customers',
    });

    const coupon2 = await Coupon.create({
      code: 'FLAT200',
      discountType: 'fixed',
      discountValue: 200,
      maxRedemptions: 50,
      validFrom: new Date('2026-01-01'),
      validUntil: new Date('2027-06-30'),
      applicablePlans: [proPlan._id, enterprisePlan._id],
      description: '₹200 off on Pro and Enterprise plans',
    });

    console.log('✅ Coupons created (WELCOME20, FLAT200)');

    // ─── Subscriptions ──────────────────────────────────────────────────────
    const now = new Date();
    const oneMonthLater = new Date(now);
    oneMonthLater.setMonth(oneMonthLater.getMonth() + 1);

    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Alice: Active on Pro plan with coupon
    const sub1 = await Subscription.create({
      customerId: customer1._id,
      planId: proPlan._id,
      status: 'active',
      currentPeriodStart: now,
      currentPeriodEnd: oneMonthLater,
      couponId: coupon1._id,
      discountApplied: 399.80,
    });

    // Bob: Past due on Basic plan
    const sub2 = await Subscription.create({
      customerId: customer2._id,
      planId: basicPlan._id,
      status: 'past_due',
      currentPeriodStart: thirtyDaysAgo,
      currentPeriodEnd: now,
      failedPaymentCount: 2,
      lastPaymentAttempt: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000),
    });

    // Charlie: Canceled (grace period) on Enterprise
    const gracePeriodEnd = new Date(oneMonthLater);
    gracePeriodEnd.setDate(gracePeriodEnd.getDate() + 7);

    const sub3 = await Subscription.create({
      customerId: customer3._id,
      planId: enterprisePlan._id,
      status: 'grace_period',
      currentPeriodStart: now,
      currentPeriodEnd: oneMonthLater,
      cancelAtPeriodEnd: true,
      canceledAt: now,
      gracePeriodEnd: gracePeriodEnd,
    });

    console.log('✅ Subscriptions created (active, past_due, grace_period)');

    // ─── Usage Records ──────────────────────────────────────────────────────
    const usageData = [
      { subscriptionId: sub1._id, metric: 'api_calls', quantity: 3500, unitPrice: 0.1, periodStart: now, periodEnd: oneMonthLater },
      { subscriptionId: sub1._id, metric: 'storage_gb', quantity: 12, unitPrice: 5, periodStart: now, periodEnd: oneMonthLater },
      { subscriptionId: sub2._id, metric: 'api_calls', quantity: 800, unitPrice: 0.1, periodStart: thirtyDaysAgo, periodEnd: now },
      { subscriptionId: sub3._id, metric: 'api_calls', quantity: 45000, unitPrice: 0.05, periodStart: now, periodEnd: oneMonthLater },
      { subscriptionId: sub3._id, metric: 'bandwidth_gb', quantity: 100, unitPrice: 2, periodStart: now, periodEnd: oneMonthLater },
    ];

    await UsageRecord.insertMany(usageData);
    console.log('✅ Usage records created (5 records across 3 subscriptions)');

    // ─── Invoices ───────────────────────────────────────────────────────────
    const dueDate = new Date(now);
    dueDate.setDate(dueDate.getDate() + 15);

    // Paid invoice for Alice
    await Invoice.create({
      invoiceNumber: 'INV-000001',
      subscriptionId: sub1._id,
      customerId: customer1._id,
      lineItems: [
        { description: 'Professional plan — monthly subscription', quantity: 1, unitPrice: 1999, amount: 1999, type: 'plan' },
        { description: 'Usage: api_calls (3500 units @ ₹0.1/unit)', quantity: 3500, unitPrice: 0.1, amount: 350, type: 'usage' },
        { description: 'Discount: coupon WELCOME20', quantity: 1, unitPrice: -399.80, amount: -399.80, type: 'discount' },
      ],
      subtotal: 2349,
      discount: 399.80,
      total: 1949.20,
      amount: 1949.20,
      status: 'paid',
      dueDate,
      paidAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000),
      periodStart: thirtyDaysAgo,
      periodEnd: now,
      paymentAttempts: [
        { attemptedAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000), status: 'success', amount: 1949.20, gatewayRef: 'mock_paid_001' },
      ],
    });

    // Failed invoice for Bob (in dunning)
    await Invoice.create({
      invoiceNumber: 'INV-000002',
      subscriptionId: sub2._id,
      customerId: customer2._id,
      lineItems: [
        { description: 'Basic plan — monthly subscription', quantity: 1, unitPrice: 499, amount: 499, type: 'plan' },
        { description: 'Usage: api_calls (800 units @ ₹0.1/unit)', quantity: 800, unitPrice: 0.1, amount: 80, type: 'usage' },
      ],
      subtotal: 579,
      discount: 0,
      total: 579,
      amount: 579,
      status: 'retrying',
      dueDate: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000),
      periodStart: thirtyDaysAgo,
      periodEnd: now,
      retryCount: 2,
      nextRetryAt: new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000),
      paymentAttempts: [
        { attemptedAt: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000), status: 'failed', amount: 579, failureReason: 'Insufficient funds' },
        { attemptedAt: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000), status: 'failed', amount: 579, failureReason: 'Card declined' },
      ],
    });

    // Open invoice for Charlie
    await Invoice.create({
      invoiceNumber: 'INV-000003',
      subscriptionId: sub3._id,
      customerId: customer3._id,
      lineItems: [
        { description: 'Enterprise plan — monthly subscription', quantity: 1, unitPrice: 4999, amount: 4999, type: 'plan' },
        { description: 'Usage: api_calls (45000 units @ ₹0.05/unit)', quantity: 45000, unitPrice: 0.05, amount: 2250, type: 'usage' },
        { description: 'Usage: bandwidth_gb (100 units @ ₹2/unit)', quantity: 100, unitPrice: 2, amount: 200, type: 'usage' },
      ],
      subtotal: 7449,
      discount: 0,
      total: 7449,
      amount: 7449,
      status: 'open',
      dueDate,
      periodStart: now,
      periodEnd: oneMonthLater,
    });

    console.log('✅ Invoices created (paid, retrying, open)');

    console.log('\n🎉 Database seeded successfully!');
    console.log('\n📋 Summary:');
    console.log('   Users: 4 (1 admin + 3 customers)');
    console.log('   Plans: 3 (Basic, Professional, Enterprise)');
    console.log('   Coupons: 2 (WELCOME20, FLAT200)');
    console.log('   Subscriptions: 3 (active, past_due, grace_period)');
    console.log('   Usage Records: 5');
    console.log('   Invoices: 3 (paid, retrying, open)');
    console.log('\n🔐 All accounts use password: password123');

    process.exit(0);
  } catch (error) {
    console.error('❌ Seed failed:', error);
    process.exit(1);
  }
};

seed();
