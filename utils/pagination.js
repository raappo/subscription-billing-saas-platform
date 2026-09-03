/**
 * Pagination helper — builds Mongoose skip/limit and returns metadata.
 *
 * @param {Object} query - req.query with optional page & limit
 * @returns {{ skip: number, limit: number, page: number }}
 */
const paginate = (query) => {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 10));
  const skip = (page - 1) * limit;
  return { skip, limit, page };
};

/**
 * Build pagination metadata for response.
 */
const paginationMeta = (total, page, limit) => {
  return {
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
    hasNextPage: page * limit < total,
    hasPrevPage: page > 1,
  };
};

module.exports = { paginate, paginationMeta };
