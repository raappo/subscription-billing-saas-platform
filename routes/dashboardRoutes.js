const express = require('express');
const router = express.Router();
const { getCustomerDashboard, getRevenueReport } = require('../controllers/dashboardController');
const auth = require('../middleware/auth');
const rbac = require('../middleware/rbac');

/**
 * @swagger
 * tags:
 *   name: Dashboard
 *   description: Customer billing dashboard and admin reports
 */

/**
 * @swagger
 * /api/dashboard/customer:
 *   get:
 *     summary: Customer billing dashboard (current plan, usage, invoices)
 *     tags: [Dashboard]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Customer dashboard data
 */
router.get('/customer', auth, rbac('customer'), getCustomerDashboard);

/**
 * @swagger
 * /api/admin/reports/revenue:
 *   get:
 *     summary: Admin revenue report (MRR, churn, plan-wise data)
 *     tags: [Dashboard]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Revenue report
 */
router.get('/admin/reports/revenue', auth, rbac('admin'), getRevenueReport);

module.exports = router;
