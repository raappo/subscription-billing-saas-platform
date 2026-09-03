const express = require('express');
const router = express.Router();
const {
  createPlan,
  getPlans,
  getPlanById,
  updatePlan,
  deletePlan,
} = require('../controllers/planController');
const auth = require('../middleware/auth');
const rbac = require('../middleware/rbac');
const validate = require('../middleware/validate');
const { createPlanSchema, updatePlanSchema, objectIdSchema } = require('../utils/validators');

/**
 * @swagger
 * tags:
 *   name: Plans
 *   description: Subscription plan management (Admin)
 */

/**
 * @swagger
 * /api/plans:
 *   post:
 *     summary: Create a new subscription plan (Admin)
 *     tags: [Plans]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, price, billingCycle, tier]
 *             properties:
 *               name: { type: string, example: "Pro Plan" }
 *               description: { type: string, example: "Best for growing businesses" }
 *               price: { type: number, example: 2999 }
 *               billingCycle: { type: string, enum: [monthly, quarterly, yearly] }
 *               tier: { type: integer, example: 2 }
 *               featureLimits:
 *                 type: object
 *                 properties:
 *                   apiCalls: { type: integer, example: 10000 }
 *                   storage: { type: number, example: 50 }
 *                   users: { type: integer, example: 10 }
 *     responses:
 *       201:
 *         description: Plan created
 *       403:
 *         description: Admin only
 */
router.post('/', auth, rbac('admin'), validate(createPlanSchema), createPlan);

/**
 * @swagger
 * /api/plans:
 *   get:
 *     summary: List all subscription plans
 *     tags: [Plans]
 *     parameters:
 *       - in: query
 *         name: billingCycle
 *         schema: { type: string, enum: [monthly, quarterly, yearly] }
 *       - in: query
 *         name: isActive
 *         schema: { type: boolean }
 *       - in: query
 *         name: page
 *         schema: { type: integer }
 *       - in: query
 *         name: limit
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Plans list
 */
router.get('/', getPlans);

/**
 * @swagger
 * /api/plans/{id}:
 *   get:
 *     summary: Get plan by ID
 *     tags: [Plans]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Plan details
 *       404:
 *         description: Plan not found
 */
router.get('/:id', validate(objectIdSchema, 'params'), getPlanById);

/**
 * @swagger
 * /api/plans/{id}:
 *   put:
 *     summary: Update a plan (Admin)
 *     tags: [Plans]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string }
 *               price: { type: number }
 *               billingCycle: { type: string }
 *     responses:
 *       200:
 *         description: Plan updated
 */
router.put('/:id', auth, rbac('admin'), validate(objectIdSchema, 'params'), validate(updatePlanSchema), updatePlan);

/**
 * @swagger
 * /api/plans/{id}:
 *   delete:
 *     summary: Deactivate a plan (Admin)
 *     tags: [Plans]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Plan deactivated
 */
router.delete('/:id', auth, rbac('admin'), validate(objectIdSchema, 'params'), deletePlan);

module.exports = router;
