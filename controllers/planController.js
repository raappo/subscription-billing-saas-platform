const Plan = require('../models/Plan');
const { paginate, paginationMeta } = require('../utils/pagination');
const { logAudit } = require('../utils/auditLogger');
const AppError = require('../utils/AppError');

/**
 * POST /api/plans — Admin creates a new subscription plan.
 */
const createPlan = async (req, res, next) => {
  try {
    const plan = new Plan(req.body);
    await plan.save();

    await logAudit(req.user._id, 'CREATE_PLAN', 'Plan', plan._id, { name: plan.name }, req.ip);

    res.status(201).json({
      success: true,
      message: 'Plan created successfully.',
      data: { plan },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/plans — List all plans (with pagination & filtering).
 */
const getPlans = async (req, res, next) => {
  try {
    const { skip, limit, page } = paginate(req.query);
    const filter = {};

    if (req.query.billingCycle) filter.billingCycle = req.query.billingCycle;
    if (req.query.isActive !== undefined) filter.isActive = req.query.isActive === 'true';

    const [plans, total] = await Promise.all([
      Plan.find(filter).sort({ tier: 1, createdAt: -1 }).skip(skip).limit(limit),
      Plan.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      message: 'Plans retrieved.',
      data: { plans },
      pagination: paginationMeta(total, page, limit),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/plans/:id — Get a single plan by ID.
 */
const getPlanById = async (req, res, next) => {
  try {
    const plan = await Plan.findById(req.params.id);
    if (!plan) {
      throw new AppError('Plan not found.', 404, 'NOT_FOUND');
    }

    res.status(200).json({
      success: true,
      message: 'Plan retrieved.',
      data: { plan },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/plans/:id — Admin updates a plan.
 */
const updatePlan = async (req, res, next) => {
  try {
    const plan = await Plan.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    if (!plan) {
      throw new AppError('Plan not found.', 404, 'NOT_FOUND');
    }

    await logAudit(req.user._id, 'UPDATE_PLAN', 'Plan', plan._id, req.body, req.ip);

    res.status(200).json({
      success: true,
      message: 'Plan updated successfully.',
      data: { plan },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/plans/:id — Admin soft-deletes (deactivates) a plan.
 */
const deletePlan = async (req, res, next) => {
  try {
    const plan = await Plan.findById(req.params.id);
    if (!plan) {
      throw new AppError('Plan not found.', 404, 'NOT_FOUND');
    }

    plan.isActive = false;
    await plan.save();

    await logAudit(req.user._id, 'DEACTIVATE_PLAN', 'Plan', plan._id, {}, req.ip);

    res.status(200).json({
      success: true,
      message: 'Plan deactivated successfully.',
      data: { plan },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { createPlan, getPlans, getPlanById, updatePlan, deletePlan };
