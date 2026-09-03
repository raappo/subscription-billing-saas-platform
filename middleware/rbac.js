/**
 * Role-Based Access Control middleware.
 * Usage: rbac('admin') or rbac('customer', 'admin')
 * Must be used AFTER the auth middleware (req.user must exist).
 */
const rbac = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required.',
        errorCode: 'AUTH_REQUIRED',
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Access denied. Required role(s): ${allowedRoles.join(', ')}. Your role: ${req.user.role}.`,
        errorCode: 'FORBIDDEN',
      });
    }

    next();
  };
};

module.exports = rbac;
