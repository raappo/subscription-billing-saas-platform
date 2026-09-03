const Coupon = require('../models/Coupon');
const Subscription = require('../models/Subscription');
const { paginate, paginationMeta } = require('../utils/pagination');
const { logAudit } = require('../utils/auditLogger');
const AppError = require('../utils/AppError');

/**
 * POST /api/coupons — Admin creates a new coupon.
 */
const createCoupon = async (req, res, next) => {
  try {
    const coupon = new Coupon(req.body);
    await coupon.save();

    await logAudit(req.user._id, 'CREATE_COUPON', 'Coupon', coupon._id, { code: coupon.code }, req.ip);

    res.status(201).json({
      success: true,
      message: 'Coupon created successfully.',
      data: { coupon },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/coupons — List coupons (admin only).
 */
const getCoupons = async (req, res, next) => {
  try {
    const { skip, limit, page } = paginate(req.query);
    const filter = {};
    if (req.query.isActive !== undefined) filter.isActive = req.query.isActive === 'true';

    const [coupons, total] = await Promise.all([
      Coupon.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Coupon.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      message: 'Coupons retrieved.',
      data: { coupons },
      pagination: paginationMeta(total, page, limit),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/coupons/validate — Customer validates a coupon code.
 */
const validateCoupon = async (req, res, next) => {
  try {
    const { couponCode } = req.body;
    const coupon = await Coupon.findOne({ code: couponCode.toUpperCase() });

    if (!coupon) {
      throw new AppError('Coupon not found.', 404, 'COUPON_NOT_FOUND');
    }

    if (!coupon.isValid()) {
      throw new AppError('Coupon is invalid or expired.', 400, 'COUPON_INVALID');
    }

    res.status(200).json({
      success: true,
      message: 'Coupon is valid.',
      data: {
        code: coupon.code,
        discountType: coupon.discountType,
        discountValue: coupon.discountValue,
        validUntil: coupon.validUntil,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/coupons/:id — Admin updates a coupon.
 */
const updateCoupon = async (req, res, next) => {
  try {
    const coupon = await Coupon.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    if (!coupon) {
      throw new AppError('Coupon not found.', 404, 'NOT_FOUND');
    }

    await logAudit(req.user._id, 'UPDATE_COUPON', 'Coupon', coupon._id, req.body, req.ip);

    res.status(200).json({
      success: true,
      message: 'Coupon updated.',
      data: { coupon },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/coupons/:id — Admin deactivates a coupon.
 */
const deleteCoupon = async (req, res, next) => {
  try {
    const coupon = await Coupon.findById(req.params.id);
    if (!coupon) {
      throw new AppError('Coupon not found.', 404, 'NOT_FOUND');
    }

    coupon.isActive = false;
    await coupon.save();

    await logAudit(req.user._id, 'DEACTIVATE_COUPON', 'Coupon', coupon._id, {}, req.ip);

    res.status(200).json({
      success: true,
      message: 'Coupon deactivated.',
      data: { coupon },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/subscriptions/:id/apply-coupon — Apply coupon to existing subscription.
 */
const applyCouponToSubscription = async (req, res, next) => {
  try {
    const { couponCode } = req.body;
    const subscription = await Subscription.findById(req.params.id).populate('planId');

    if (!subscription) {
      throw new AppError('Subscription not found.', 404, 'NOT_FOUND');
    }

    if (req.user.role === 'customer' && subscription.customerId.toString() !== req.user._id.toString()) {
      throw new AppError('You can only apply coupons to your own subscription.', 403, 'FORBIDDEN');
    }

    if (subscription.couponId) {
      throw new AppError('A coupon is already applied to this subscription.', 409, 'COUPON_ALREADY_APPLIED');
    }

    if (!['active', 'trialing'].includes(subscription.status)) {
      throw new AppError(
        `Cannot apply coupon to subscription with status "${subscription.status}".`,
        400,
        'INVALID_SUBSCRIPTION_STATUS'
      );
    }

    const coupon = await Coupon.findOne({ code: couponCode.toUpperCase() });
    if (!coupon) {
      throw new AppError('Coupon not found.', 404, 'COUPON_NOT_FOUND');
    }

    if (!coupon.isValid()) {
      throw new AppError('Coupon is invalid or expired.', 400, 'COUPON_INVALID');
    }

    if (coupon.applicablePlans.length > 0 && !coupon.applicablePlans.map(p => p.toString()).includes(subscription.planId._id.toString())) {
      throw new AppError('Coupon is not applicable to this plan.', 400, 'COUPON_NOT_APPLICABLE');
    }

    const discount = coupon.calculateDiscount(subscription.planId.price);
    subscription.couponId = coupon._id;
    subscription.discountApplied = discount;

    coupon.currentRedemptions += 1;
    await coupon.save();
    await subscription.save();

    await logAudit(
      req.user._id,
      'APPLY_COUPON',
      'Subscription',
      subscription._id,
      { couponCode, discount },
      req.ip
    );

    res.status(200).json({
      success: true,
      message: `Coupon applied. Discount of ₹${discount} will be reflected on your next invoice.`,
      data: { subscription, discount },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createCoupon,
  getCoupons,
  validateCoupon,
  updateCoupon,
  deleteCoupon,
  applyCouponToSubscription,
};
