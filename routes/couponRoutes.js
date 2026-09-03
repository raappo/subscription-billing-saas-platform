const express = require('express');
const router = express.Router();
const { createCoupon, getCoupons, validateCoupon, updateCoupon, deleteCoupon } = require('../controllers/couponController');
const auth = require('../middleware/auth');
const rbac = require('../middleware/rbac');
const validate = require('../middleware/validate');
const { createCouponSchema, applyCouponSchema, objectIdSchema } = require('../utils/validators');

/**
 * @swagger
 * tags:
 *   name: Coupons
 *   description: Coupon/discount management
 */

/**
 * @swagger
 * /api/coupons:
 *   post:
 *     summary: Create a coupon (Admin)
 *     tags: [Coupons]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [code, discountType, discountValue]
 *             properties:
 *               code: { type: string, example: "SAVE20" }
 *               discountType: { type: string, enum: [percentage, fixed] }
 *               discountValue: { type: number, example: 20 }
 *               maxRedemptions: { type: integer }
 *               validUntil: { type: string, format: date-time }
 *     responses:
 *       201:
 *         description: Coupon created
 */
router.post('/', auth, rbac('admin'), validate(createCouponSchema), createCoupon);

/**
 * @swagger
 * /api/coupons:
 *   get:
 *     summary: List coupons (Admin)
 *     tags: [Coupons]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Coupons list
 */
router.get('/', auth, rbac('admin'), getCoupons);

/**
 * @swagger
 * /api/coupons/validate:
 *   post:
 *     summary: Validate a coupon code (Customer)
 *     tags: [Coupons]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [couponCode]
 *             properties:
 *               couponCode: { type: string }
 *     responses:
 *       200:
 *         description: Coupon valid
 *       404:
 *         description: Coupon not found
 */
router.post('/validate', auth, validate(applyCouponSchema), validateCoupon);

/**
 * @swagger
 * /api/coupons/{id}:
 *   put:
 *     summary: Update a coupon (Admin)
 *     tags: [Coupons]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Coupon updated
 */
router.put('/:id', auth, rbac('admin'), validate(objectIdSchema, 'params'), updateCoupon);

/**
 * @swagger
 * /api/coupons/{id}:
 *   delete:
 *     summary: Deactivate a coupon (Admin)
 *     tags: [Coupons]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Coupon deactivated
 */
router.delete('/:id', auth, rbac('admin'), validate(objectIdSchema, 'params'), deleteCoupon);

module.exports = router;
