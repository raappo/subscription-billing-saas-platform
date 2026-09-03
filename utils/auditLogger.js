const AuditLog = require('../models/AuditLog');

/**
 * Create an audit log entry.
 * Fire-and-forget — does not throw on failure to avoid breaking business flows.
 */
const logAudit = async (userId, action, resource, resourceId, details = {}, ipAddress = null) => {
  try {
    await AuditLog.create({
      userId,
      action,
      resource,
      resourceId,
      details,
      ipAddress,
    });
  } catch (error) {
    console.error('Audit log failed:', error.message);
  }
};

module.exports = { logAudit };
