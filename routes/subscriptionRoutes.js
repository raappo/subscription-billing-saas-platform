const express = require('express');
const router = express.Router();
const {
  createSubscription,
  changePlan,
  cancelSubscription,
  getSubscriptions,
  getSubscriptionById,
} = require('../controllers/subscriptionController');
const { applyCouponToSubscription } = require('../controllers/couponController');
const auth = require('../middleware/auth');
const rbac = require('../middleware/rbac');
const validate = require('../middleware/validate');
const {
  createSubscriptionSchema,
  changePlanSchema,
  applyCouponSchema,
  objectIdSchema,
} = require('../utils/validators');

/**
 * @swagger
 * tags:
 *   name: Subscriptions
 *   description: Subscription lifecycle management
 */

/**
 * @swagger
 * /api/subscriptions:
 *   post:
 *     summary: Create a new subscription (Customer)
 *     tags: [Subscriptions]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [planId]
 *             properties:
 *               planId: { type: string, example: "64f1a2b3c4d5e6f7a8b9c0d1" }
 *               couponCode: { type: string, example: "WELCOME20" }
 *     responses:
 *       201:
 *         description: Subscription created
 *       409:
 *         description: Active subscription already exists
 */
router.post('/', auth, rbac('customer'), validate(createSubscriptionSchema), createSubscription);

/**
 * @swagger
 * /api/subscriptions:
 *   get:
 *     summary: List subscriptions (customer sees own, admin sees all)
 *     tags: [Subscriptions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [active, trialing, past_due, grace_period, canceled, expired] }
 *       - in: query
 *         name: page
 *         schema: { type: integer }
 *       - in: query
 *         name: limit
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Subscriptions list
 */
router.get('/', auth, getSubscriptions);

/**
 * @swagger
 * /api/subscriptions/{id}:
 *   get:
 *     summary: Get subscription by ID
 *     tags: [Subscriptions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Subscription details
 */
router.get('/:id', auth, validate(objectIdSchema, 'params'), getSubscriptionById);

/**
 * @swagger
 * /api/subscriptions/{id}/change-plan:
 *   put:
 *     summary: Upgrade or downgrade subscription plan
 *     tags: [Subscriptions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [newPlanId]
 *             properties:
 *               newPlanId: { type: string }
 *     responses:
 *       200:
 *         description: Plan changed with proration
 */
router.put('/:id/change-plan', auth, rbac('customer', 'admin'), validate(changePlanSchema), changePlan);

/**
 * @swagger
 * /api/subscriptions/{id}/cancel:
 *   put:
 *     summary: Cancel a subscription (enters grace period)
 *     tags: [Subscriptions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Subscription cancelled with grace period
 */
router.put('/:id/cancel', auth, rbac('customer', 'admin'), cancelSubscription);

/**
 * @swagger
 * /api/subscriptions/{id}/apply-coupon:
 *   post:
 *     summary: Apply coupon to an existing subscription
 *     tags: [Subscriptions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [couponCode]
 *             properties:
 *               couponCode: { type: string, example: "SAVE10" }
 *     responses:
 *       200:
 *         description: Coupon applied
 */
router.post('/:id/apply-coupon', auth, rbac('customer', 'admin'), validate(applyCouponSchema), applyCouponToSubscription);

module.exports = router;
