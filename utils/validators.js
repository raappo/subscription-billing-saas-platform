const Joi = require('joi');

const registerSchema = Joi.object({
  name: Joi.string().min(2).max(100).required().messages({
    'string.min': 'Name must be at least 2 characters',
    'string.max': 'Name cannot exceed 100 characters',
    'any.required': 'Name is required',
  }),
  email: Joi.string().email().required().messages({
    'string.email': 'Please provide a valid email',
    'any.required': 'Email is required',
  }),
  password: Joi.string().min(6).max(128).required().messages({
    'string.min': 'Password must be at least 6 characters',
    'any.required': 'Password is required',
  }),
  role: Joi.string().valid('customer', 'admin').default('customer'),
});

const loginSchema = Joi.object({
  email: Joi.string().email().required().messages({
    'string.email': 'Please provide a valid email',
    'any.required': 'Email is required',
  }),
  password: Joi.string().required().messages({
    'any.required': 'Password is required',
  }),
});

const createPlanSchema = Joi.object({
  name: Joi.string().min(2).max(100).required(),
  description: Joi.string().max(500).allow('').default(''),
  price: Joi.number().min(0).required(),
  billingCycle: Joi.string().valid('monthly', 'quarterly', 'yearly').required(),
  featureLimits: Joi.object({
    apiCalls: Joi.number().integer().min(0).default(1000),
    storage: Joi.number().min(0).default(5),
    users: Joi.number().integer().min(1).default(1),
  }).default(),
  tier: Joi.number().integer().min(1).required(),
  isActive: Joi.boolean().default(true),
});

const updatePlanSchema = Joi.object({
  name: Joi.string().min(2).max(100),
  description: Joi.string().max(500).allow(''),
  price: Joi.number().min(0),
  billingCycle: Joi.string().valid('monthly', 'quarterly', 'yearly'),
  featureLimits: Joi.object({
    apiCalls: Joi.number().integer().min(0),
    storage: Joi.number().min(0),
    users: Joi.number().integer().min(1),
  }),
  tier: Joi.number().integer().min(1),
  isActive: Joi.boolean(),
}).min(1);

const createSubscriptionSchema = Joi.object({
  planId: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .required()
    .messages({
      'string.pattern.base': 'Invalid plan ID format',
      'any.required': 'Plan ID is required',
    }),
  couponCode: Joi.string().uppercase().trim().allow(null, ''),
});

const changePlanSchema = Joi.object({
  newPlanId: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .required()
    .messages({
      'string.pattern.base': 'Invalid plan ID format',
      'any.required': 'New plan ID is required',
    }),
});

const usageRecordSchema = Joi.object({
  subscriptionId: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .required(),
  metric: Joi.string().valid('api_calls', 'storage_gb', 'bandwidth_gb', 'users').required(),
  quantity: Joi.number().min(0).required(),
  unitPrice: Joi.number().min(0).default(0),
  periodStart: Joi.date().iso().required(),
  periodEnd: Joi.date().iso().greater(Joi.ref('periodStart')).required(),
});

const generateInvoiceSchema = Joi.object({
  subscriptionId: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .required(),
});

const payInvoiceSchema = Joi.object({
  paymentMethod: Joi.string().valid('card', 'bank_transfer', 'upi', 'wallet').default('card'),
  gatewayRef: Joi.string().allow(null, '').default(null),
});

const createCouponSchema = Joi.object({
  code: Joi.string().min(3).max(30).uppercase().trim().required(),
  discountType: Joi.string().valid('percentage', 'fixed').required(),
  discountValue: Joi.number().min(0).required().when('discountType', {
    is: 'percentage',
    then: Joi.number().max(100),
  }),
  maxRedemptions: Joi.number().integer().min(1).allow(null).default(null),
  validFrom: Joi.date().iso().default(() => new Date()),
  validUntil: Joi.date().iso().greater(Joi.ref('validFrom')).allow(null).default(null),
  applicablePlans: Joi.array()
    .items(Joi.string().pattern(/^[0-9a-fA-F]{24}$/))
    .default([]),
  description: Joi.string().max(500).allow('').default(''),
  isActive: Joi.boolean().default(true),
});

const applyCouponSchema = Joi.object({
  couponCode: Joi.string().uppercase().trim().required(),
});

const paginationSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
  status: Joi.string().allow(''),
  billingCycle: Joi.string().valid('monthly', 'quarterly', 'yearly').allow(''),
  sortBy: Joi.string().default('createdAt'),
  sortOrder: Joi.string().valid('asc', 'desc').default('desc'),
}).unknown(true);

const objectIdSchema = Joi.object({
  id: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .required()
    .messages({
      'string.pattern.base': 'Invalid ID format',
    }),
});

module.exports = {
  registerSchema,
  loginSchema,
  createPlanSchema,
  updatePlanSchema,
  createSubscriptionSchema,
  changePlanSchema,
  usageRecordSchema,
  generateInvoiceSchema,
  payInvoiceSchema,
  createCouponSchema,
  applyCouponSchema,
  paginationSchema,
  objectIdSchema,
};
