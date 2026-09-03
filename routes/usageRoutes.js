const express = require('express');
const router = express.Router();
const { recordUsage, getUsageRecords, getUsageSummary } = require('../controllers/usageController');
const auth = require('../middleware/auth');
const rbac = require('../middleware/rbac');
const validate = require('../middleware/validate');
const { usageRecordSchema, objectIdSchema } = require('../utils/validators');

/**
 * @swagger
 * tags:
 *   name: Usage
 *   description: Usage metering records
 */

/**
 * @swagger
 * /api/usage:
 *   post:
 *     summary: Record usage for a subscription
 *     tags: [Usage]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [subscriptionId, metric, quantity, periodStart, periodEnd]
 *             properties:
 *               subscriptionId: { type: string }
 *               metric: { type: string, enum: [api_calls, storage_gb, bandwidth_gb, users] }
 *               quantity: { type: number, example: 500 }
 *               unitPrice: { type: number, example: 0.5 }
 *               periodStart: { type: string, format: date-time }
 *               periodEnd: { type: string, format: date-time }
 *     responses:
 *       201:
 *         description: Usage recorded
 */
router.post('/', auth, validate(usageRecordSchema), recordUsage);

/**
 * @swagger
 * /api/usage:
 *   get:
 *     summary: List usage records (with filtering)
 *     tags: [Usage]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: subscriptionId
 *         schema: { type: string }
 *       - in: query
 *         name: metric
 *         schema: { type: string }
 *       - in: query
 *         name: recorded
 *         schema: { type: boolean }
 *     responses:
 *       200:
 *         description: Usage records list
 */
router.get('/', auth, getUsageRecords);

/**
 * @swagger
 * /api/usage/summary/{subscriptionId}:
 *   get:
 *     summary: Get aggregated usage summary for a subscription
 *     tags: [Usage]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: subscriptionId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Usage summary
 */
router.get('/summary/:subscriptionId', auth, getUsageSummary);

module.exports = router;
