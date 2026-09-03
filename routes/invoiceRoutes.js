const express = require('express');
const router = express.Router();
const {
  generateInvoice,
  payInvoice,
  getInvoices,
  getInvoiceById,
  voidInvoice,
  retryPayment,
} = require('../controllers/invoiceController');
const auth = require('../middleware/auth');
const rbac = require('../middleware/rbac');
const validate = require('../middleware/validate');
const { generateInvoiceSchema, payInvoiceSchema, objectIdSchema } = require('../utils/validators');

/**
 * @swagger
 * tags:
 *   name: Invoices
 *   description: Invoice generation, payment, and dunning
 */

/**
 * @swagger
 * /api/invoices/generate:
 *   post:
 *     summary: Generate invoice for a subscription (Admin)
 *     tags: [Invoices]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [subscriptionId]
 *             properties:
 *               subscriptionId: { type: string }
 *     responses:
 *       201:
 *         description: Invoice generated
 */
router.post('/generate', auth, rbac('admin'), validate(generateInvoiceSchema), generateInvoice);

/**
 * @swagger
 * /api/invoices:
 *   get:
 *     summary: List invoices (customer sees own, admin sees all)
 *     tags: [Invoices]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [draft, open, paid, failed, retrying, void] }
 *       - in: query
 *         name: subscriptionId
 *         schema: { type: string }
 *       - in: query
 *         name: page
 *         schema: { type: integer }
 *       - in: query
 *         name: limit
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Invoices list
 */
router.get('/', auth, getInvoices);

/**
 * @swagger
 * /api/invoices/{id}:
 *   get:
 *     summary: Get invoice by ID
 *     tags: [Invoices]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Invoice details
 */
router.get('/:id', auth, validate(objectIdSchema, 'params'), getInvoiceById);

/**
 * @swagger
 * /api/invoices/{id}/pay:
 *   put:
 *     summary: Record payment for an invoice
 *     tags: [Invoices]
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
 *               paymentMethod: { type: string, enum: [card, bank_transfer, upi, wallet], default: card }
 *               gatewayRef: { type: string }
 *     responses:
 *       200:
 *         description: Payment result
 */
router.put('/:id/pay', auth, validate(payInvoiceSchema), payInvoice);

/**
 * @swagger
 * /api/invoices/{id}/void:
 *   put:
 *     summary: Void an invoice (Admin)
 *     tags: [Invoices]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Invoice voided
 */
router.put('/:id/void', auth, rbac('admin'), voidInvoice);

/**
 * @swagger
 * /api/invoices/{id}/retry:
 *   post:
 *     summary: Retry failed payment (Dunning)
 *     tags: [Invoices]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Retry result
 */
router.post('/:id/retry', auth, rbac('admin'), retryPayment);

module.exports = router;
