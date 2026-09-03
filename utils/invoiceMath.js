/**
 * Invoice math utilities for billing calculations.
 */

/**
 * Calculate the number of days in a billing period based on the billing cycle.
 * @param {string} billingCycle - 'monthly', 'quarterly', or 'yearly'
 * @returns {number} Approximate days in the billing period
 */
const getBillingCycleDays = (billingCycle) => {
  const cycleDays = {
    monthly: 30,
    quarterly: 90,
    yearly: 365,
  };
  return cycleDays[billingCycle] || 30;
};

/**
 * Calculate prorated credit for unused days on the old plan.
 *
 * Decision rationale (logged in DEVELOPMENT_LOG.md):
 * We use daily proration: credit = (oldPlanPrice / totalDays) * remainingDays.
 * This is the most intuitive and widely-used approach (Stripe, Chargebee both default to this).
 *
 * @param {number} planPrice - Price of the old plan
 * @param {string} billingCycle - Billing cycle of the old plan
 * @param {Date} changeDate - Date of the plan change
 * @param {Date} periodEnd - End of the current billing period
 * @returns {number} Prorated credit amount (rounded to 2 decimals)
 */
const calculateProration = (planPrice, billingCycle, changeDate, periodEnd) => {
  const totalDays = getBillingCycleDays(billingCycle);
  const remainingMs = periodEnd.getTime() - changeDate.getTime();
  const remainingDays = Math.max(0, Math.ceil(remainingMs / (1000 * 60 * 60 * 24)));
  const dailyRate = planPrice / totalDays;
  const credit = Math.round(dailyRate * remainingDays * 100) / 100;
  return credit;
};

/**
 * Calculate next billing period end date.
 * @param {Date} startDate
 * @param {string} billingCycle
 * @returns {Date}
 */
const getNextPeriodEnd = (startDate, billingCycle) => {
  const end = new Date(startDate);
  switch (billingCycle) {
    case 'monthly':
      end.setMonth(end.getMonth() + 1);
      break;
    case 'quarterly':
      end.setMonth(end.getMonth() + 3);
      break;
    case 'yearly':
      end.setFullYear(end.getFullYear() + 1);
      break;
    default:
      end.setMonth(end.getMonth() + 1);
  }
  return end;
};

/**
 * Calculate total usage charges from usage records.
 * @param {Array} usageRecords - Array of usage record documents
 * @returns {number} Total usage charges
 */
const calculateUsageCharges = (usageRecords) => {
  return usageRecords.reduce((total, record) => {
    return total + record.quantity * record.unitPrice;
  }, 0);
};

/**
 * Get the next dunning retry date.
 * Retry schedule: 1 day, 3 days, 5 days, 7 days after last attempt.
 * This exponential-ish backoff avoids hammering a failing payment method
 * while still giving reasonable chances for recovery (e.g. customer
 * adds funds to their card).
 *
 * @param {number} retryCount - Current retry count (0-based)
 * @returns {Date} Next retry date
 */
const getNextRetryDate = (retryCount) => {
  const retryScheduleDays = [1, 3, 5, 7];
  const daysToAdd = retryScheduleDays[Math.min(retryCount, retryScheduleDays.length - 1)];
  const nextDate = new Date();
  nextDate.setDate(nextDate.getDate() + daysToAdd);
  return nextDate;
};

const MAX_RETRY_ATTEMPTS = 4;

module.exports = {
  getBillingCycleDays,
  calculateProration,
  getNextPeriodEnd,
  calculateUsageCharges,
  getNextRetryDate,
  MAX_RETRY_ATTEMPTS,
};
